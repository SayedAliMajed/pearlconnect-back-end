const express = require('express');
const Booking = require('../models/booking');
const Availability = require('../models/availability');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

/**
 * Helper function to format dates in DD/MM/YYYY format for Bahrain/GCC display
 * @param {Date} date - JavaScript Date object
 * @returns {string} Formatted date string in DD/MM/YYYY format
 */
function formatDateDDMMYYYY(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth() is 0-based
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const router = express.Router();




/**
 * CREATE a booking (customer only)
 * ====================
 *
 * Creates a new service booking after validating:
 * - User has customer or admin access
 * - Service and provider exist
 * - Requested time slot is available (uses global provider availability)
 * - No booking conflicts exist
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { serviceId, customerId, providerId, date, timeSlot } = req.body;

    // =========================================================================
    // AUTHORIZATION CHECK - Only customers or admins can book
    // =========================================================================
    if (req.user._id.toString() !== customerId && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'You can only book as a customer' });
    }

    // =========================================================================
    // REQUIRED FIELDS VALIDATION
    // =========================================================================
    if (!serviceId || !customerId || !providerId || !date || !timeSlot) {
      return res.status(400).json({
        err: 'serviceId, customerId, providerId, date, and timeSlot are required'
      });
    }

    // =========================================================================
    // SERVICE & PROVIDER VALIDATION
    // =========================================================================
    const Service = require('../models/services');
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(400).json({ err: 'Service not found' });
    }

    if (service.provider.toString() !== providerId) {
      return res.status(400).json({ err: 'Service does not belong to this provider' });
    }

    // =========================================================================
    // DATE & TIME VALIDATION
    // =========================================================================
    const bookingDate = new Date(date);
    const now = new Date();

    if (bookingDate <= now) {
      return res.status(400).json({ err: 'Booking date must be in the future' });
    }

    // Validate timeSlot format (should be "HH:MM AM/PM" format)
    const timeSlotRegex = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i;
    if (!timeSlotRegex.test(timeSlot)) {
      return res.status(400).json({
        err: 'Invalid timeSlot format. Use format: "HH:MM AM" or "HH:MM PM"'
      });
    }

    // =========================================================================
    // PROVIDER AVAILABILITY VALIDATION - Use new global system
    // =========================================================================

    // Check if provider has availability configured
    const providerAvailability = await Availability.findOne({ providerId });
    if (!providerAvailability) {
      return res.status(400).json({
        err: 'Provider has no availability schedule configured. Please contact the provider.'
      });
    }

    
    const internalDateFormat = bookingDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const displayDateFormat = formatDateDDMMYYYY(bookingDate); // DD/MM/YYYY for users

    // Simulate getting available slots for validation
    const availableSlots = await getAvailableSlotsInternal(providerId, bookingDate);

    // Check if requested time slot is available
    const requestedSlotExists = availableSlots.some(slot =>
      slot.startTime === timeSlot && slot.available === true
    );

    if (!requestedSlotExists) {
      return res.status(400).json({
        err: `Selected time slot (${timeSlot}) is not available. Please choose from available slots.`
      });
    }

    // =========================================================================
    // BOOKING CONFLICT DETECTION - Check for existing bookings
    // =========================================================================
    const existingBooking = await Booking.findOne({
      providerId: providerId,  // Changed to check provider conflicts (same provider can't double-book)
      date: bookingDate,
      timeSlot: timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      return res.status(409).json({
        err: 'This provider is already booked for the selected time slot'
      });
    }

    // =========================================================================
    // CREATE BOOKING
    // =========================================================================
    const createdBooking = await Booking.create({
      serviceId,
      customerId,
      providerId,
      date: bookingDate,
      timeSlot: timeSlot,
      status: 'pending'  // Default status
    });

    return res.status(201).json({
      message: 'Booking created successfully',
      booking: createdBooking
    });

  } catch (err) {
    console.error('Booking creation error:', err);
    return res.status(500).json({ err: 'Failed to create booking' });
  }
});

/**
 * Helper function to get available slots using the new availability system
 * This simulates an internal call to the availability slots logic
 */
async function getAvailableSlotsInternal(providerId, requestedDate) {
  try {
    // Get provider's availability schedule
    const availability = await Availability.findOne({ providerId });
    if (!availability) return [];

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = requestedDate.getDay();

    // Find schedule for this day
    const schedule = availability.schedules.find(s => s.dayOfWeek === dayOfWeek && s.isEnabled);
    if (!schedule) return [];

    // Check for date-specific exceptions
    const dateStr = requestedDate.toISOString().split('T')[0];
    const exception = availability.exceptions.find(e => e.date.toISOString().split('T')[0] === dateStr);

    // If date has exception and is marked unavailable
    if (exception && !exception.isAvailable) {
      return [];
    }

    // Generate slots based on schedule (excluding breaks and buffer time)
    const slots = [];

    const startTime = exception?.customStartTime || schedule.startTime;
    const endTime = exception?.customEndTime || schedule.endTime;

    const start = parseTimeStringInternal(startTime);
    const end = parseTimeStringInternal(endTime);

    let currentTime = new Date(requestedDate);
    currentTime.setHours(start.hours, start.minutes, 0, 0);

    const endDateTime = new Date(requestedDate);
    endDateTime.setHours(end.hours, end.minutes, 0, 0);

    // Generate appointment slots
    while (currentTime < endDateTime) {
      // Check if current time slot overlaps with break times
      const isDuringBreak = schedule.breakTimes?.some(breakTime => {
        const breakStart = parseTimeStringInternal(breakTime.startTime);
        const breakEnd = parseTimeStringInternal(breakTime.endTime);

        const slotStartHour = currentTime.getHours();
        const slotEndHour = currentTime.getHours() + Math.floor(schedule.slotDuration / 60);

        return (slotStartHour >= breakStart.hours) &&
               (slotEndHour <= breakEnd.hours);
      }) ?? false;

      if (!isDuringBreak) {
        slots.push({
          startTime: formatTimeStringInternal(currentTime),
          endTime: formatTimeStringInternal(new Date(currentTime.getTime() + (schedule.slotDuration * 60000))),
          available: true
        });
      }

      // Move to next slot with buffer time
      currentTime = new Date(currentTime.getTime() + ((schedule.slotDuration + schedule.bufferTime) * 60000));
    }

    return slots;
  } catch (err) {
    console.error('Error getting available slots internally:', err);
    return [];
  }
}

/**
 * Time parsing helper for internal availability calculations
 */
function parseTimeStringInternal(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return { hours, minutes };
}

/**
 * Time formatting helper for internal availability calculations
 */
function formatTimeStringInternal(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${displayHours}:${minutes} ${period}`;
}




//LIST provider bookings (provider only)

router.get('/provider-bookings', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Only allow providers or admins
    if (userRole !== 'provider' && userRole !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    const bookings = await Booking.find({ providerId: userId })
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email')
      .sort({ createdAt: -1 });

    return res.json(bookings);
  } catch (err) {
    return res.status(500).json({ err: 'Failed to fetch bookings' });
  }
});

//LIST all bookings (role-based access)

router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;
    console.log(`DEBUG: GET /bookings called by user ${userId} with role '${userRole}'`);

    let filter = {};
    if (userRole === 'admin') {
      // Admin sees all (no filter)
    } else if (userRole === 'provider') {
      // Providers see received bookings (where they are the provider)
      filter.providerId = userId;
    } else if (userRole === 'customer') {
      // Customers see placed bookings (where they are the customer)
      filter.customerId = userId;
    }

    const bookings = await Booking.find(filter)
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email')
      .sort({ createdAt: -1 }); // Most recent first

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

    //permission - use string comparison for reliable ObjectId matching
    const isCustomer = userId.toString() === existing.customerId.toString();
    const isProvider = userId.toString() === existing.providerId.toString();

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


router.put('/:bookingId', verifyToken, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.bookingId);
    if (!existing) return res.status(404).json({ err: 'Booking not found' });

    const userId = req.user._id;
    const userRole = req.user.role;

    //permission - use string comparison for reliable ObjectId matching
    const isCustomer = userId.toString() === existing.customerId.toString();
    const isProvider = userId.toString() === existing.providerId.toString();

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
