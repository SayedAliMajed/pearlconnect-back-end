const express = require('express');
const Booking = require('../models/booking');
const Availability = require('../models/availability');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

/**
 * Helper function to format dates in DD/MM/YYYY format for Bahrain/GCC display
 */
function formatDateDDMMYYYY(date) {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

const router = express.Router();

/**
 * Create a booking (customer or admin only)
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const { serviceId, customerId, providerId, date, timeSlot } = req.body;

    if (req.user._id.toString() !== customerId && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'You can only book as a customer' });
    }

    if (!serviceId || !customerId || !providerId || !date || !timeSlot) {
      return res.status(400).json({
        err: 'serviceId, customerId, providerId, date, and timeSlot are required'
      });
    }

    const Service = require('../models/services');
    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(400).json({ err: 'Service not found' });
    }

    if (service.provider.toString() !== providerId) {
      return res.status(400).json({ err: 'Service does not belong to this provider' });
    }

    const bookingDate = new Date(date);
    if (bookingDate <= new Date()) {
      return res.status(400).json({ err: 'Booking date must be in the future' });
    }

    const timeSlotRegex = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i;
    if (!timeSlotRegex.test(timeSlot)) {
      return res.status(400).json({
        err: 'Invalid timeSlot format. Use format: "HH:MM AM" or "HH:MM PM"'
      });
    }

    const providerAvailability = await Availability.findOne({ providerId });
    if (!providerAvailability) {
      return res.status(400).json({
        err: 'Provider has no availability schedule configured.'
      });
    }

    const availableSlots = await getAvailableSlotsInternal(providerId, bookingDate);

    const slotAvailable = availableSlots.some(slot =>
      slot.startTime === timeSlot && slot.available
    );

    if (!slotAvailable) {
      return res.status(400).json({
        err: 'Selected time slot is not available.'
      });
    }

    const conflictingBooking = await Booking.findOne({
      providerId,
      date: bookingDate,
      timeSlot,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (conflictingBooking) {
      return res.status(409).json({
        err: 'This provider is already booked for the selected time slot'
      });
    }

    const booking = await Booking.create({
      serviceId,
      customerId,
      providerId,
      date: bookingDate,
      timeSlot,
      status: 'pending'
    });

    return res.status(201).json({
      message: 'Booking created successfully',
      booking
    });

  } catch (err) {
    return res.status(500).json({ err: 'Failed to create booking' });
  }
});

/**
 * Get provider bookings (provider only)
 */
router.get('/provider-bookings', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

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

/**
 * Get bookings with role-based filtering
 */
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    let filter = {};
    if (userRole === 'provider') {
      filter.providerId = userId;
    } else if (userRole === 'customer') {
      filter.customerId = userId;
    }

    const bookings = await Booking.find(filter)
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email')
      .sort({ createdAt: -1 });

    return res.json(bookings);
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

/**
 * Get booking by ID (owner or admin only)
 */
router.get('/:bookingId', verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate('serviceId', 'title price')
      .populate('customerId', 'name email')
      .populate('providerId', 'name email');

    if (!booking) return res.status(404).json({ err: 'Booking not found' });

    const userId = req.user._id;
    const isOwner = userId === booking.customerId.toString() ||
                   userId === booking.providerId.toString();

    if (req.user.role !== 'admin' && !isOwner) {
      return res.status(403).json({ err: 'Access denied' });
    }

    return res.json(booking);
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

/**
 * Update booking (PATCH)
 */
router.patch('/:bookingId', verifyToken, async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.bookingId);
    if (!existing) return res.status(404).json({ err: 'Booking not found' });

    const userId = req.user._id;
    const isOwner = userId === existing.customerId.toString() ||
                   userId === existing.providerId.toString();

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    const updates = { ...req.body };
    delete updates._id;
    delete updates.customerId;
    delete updates.providerId;
    delete updates.serviceId;
    delete updates.createdAt;

    if (updates.status) {
      const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!validStatuses.includes(updates.status)) {
        return res.status(400).json({ err: 'Invalid status' });
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

/**
 * Update booking (PUT)
 */
router.put('/:bookingId', verifyToken, async (req, res) => {
  return router.patch('/:bookingId', verifyToken).handler(req, res);
});

/**
 * Delete booking (owner or admin only)
 */
router.delete('/:bookingId', verifyToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) return res.status(404).json({ err: 'Booking not found' });

    const userId = req.user._id;
    const isOwner = userId === booking.customerId.toString() ||
                   userId === booking.providerId.toString();

    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ err: 'Access denied' });
    }

    await Booking.findByIdAndDelete(req.params.bookingId);
    return res.json({ message: 'Booking deleted successfully' });
  } catch (err) {
    return res.status(500).json({ err: err.message });
  }
});

/**
 * Helper function to get available slots
 */
async function getAvailableSlotsInternal(providerId, requestedDate) {
  try {
    const availability = await Availability.findOne({ providerId });
    if (!availability) return [];

    const dayOfWeek = requestedDate.getDay();
    const schedule = availability.schedules.find(s =>
      s.dayOfWeek === dayOfWeek && s.isEnabled
    );
    if (!schedule) return [];

    const dateStr = requestedDate.toISOString().split('T')[0];
    const exception = availability.exceptions.find(e =>
      e.date.toISOString().split('T')[0] === dateStr
    );

    if (exception && !exception.isAvailable) {
      return [];
    }

    const slots = [];
    const startTime = exception?.customStartTime || schedule.startTime;
    const endTime = exception?.customEndTime || schedule.endTime;

    const start = parseTimeStringInternal(startTime);
    const end = parseTimeStringInternal(endTime);

    let currentTime = new Date(requestedDate);
    currentTime.setHours(start.hours, start.minutes, 0, 0);

    const endDateTime = new Date(requestedDate);
    endDateTime.setHours(end.hours, end.minutes, 0, 0);

    while (currentTime < endDateTime) {
      const isDuringBreak = schedule.breakTimes?.some(breakTime => {
        const breakStart = parseTimeStringInternal(breakTime.startTime);
        const breakEnd = parseTimeStringInternal(breakTime.endTime);
        const slotStart = currentTime.getHours();
        const slotEnd = slotStart + Math.floor(schedule.slotDuration / 60);
        return slotStart >= breakStart.hours && slotEnd <= breakEnd.hours;
      }) ?? false;

      if (!isDuringBreak) {
        slots.push({
          startTime: formatTimeStringInternal(currentTime),
          endTime: formatTimeStringInternal(new Date(currentTime.getTime() + (schedule.slotDuration * 60000))),
          available: true
        });
      }

      currentTime = new Date(currentTime.getTime() + ((schedule.slotDuration + schedule.bufferTime) * 60000));
    }

    return slots;
  } catch (err) {
    return [];
  }
}

/**
 * Time parsing helper
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
 * Time formatting helper
 */
function formatTimeStringInternal(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${displayHours}:${minutes} ${period}`;
}

module.exports = router;
