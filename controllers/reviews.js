const express = require('express');
const Review = require('../models/reviews');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// CREATE a review (authenticated users only)
router.post('/', verifyToken, async (req, res) => {
	try {
		const { bookingId, providerId, serviceId, rating, comment } = req.body;

		// Auto-set reviewerId from authenticated user (prevents spoofing)
		const reviewerId = req.user._id;

		// basic validations - allow general reviews (bookingId optional)
		if (!providerId || !serviceId) {
			return res.status(400).json({ err: 'providerId and serviceId are required' });
		}
		if (rating == null) return res.status(400).json({ err: 'rating is required' });
		if (typeof rating !== 'number' || rating < 1 || rating > 5) {
			return res.status(400).json({ err: 'rating must be a number between 1 and 5' });
		}
		if (!comment) return res.status(400).json({ err: 'comment is required' });

		const created = await Review.create({ bookingId, reviewerId, providerId, serviceId, rating, comment });
		return res.status(201).json(created);
	} catch (err) {
		console.log(err);
		return res.status(500).json({ err: 'Failed to create review' });
	}
});

// LIST all reviews
router.get('/', async (req, res) => {
	try {
		const reviews = await Review.find({}, 'bookingId reviewerId providerId serviceId rating comment createdAt');
		return res.json(reviews);
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

// LIST provider's own reviews (provider only)
router.get('/provider-reviews', verifyToken, async (req, res) => {
	try {
		const userId = req.user._id;
		const userRole = req.user.role;

		// Only allow providers or admins
		if (userRole !== 'provider' && userRole !== 'admin') {
			return res.status(403).json({ err: 'Access denied' });
		}

		const reviews = await Review.find({ providerId: userId })
			.populate('reviewerId', 'name')
			.populate('serviceId', 'title')
			.populate('bookingId')
			.sort({ createdAt: -1 });

		return res.json(reviews);
	} catch (err) {
		return res.status(500).json({ err: 'Failed to fetch reviews' });
	}
});

// get one review by id (public access)
router.get('/:reviewId', async (req, res) => {
	try {
		const review = await Review.findById(req.params.reviewId);
		if (!review) return res.status(404).json({ err: 'Review not found' });
		return res.json(review);
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

// update a review (owner or admin only)
router.patch('/:reviewId', verifyToken, async (req, res) => {
    try {
        // Find the review first to check ownership
        const existingReview = await Review.findById(req.params.reviewId);
        if (!existingReview) return res.status(404).json({ err: 'Review not found' });

        // Check if user is owner or admin
        if (req.user._id !== existingReview.reviewerId && req.user.role !== 'admin') {
            return res.status(403).json({ err: 'You can only update your own reviews or be an admin' });
        }

        // copy incoming updates but prevent changing immutable fields
        const updates = { ...req.body };
        delete updates._id;
        delete updates.createdAt;
        delete updates.reviewerId; // Prevent changing reviewerId

        // nothing to update
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ err: 'Nothing to update' });
        }

        // validate rating if provided
        if (updates.rating != null) {
            const r = updates.rating;
            if (typeof r !== 'number' || r < 1 || r > 5) {
                return res.status(400).json({ err: 'rating must be a number between 1 and 5' });
            }
        }

        const updated = await Review.findByIdAndUpdate(
            req.params.reviewId,
            updates,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ err: 'Review not found' });
        return res.json(updated);
    } catch (err) {
        return res.status(500).json({ err: err.message });
    }
});

// DELETE a review (admin only)
router.delete('/:reviewId', verifyToken, checkRole(['admin']), async (req, res) => {
	try {
		const deleted = await Review.findByIdAndDelete(req.params.reviewId);
		if (!deleted) return res.status(404).json({ err: 'Review not found' });
		return res.json({ message: 'Review deleted', _id: deleted._id });
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

module.exports = router;
