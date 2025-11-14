const express = require('express');
const Availability = require('../models/availability');
const User = require('../models/user');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// LIST availability
// Providers can see their own, admins can see all or filter by provider
router.get('/availability', verifyToken, async (req, res) => {
    try {
        let filter = {};

        if (req.user.role === 'provider') {
            filter.providerId = req.user._id;
        } else if (req.query.providerId) {
            filter.providerId = req.query.providerId;
        }

        const availabilities = await Availability.find(filter)
            .populate('providerId', 'profile.fullName username')
            .populate('userId', 'profile.fullName username')
            .sort({ date: 1 });

        res.json({ availabilities });
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

// CREATE availability
// Providers can create for themselves, admins can create for any provider
router.post('/availability', verifyToken, async (req, res) => {
    // Declare variables for error handling scope
    let targetProviderId, date, openingTime, closingTime, duration, breakTimesArray, isRepeating;

    try {
        console.log('Availability POST received:', req.body);

        // Map frontend field names to backend expectations
        const body = req.body;
        date = body.date;
        openingTime = body.openingTime || body.startTime;
        closingTime = body.closingTime || body.endTime;
        duration = body.duration || 60; // Default to 60 minutes if not provided
        const providerId = body.providerId || body.provider;
        const breakStartTime = body.breakStartTime || body.breakStart;
        const breakEndTime = body.breakEndTime || body.breakEnd;
        isRepeating = body.isRepeating !== undefined ? body.isRepeating : (body.isRecurring || false);

        console.log('Mapped fields:', { date, openingTime, closingTime, duration, breakStartTime, breakEndTime, isRepeating });

        // Determine providerId - providers can only set their own, admins can set any
        if (req.user.role === 'provider') {
            targetProviderId = req.user._id;
        } else if (req.user.role === 'admin') {
            targetProviderId = providerId || req.user._id;  // Admin can set for others
        } else {
            return res.status(403).json({ err: 'Access denied' });
        }

        // Validate that provider exists and is a provider
        const provider = await User.findById(targetProviderId);
        if (!provider || provider.role !== 'provider') {
            return res.status(400).json({ err: 'Invalid provider' });
        }

        // Check if availability exists for this provider and date
        let availability = await Availability.findOne({
            providerId: targetProviderId,
            date: date ? new Date(date) : null
        });

        // Parse break times
        let breakTimesArray = [];
        if (breakStartTime && breakEndTime) {
            if (Array.isArray(breakStartTime) && Array.isArray(breakEndTime)) {
                // Multiple breaks
                breakTimesArray = breakStartTime.map((start, index) => ({
                    startTime: start,
                    endTime: breakEndTime[index] || ''
                }));
            } else {
                // Single break
                breakTimesArray = [{
                    startTime: breakStartTime,
                    endTime: breakEndTime
                }];
            }
        }

        const availabilityData = {
            userId: req.user._id,
            providerId: targetProviderId,
            date: new Date(date),
            openingTime: openingTime,
            closingTime: closingTime,
            duration: parseInt(duration),
            isRepeating: isRepeating === 'true' || isRepeating === true,
            breakTimes: breakTimesArray
        };

        if (availability) {
            // Update existing availability
            Object.assign(availability, availabilityData);
            await availability.save();
            res.json({ message: 'Availability updated successfully', availability: availability });
        } else {
            // Create new availability
            availability = new Availability(availabilityData);
            await availability.save();

            const populated = await Availability.findById(availability._id)
                .populate('providerId', 'profile.fullName username')
                .populate('userId', 'profile.fullName username');

            res.status(201).json({ message: 'Availability created successfully', availability: populated });
        }
  } catch (err) {
    console.error('Availability creation error:', err);
    console.error('Error name:', err.name);
    console.error('Error code:', err.code);
    console.error('Error details:', {
      message: err.message,
      errors: err.errors,
      stack: err.stack
    });

    // Handle unique index violations
    if (err.code === 11000) {
      console.log('Duplicate key error - trying to use existing availability');
      // Try to find and update existing availability
      try {
        let existing = await Availability.findOne({
          providerId: targetProviderId,
          date: new Date(date)
        });

        if (existing) {
          console.log('Updating existing availability');
          existing.openingTime = openingTime;
          existing.closingTime = closingTime;
          existing.duration = parseInt(duration);
          existing.breakTimes = breakTimesArray;
          existing.isRepeating = isRepeating;
          await existing.save();

          return res.json({ message: 'Availability updated successfully', availability: existing });
        }
      } catch (updateErr) {
        console.error('Failed to update existing availability:', updateErr);
      }

      return res.status(409).json({
        err: 'Availability slot already exists for this date',
        details: 'Try updating the existing slot instead of creating a new one'
      });
    }

    return res.status(500).json({ err: 'Failed to create availability', details: err.message });
  }
});

// UPDATE availability
// Providers can update their own, admins can update any
router.put('/availability/:availabilityId', verifyToken, async (req, res) => {
    try {
        const existing = await Availability.findById(req.params.availabilityId);
        if (!existing) {
            return res.status(404).json({ err: 'Availability not found' });
        }

        // Check permissions
        if (req.user.role !== 'admin' && req.user._id.toString() !== existing.providerId.toString()) {
            return res.status(403).json({ err: 'You can only update your own availability' });
        }

        const { date, openingTime, closingTime, duration, providerId, breakStartTime, breakEndTime, isRepeating } = req.body;

        // If changing provider, validate admin only and provider exists
        if (providerId && providerId !== existing.providerId.toString()) {
            if (req.user.role !== 'admin') {
                return res.status(403).json({ err: 'Only admin can change provider' });
            }
            const provider = await User.findById(providerId);
            if (!provider || provider.role !== 'provider') {
                return res.status(400).json({ err: 'Invalid provider' });
            }
            existing.providerId = providerId;
        }

        // Check for duplicate if date changed
        if (date && new Date(date).getTime() !== existing.date.getTime()) {
            const duplicate = await Availability.findOne({
                providerId: existing.providerId,
                date: new Date(date),
                _id: { $ne: req.params.availabilityId }
            });
            if (duplicate) {
                return res.status(409).json({
                    err: `Provider already has availability for ${new Date(date).toDateString()}`
                });
            }
            existing.date = new Date(date);
        }

        // Update other fields
        if (openingTime) existing.openingTime = openingTime;
        if (closingTime) existing.closingTime = closingTime;
        if (duration) existing.duration = parseInt(duration);
        if (isRepeating !== undefined) existing.isRepeating = isRepeating === 'true' || isRepeating === true;

        // Update break times
        if (breakStartTime && breakEndTime) {
            let breakTimesArray = [];
            if (Array.isArray(breakStartTime) && Array.isArray(breakEndTime)) {
                breakTimesArray = breakStartTime.map((start, index) => ({
                    startTime: start,
                    endTime: breakEndTime[index] || ''
                }));
            } else {
                breakTimesArray = [{
                    startTime: breakStartTime,
                    endTime: breakEndTime
                }];
            }
            existing.breakTimes = breakTimesArray;
        } else if (breakStartTime === '' && breakEndTime === '') {
            existing.breakTimes = [];
        }

        await existing.save();

        const updated = await Availability.findById(req.params.availabilityId)
            .populate('providerId', 'profile.fullName username')
            .populate('userId', 'profile.fullName username');

        res.json({ message: 'Availability updated successfully', availability: updated });
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

// DELETE availability
// Providers can delete their own, admins can delete any
router.delete('/availability/:availabilityId', verifyToken, async (req, res) => {
    try {
        const availability = await Availability.findById(req.params.availabilityId);
        if (!availability) {
            return res.status(404).json({ err: 'Availability not found' });
        }

        // Check permissions
        if (req.user.role !== 'admin' && req.user._id.toString() !== availability.providerId.toString()) {
            return res.status(403).json({ err: 'You can only delete your own availability' });
        }

        await Availability.findByIdAndDelete(req.params.availabilityId);

        res.json({ message: 'Availability deleted successfully' });
    } catch (err) {
        res.status(500).json({ err: err.message });
    }
});

module.exports = router;
