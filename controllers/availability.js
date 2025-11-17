const express = require('express');
const Availability = require('../models/availability');
const Service = require('../models/services');
const User = require('../models/user');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// GET availability for a service
router.get('/service/:serviceId', verifyToken, async (req, res) => {
  try {
    const { serviceId } = req.params;

    // Validate user can access this service
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ err: 'Service not found' });
    }

    // Only provider of the service or admin can view
    if (req.user.role !== 'admin' && req.user._id.toString() !== service.provider._id.toString()) {
      return res.status(403).json({ err: 'Access denied' });
    }

    const availability = await Availability.findOne({ serviceId }).populate('serviceId', 'title');

    if (!availability) {
      return res.status(404).json({ err: 'Availability not found for this service' });
    }

    res.json(availability);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

// CREATE or UPDATE availability for a service
router.post('/service/:serviceId', verifyToken, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { appointmentDuration, minimumAdvanceBooking, workingHours } = req.body;

    // Validate service exists and user owns it
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ err: 'Service not found' });
    }

    if (req.user.role !== 'admin' && req.user._id.toString() !== service.provider._id.toString()) {
      return res.status(403).json({ err: 'Only service provider can update availability' });
    }

    // Validate required fields
    if (!appointmentDuration || !workingHours) {
      return res.status(400).json({ err: 'appointmentDuration and workingHours are required' });
    }

    // Validate workingHours has valid structure
    const validDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (const day of validDays) {
      if (workingHours[day] && typeof workingHours[day].enabled !== 'boolean') {
        return res.status(400).json({ err: `Invalid workingHours.${day}.enabled` });
      }
    }

    const availabilityData = {
      serviceId,
      appointmentDuration,
      minimumAdvanceBooking: minimumAdvanceBooking || 60,
      workingHours
    };

    // Update or create
    const availability = await Availability.findOneAndUpdate(
      { serviceId },
      availabilityData,
      { upsert: true, new: true, runValidators: true }
    ).populate('serviceId', 'title');

    res.status(201).json(availability);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

// UPDATE availability for a service (partial update)
router.patch('/service/:serviceId', verifyToken, async (req, res) => {
  try {
    const { serviceId } = req.params;
    const updates = req.body;

    // Validate service exists and user owns it
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ err: 'Service not found' });
    }

    if (req.user.role !== 'admin' && req.user._id.toString() !== service.provider._id.toString()) {
      return res.status(403).json({ err: 'Access denied' });
    }

    const availability = await Availability.findOneAndUpdate(
      { serviceId },
      updates,
      { new: true, runValidators: true }
    ).populate('serviceId', 'title');

    if (!availability) {
      return res.status(404).json({ err: 'Availability not found' });
    }

    res.json(availability);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

// DELETE availability for a service
router.delete('/service/:serviceId', verifyToken, async (req, res) => {
  try {
    const { serviceId } = req.params;

    // Validate service exists and user owns it
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ err: 'Service not found' });
    }

    if (req.user.role !== 'admin' && req.user._id.toString() !== service.provider._id.toString()) {
      return res.status(403).json({ err: 'Access denied' });
    }

    const result = await Availability.findOneAndDelete({ serviceId });

    if (!result) {
      return res.status(404).json({ err: 'Availability not found' });
    }

    res.json({ message: 'Availability deleted successfully' });
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

module.exports = router;
