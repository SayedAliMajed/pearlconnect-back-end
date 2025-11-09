const express = require('express');
const Service = require('../models/service');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// CREATE a service (provider or admin)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { title, description, price, category, provider, images } = req.body;

    if (req.user._id !== provider && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'You can only create services as provider or an admin' });
    }

    if (!title || !description || price == null || !provider) {
      return res.status(400).json({ err: 'title, description, price, and provider are required' });
    }
    if (typeof price !== 'number' || price < 0) {
      return res.status(400).json({ err: 'price must be number' });
    }

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
    console.log(err);
    return res.status(500).json({ err: 'Failed to create service' });
  }
});

// LIST all services
router.get('/', async (req, res) => {
  try {
    const services = await Service.find({}, 'title description price category provider images createdAt')
      .populate('provider', 'name email')
      .populate('category', 'name');
    return res.json(services);
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
router.patch('/:serviceId', verifyToken, async (req, res) => {
  try {
    const existing = await Service.findById(req.params.serviceId);
    if (!existing) return res.status(404).json({ err: 'Service not found' });

    // check ownership
    if (req.user._id !== existing.provider.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ err:  err.message});
    }

    // copy updates safely
    const updates = { ...req.body };
    delete updates._id;
    delete updates.provider; // prevent changing provider
    delete updates.createdAt;

    // validation
    if (updates.price != null) {
      if (typeof updates.price !== 'number' || updates.price < 0) {
        return res.status(400).json({ err: 'price must be number' });
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
    if (req.user.role !== 'admin' && req.user._id !== service.provider.toString()) {
      return res.status(500).json({ err:  err.message });
    }

    await Service.findByIdAndDelete(req.params.serviceId);
    return res.json({ message: 'Service deleted', _id: service._id });
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

module.exports = router;
