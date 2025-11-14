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
    try {
        const { date, openingTime, closingTime, duration, providerId, breakStartTime, breakEndTime, isRepeating } = req.body;

        // Determine providerId - providers can only set their own, admins can set any
        let targetProviderId;
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

        // Check for duplicate date for this provider
        const existingAvailability = await Availability.findOne({
            providerId: targetProviderId,
            date: date
        });

        if (existingAvailability) {
            return res.status(409).json({
                err: `Provider already has availability for ${new Date(date).toDateString()}. Please choose a different date or update existing availability.`
            });
        }

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

        const newAvailability = new Availability({
            userId: req.user._id,
            providerId: targetProviderId,
            date: date,
            openingTime: openingTime,
            closingTime: closingTime,
            duration: parseInt(duration),
            isRepeating: isRepeating === 'true' || isRepeating === true,
            breakTimes: breakTimesArray
        });

        await newAvailability.save();

        const populated = await Availability.findById(newAvailability._id)
            .populate('providerId', 'profile.fullName username')
            .populate('userId', 'profile.fullName username');

        res.status(201).json({ message: 'Availability created successfully', availability: populated });
    } catch (err) {
        if (err.code === 11000) {
            res.status(409).json({ err: 'Availability already exists for this date and provider' });
        } else {
            res.status(500).json({ err: err.message });
        }
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
                date: date,
                _id: { $ne: req.params.availabilityId }
            });
            if (duplicate) {
                return res.status(409).json({
                    err: `Provider already has availability for ${new Date(date).toDateString()}`
                });
            }
            existing.date = date;
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
