/**
 * @fileoverview Provider Availability Controller for PearlConnect
 *
 * Manages provider availability schedules using global provider calendar approach.
 * Each provider has one availability document that applies to all their services.
 */

const express = require('express');
const Availability = require('../models/availability');
const User = require('../models/user');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// GET provider's global availability schedule
router.get('/provider/:providerId', verifyToken, async (req, res) => {
  try {
    const { providerId } = req.params;

    // Validate provider exists
    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    // Allow providers to view their own availability OR customers to view availability for booking
    // Only restrict if user is trying to access someone else's availability and they're not admin
    const isProviderViewingOwn = req.user._id.toString() === providerId;
    const isAdmin = req.user.role === 'admin';
    const isCustomer = req.user.role === 'customer';

    if (!isProviderViewingOwn && !isAdmin && !isCustomer) {
      return res.status(403).json({ err: 'Access denied - invalid user role' });
    }

    const availability = await Availability.findOne({ providerId })
      .populate('providerId', 'username email profile');

    if (!availability) {
      return res.status(404).json({
        err: 'No availability schedule found for this provider',
        message: 'Provider has not set up their availability yet'
      });
    }

    res.json(availability);
  } catch (err) {
    console.error('Get availability error:', err);
    res.status(500).json({ err: err.message });
  }
});

// SET or UPDATE provider's complete availability schedule
router.post('/provider/:providerId', verifyToken, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { schedules, exceptions, timezone, advanceBookingDays } = req.body;

    // Validate provider exists
    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    // Only the provider themselves or admin can set availability
    if (req.user.role !== 'admin' && req.user._id.toString() !== providerId) {
      return res.status(403).json({ err: 'Access denied - can only set own availability' });
    }

    // Only providers can set availability
    if (!provider.role || !provider.role.includes('provider')) {
      return res.status(403).json({ err: 'Only providers can set availability schedules' });
    }

    // Validate required schedules array
    if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ err: 'At least one weekly schedule is required' });
    }

    // Validate schedule structure
    for (let i = 0; i < schedules.length; i++) {
      const schedule = schedules[i];
      if (schedule.dayOfWeek === undefined || schedule.dayOfWeek === null ||
          schedule.startTime === undefined || schedule.startTime === null ||
          schedule.endTime === undefined || schedule.endTime === null ||
          schedule.slotDuration === undefined || schedule.slotDuration === null) {
        return res.status(400).json({
          err: `Schedule ${i + 1}: dayOfWeek, startTime, endTime, and slotDuration are required`
        });
      }
      const timeRegex = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i;
      if (!timeRegex.test(schedule.startTime) || !timeRegex.test(schedule.endTime)) {
        return res.status(400).json({
          err: `Invalid time format. Use HH:MM AM/PM (e.g., "09:30 AM")`
        });
      }
    }

    const availabilityData = {
      providerId,
      schedules,
      exceptions: exceptions || [],
      timezone: timezone || 'Asia/Bahrain',
      advanceBookingDays: advanceBookingDays || 30
    };

    // Create or update provider availability
    const availability = await Availability.findOneAndUpdate(
      { providerId },
      availabilityData,
      { upsert: true, new: true, runValidators: true }
    ).populate('providerId', 'username email profile');

    res.status(201).json({
      message: 'Availability schedule updated successfully',
      availability
    });
  } catch (err) {
    console.error('Set availability error:', err);
    res.status(500).json({ err: err.message });
  }
});

// UPDATE provider's availability (partial updates) - add exceptions, modify schedules
router.patch('/provider/:providerId', verifyToken, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { schedules, exceptions, timezone, advanceBookingDays } = req.body;

    // Validate provider exists
    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    // Only the provider themselves or admin can update availability
    if (req.user.role !== 'admin' && req.user._id.toString() !== providerId) {
      return res.status(403).json({ err: 'Access denied - can only update own availability' });
    }

    // Get existing availability
    const existingAvailability = await Availability.findOne({ providerId });
    if (!existingAvailability) {
      return res.status(404).json({ err: 'Availability schedule not found. Create it first with POST.' });
    }

    // Build update object
    const updates = {};
    if (schedules !== undefined) updates.schedules = schedules;
    if (exceptions !== undefined) updates.exceptions = exceptions;
    if (timezone !== undefined) updates.timezone = timezone;
    if (advanceBookingDays !== undefined) updates.advanceBookingDays = advanceBookingDays;

    // Validate if schedules are being updated
    if (schedules && (!Array.isArray(schedules) || schedules.length === 0)) {
      return res.status(400).json({ err: 'At least one weekly schedule is required' });
    }

    // Create or update availability
    const availability = await Availability.findOneAndUpdate(
      { providerId },
      updates,
      { new: true, runValidators: true }
    ).populate('providerId', 'username email profile');

    res.json({
      message: 'Availability updated successfully',
      availability
    });
  } catch (err) {
    console.error('Update availability error:', err);
    res.status(500).json({ err: err.message });
  }
});

