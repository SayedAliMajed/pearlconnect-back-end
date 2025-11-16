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

    // Parse booking time from 12-hour format to 24-hour HH:MM
    const convertTo24Hour = (timeStr) => {
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        // Parse 12-hour format like "3:00 PM"
        const [time12, period] = timeStr.split(' ');
        let [hours, minutes] = time12.split(':').map(Number);
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      } else {
        // Already in 24-hour format
        return timeStr;
      }
    };

    const bookingTime = convertTo24Hour(req.body.time || bookingDate.toTimeString().substring(0, 5));

    // Import Availability model for validations
    const Availability = require('../models/availability');

    // 1. PROVIDER AVAILABILITY CHECK: Temporarily check provider for develop testing
    const providerAvailability = await Availability.findOne({ providerId: providerId });

    if (!providerAvailability) {
      return res.status(400).json({ err: 'Provider has no availability configured' });
    }

    console.log('📅 Booking date parsed:', bookingDate.toDateString());

    // Find all availabilities and filter manually by date string (avoid timezone issues)
    const allProviderAvailabilities = await Availability.find({ providerId: providerId });
    console.log('🔍 Total availability entries for provider:', allProviderAvailabilities.length);

    const providerAvailabilityForDate = allProviderAvailabilities.find(avail => {
      return avail.date.toDateString() === bookingDate.toDateString();
    });

    console.log('✅ Found matching availability:', providerAvailabilityForDate);

    if (!providerAvailabilityForDate) {
      console.log('❌ All availability dates found:', allProviderAvailabilities.map(a => ({
        _id: a._id,
        date: a.date,
        dateStr: `${a.date.getFullYear()}-${a.date.getMonth()}-${a.date.getDate()}`
      })));
      return res.status(400).json({ err: 'No availability found for this date' });
    }

    // Basic time validation
    if (bookingTime < providerAvailabilityForDate.openingTime ||
        bookingTime >= providerAvailabilityForDate.closingTime) {
      return res.status(400).json({
        err: `Booking time is outside provider hours (${providerAvailabilityForDate.openingTime} - ${providerAvailabilityForDate.closingTime})`
      });
    }

    console.log('✅ All validations passed, creating booking...');

    // 3. CONFLICT DETECTION: Check for existing bookings for the same service at the same time
    console.log('🔍 Checking for conflicting bookings...');
    const existingBooking = await Booking.findOne({
      serviceId: serviceId,
      date: bookingDate,
      status: { $in: ['pending', 'confirmed'] } // Only check active bookings
    });

    if (existingBooking) {
      console.log('❌ Found conflicting booking:', existingBooking);
      return res.status(409).json({ err: 'This service time slot is already booked' });
    }

    console.log('✅ No conflicts, creating booking...');
    const created = await Booking.create({
      serviceId,
      customerId,
      providerId,
      date: bookingDate,
    });
    console.log('✅ Booking created successfully:', created);

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
