const express = require('express');
const Booking = require('../models/booking');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();


//CREATE a booking (customer only)

router.post('/', verifyToken, async (req, res) => {
  try {
    const { serviceId, customerId, providerId, date } = req.body;

    if (req.user._id.toString() !== customerId && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'You can only book as a customer' });
    }

    if (!serviceId || !customerId || !providerId || !date) {
      return res.status(400).json({ err: 'serviceId, customerId, providerId, and date are required' });
    }

    // Parse booking datetime
    const bookingDate = new Date(date);
    const now = new Date();
    if (bookingDate <= now) {
      return res.status(400).json({ err: 'Booking date must be in the future' });
    }

    // Get date components for validation
    const bookingTime = bookingDate.toTimeString().substring(0, 5); // HH:MM

    // Import Availability model for validations
    const Availability = require('../models/availability');

    // 1. PROVIDER AVAILABILITY CHECK: Temporarily check provider for develop testing
    const providerAvailability = await Availability.findOne({ providerId: providerId });

    if (!providerAvailability) {
      return res.status(400).json({ err: 'Provider has no availability configured' });
    }

    // Temporarily skip detailed time validations for develop testing
    // Add check: Ensure booking time is within provider's available time
    const bookingDateOnly = new Date(bookingDate.toDateString());
    const providerAvailabilityForDate = await Availability.findOne({
      providerId: providerId,
      date: bookingDateOnly
    });

    if (!providerAvailabilityForDate) {
      return res.status(400).json({ err: 'No availability found for this date' });
    }

    // Basic time validation
    if (bookingTime < providerAvailabilityForDate.openingTime ||
        bookingTime >= providerAvailabilityForDate.closingTime) {
      return res.status(400).json({
        err: `Booking time is outside provider hours (${providerAvailabilityForDate.openingTime} - ${providerAvailabilityForDate.closingTime})`
      });
    }

    // 3. CONFLICT DETECTION: Check for existing bookings for the same service at the same time
    const existingBooking = await Booking.findOne({
      serviceId: serviceId,
      date: bookingDate,
      status: { $in: ['pending', 'confirmed'] } // Only check active bookings
    });

    if (existingBooking) {
      return res.status(409).json({ err: 'This service time slot is already booked' });
    }

    const created = await Booking.create({
      serviceId,
      customerId,
      providerId,
      date: bookingDate,
    });

    return res.status(201).json(created);
  } catch (err) {
    console.error('Booking creation error:', err);
    return res.status(500).json({ err: 'Failed to create booking' });
  }
});


//LIST all bookings (admin only)
 
router.get('/', verifyToken, checkRole(['admin']), async (req, res) => {
  try {
    const bookings = await Booking.find({})
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email');

    return res.json(bookings);
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});


//GET one booking by ID (owner or admin)
 
router.get('/:bookingId', verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email');

    if (!booking) return res.status(404).json({ err: 'Booking not found' });

    const userId = req.user._id;
    if (
      req.user.role !== 'admin' &&
      userId !== booking.customerId.toString() &&
      userId !== booking.providerId.toString()
    ) {
      return res.status(403).json({ err: 'You can only view your own bookings' });
    }

    return res.json(booking);
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

router.patch('/:bookingId', verifyToken, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.bookingId);
    if (!existing) return res.status(404).json({ err: 'Booking not found' });

    const userId = req.user._id;
    const userRole = req.user.role;

    //permissionn 
    const isCustomer = userId === existing.customerId.toString();
    const isProvider = userId === existing.providerId.toString();

    if (!isCustomer && !isProvider && userRole !== 'admin') {
      return res.status(403).json({ err: 'Not authorized to update this booking' });
    }

    const updates = { ...req.body };
    delete updates._id;
    delete updates.customerId;
    delete updates.providerId;
    delete updates.serviceId;
    delete updates.createdAt;

    // basic validation for status 
    if (updates.status) {
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!validStatuses.includes(updates.status)) {
        return res.status(400).json({ err: 'Invalid status. Must be: pending, confirmed, completed, or cancelled' });
      }
    }

    const updated = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      updates,
      { new: true, runValidators: true }
    );

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});


// Admin can delete any booking
// Customer or Provider can delete only their own booking

router.delete('/:bookingId', verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ err: 'Booking not found' });

    const userId = req.user._id;
    const userRole = req.user.role;

    // allow delete if admin or owner 
    if (
      userRole !== 'admin' &&
      userId !== booking.customerId.toString() &&
      userId !== booking.providerId.toString()
    ) {
      return res.status(403).json({ err: 'You can only delete your own bookings' });
    }

    await Booking.findByIdAndDelete(req.params.bookingId);
    return res.json({ message: 'Booking deleted', _id: booking._id });
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

module.exports = router;