// DELETE provider's entire availability schedule
router.delete('/provider/:providerId', verifyToken, async (req, res) => {
  try {
    const { providerId } = req.params;

    // Validate provider exists
    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    // Only the provider themselves or admin can delete availability
    if (req.user.role !== 'admin' && req.user._id.toString() !== providerId) {
      return res.status(403).json({ err: 'Access denied - can only delete own availability' });
    }

    const result = await Availability.findOneAndDelete({ providerId });

    if (!result) {
      return res.status(404).json({ err: 'Availability schedule not found' });
    }

    res.json({
      message: 'Availability schedule deleted successfully',
      deletedScheduleId: result._id
    });
  } catch (err) {
    console.error('Delete availability error:', err);
    res.status(500).json({ err: err.message });
  }
});

// GET available time slots for a specific date
router.get('/provider/:providerId/slots', verifyToken, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { date, serviceId } = req.query; // serviceId optional for future service-specific overrides

    // Validate provider exists
    const provider = await User.findById(providerId);
    if (!provider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    // Allow customers to view available slots for booking
    const isProviderViewingOwn = req.user._id.toString() === providerId;
    const isAdmin = req.user.role === 'admin';
    const isCustomer = req.user.role === 'customer';

    if (!isProviderViewingOwn && !isAdmin && !isCustomer) {
      return res.status(403).json({ err: 'Access denied - invalid user role for viewing slots' });
    }

    // Validate date
    const requestedDate = new Date(date);
    if (isNaN(requestedDate.getTime())) {
      return res.status(400).json({ err: 'Invalid date format. Use YYYY-MM-DD.' });
    }

    // Get provider availability
    const availability = await Availability.findOne({ providerId });
    if (!availability) {
      return res.status(404).json({ err: 'Provider has not set up availability schedule' });
    }

    // Get day of week (0 = Sunday, 6 = Saturday)
    const dayOfWeek = requestedDate.getDay();

    // Find schedule for this day
    const schedule = availability.schedules.find(s => s.dayOfWeek === dayOfWeek && s.isEnabled);
    if (!schedule) {
      return res.json({ slots: [], message: 'No available slots for this day' });
    }

    // Check for date-specific exceptions
    const dateStr = requestedDate.toISOString().split('T')[0];
    const exception = availability.exceptions.find(e => e.date.toISOString().split('T')[0] === dateStr);

    // If date has exception and is marked unavailable
    if (exception && !exception.isAvailable) {
      return res.json({ slots: [], message: exception.reason || 'Unavailable due to exception' });
    }

    // Use exception times if specified, otherwise use regular schedule times
    let startTime = schedule.startTime;
    let endTime = schedule.endTime;

    if (exception && exception.customStartTime) {
      startTime = exception.customStartTime;
    }
    if (exception && exception.customEndTime) {
      endTime = exception.customEndTime;
    }

    // Generate time slots based on schedule
    const timeSlots = generateTimeSlots(
      startTime,
      endTime,
      schedule.slotDuration,
      schedule.bufferTime,
      schedule.breakTimes || [],
      requestedDate
    );

    res.json({
      slots: timeSlots,
      schedule: {
        startTime,
        endTime,
        slotDuration: schedule.slotDuration,
        bufferTime: schedule.bufferTime
      },
      timezone: availability.timezone
    });
  } catch (err) {
    console.error('Get slots error:', err);
    res.status(500).json({ err: err.message });
  }
});

// Helper function to generate time slots
function generateTimeSlots(startTime, endTime, slotDuration, bufferTime, breakTimes, date) {
  const slots = [];

  // Parse start and end times (assuming format HH:MM AM/PM)
  const start = parseTimeString(startTime);
  const end = parseTimeString(endTime);

  let currentTime = new Date(date);
  currentTime.setHours(start.hours, start.minutes, 0, 0);

  const endDateTime = new Date(date);
  endDateTime.setHours(end.hours, end.minutes, 0, 0);

  // Generate slots until end time
  while (currentTime < endDateTime) {
    const slotEndTime = new Date(currentTime.getTime() + (slotDuration * 60000));

    // Check if slot overlaps with break times
    const isDuringBreak = breakTimes.some(breakTime => {
      const breakStart = parseTimeString(breakTime.startTime);
      const breakEnd = parseTimeString(breakTime.endTime);

      const slotStartHour = currentTime.getHours();
      const slotEndHour = slotEndTime.getHours();

      return (slotStartHour >= breakStart.hours || (slotStartHour === breakStart.hours && currentTime.getMinutes() >= breakStart.minutes)) &&
             (slotEndHour <= breakEnd.hours || (slotEndHour === breakEnd.hours && slotEndTime.getMinutes() <= breakEnd.minutes));
    });

    if (!isDuringBreak && slotEndTime <= endDateTime) {
      slots.push({
        startTime: formatTimeString(currentTime),
        endTime: formatTimeString(slotEndTime),
        available: true
      });
    }

    // Move to next slot with buffer time
    currentTime = new Date(slotEndTime.getTime() + (bufferTime * 60000));
  }

  return slots;
}

// Helper function to parse time string (e.g., "09:30 AM")
function parseTimeString(timeStr) {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return { hours, minutes };
}

// Helper function to format time back to string
function formatTimeString(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

  return `${displayHours}:${minutes} ${period}`;
}

module.exports = router;
