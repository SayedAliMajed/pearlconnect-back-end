const express = require('express');
const multer = require('multer');
const Service = require('../models/services');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB per file
    files: 10 // Maximum 10 files
  }
});

// CREATE a service (provider or admin)
router.post('/', verifyToken, upload.array('images', 10), async (req, res) => {
  try {
    const { title, description, price, category, provider } = req.body;

    // Check permissions: user must be admin, or a provider creating for themselves
    const isAdmin = req.user.role === 'admin';
    const isProvider = req.user.role === 'provider';
    const isCreatingOwnService = isProvider && req.user._id.toString() === provider.toString();

    if (!isAdmin && !isCreatingOwnService) {
      return res.status(403).json({ err: 'You can only create services as provider or an admin' });
    }

    if (!title || !description || price == null || !provider) {
      return res.status(400).json({ err: 'title, description, price, and provider are required' });
    }
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ err: 'Price must be a valid number in BD' });
    }

    // Process images: start with any existing image URLs, then add uploaded files
    let images = [];
    if (req.body.images) {
      if (Array.isArray(req.body.images)) {
        images = req.body.images; // Pre-existing image objects
      } else if (typeof req.body.images === 'string') {
        try {
          images = JSON.parse(req.body.images); // Handle stringified JSON
        } catch (e) {
          console.warn('Failed to parse images JSON:', e.message);
        }
      }
    }

    // Add uploaded files to the images array
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        images.push({
          url: `/uploads/${file.filename}`,
          alt: file.originalname || 'Service image'
        });
      }
    }

    // Create service with processed data
    const created = await Service.create({
      title,
      description,
      price,
      category,
      provider,
      images,
    });
    return res.status(201).json(created);
  } catch (err) {
    console.error('Service creation error:', err);

    // Handle multer errors
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ err: 'File size too large. Maximum 5MB per file.' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ err: 'Too many files. Maximum 10 images allowed.' });
      }
    }

    if (err.message === 'Only image files are allowed!') {
      return res.status(400).json({ err: err.message });
    }

    console.error('Error details:', {
      name: err.name,
      message: err.message,
      errors: err.errors,
      stack: err.stack
    });
    return res.status(500).json({ err: 'Failed to create service', details: err.message });
  }
});

// LIST all services with optional search and filtering
router.get('/', async (req, res) => {
  try {
    const { search, category, provider, minPrice, maxPrice, page = 1, limit = 20 } = req.query;
    
    // Build filter object
    let filter = {};
    
    // Text search in title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Category filter
    if (category) {
      filter.category = category;
    }
    
    // Provider filter
    if (provider) {
      filter.provider = provider;
    }
    
    // Price range filter
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Execute query
    const services = await Service.find(filter, 'title description price category provider images createdAt')
      .populate('provider', 'name email')
      .populate('category', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
      
    // Get total count for pagination
    const total = await Service.countDocuments(filter);
    
    return res.json({
      services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

// GET one service by ID 
router.get('/:serviceId', async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId)
      .populate('provider', 'name email')
      .populate('category', 'name');
    if (!service) return res.status(404).json({ err: 'Service not found' });
    return res.json(service);
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

// UPDATE a service (owner or admin)
router.put('/:serviceId', verifyToken, async (req, res) => {
  try {
    const existing = await Service.findById(req.params.serviceId);
    if (!existing) return res.status(404).json({ err: 'Service not found' });

    // check ownership
    if (req.user._id.toString() !== existing.provider.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'You are not authorized to update this service' });
    }

    // copy updates safely
    const updates = { ...req.body };
    delete updates._id;
    delete updates.provider; // prevent changing provider
    delete updates.createdAt;

    // validation
    if (updates.price != null) {
      if (typeof updates.price !== 'number' || updates.price < 0) {
        return res.status(400).json({ err: 'Price must be a valid number in BD' });
      }
    }

    const updated = await Service.findByIdAndUpdate(
      req.params.serviceId,
      updates,
      { new: true, runValidators: true }
    );

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

// DELETE a service (admin OR provider who owns it)
router.delete('/:serviceId', verifyToken, async (req, res) => {
  try {
    const service = await Service.findById(req.params.serviceId);
    if (!service) return res.status(404).json({ err: 'Service not found' });

    // if user is admin or the service owner
    if (req.user.role !== 'admin' && req.user._id.toString() !== service.provider.toString()) {
      return res.status(403).json({ err: 'You are not authorized to delete this service' });
    }

    await Service.findByIdAndDelete(req.params.serviceId);
    return res.json({ message: 'Service deleted', _id: service._id });
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

module.exports = router;
