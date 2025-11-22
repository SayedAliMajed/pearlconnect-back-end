const express = require('express');
const Review = require('../models/reviews');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// CREATE a review (authenticated users only)
router.post('/', verifyToken, async (req, res) => {
	try {
		const { bookingId, customerId, providerId, serviceId, rating, comment } = req.body;

		// Ensure the authenticated user is the customer/reviewer
		if (req.user._id.toString() !== customerId.toString()) {
			return res.status(403).json({ err: 'You can only create reviews as yourself' });
		}

		// basic validations (bookingId is optional for general reviews)
		if (!customerId || !providerId || !serviceId) {
			return res.status(400).json({ err: 'customerId, providerId, and serviceId are required' });
		}
		if (rating == null) return res.status(400).json({ err: 'rating is required' });
		if (typeof rating !== 'number' || rating < 1 || rating > 5) {
			return res.status(400).json({ err: 'rating must be a number between 1 and 5' });
		}
		if (!comment) return res.status(400).json({ err: 'comment is required' });

		const reviewData = { customerId, providerId, serviceId, rating, comment };
		// bookingId is optional for general reviews
		if (bookingId) {
			reviewData.bookingId = bookingId;
		}

		const created = await Review.create(reviewData);
		return res.status(201).json(created);
	} catch (err) {
		console.error('Review creation error:', err);
		return res.status(500).json({ err: 'Failed to create review' });
	}
});

// LIST all reviews with optional filtering
router.get('/', async (req, res) => {
	try {
		const { serviceId, providerId } = req.query;
		let query = {};

		// Build filter query based on parameters
		if (serviceId) {
			query.serviceId = serviceId;
		}
		if (providerId) {
			query.providerId = providerId;
		}

		const reviews = await Review.find(
			query,
			'bookingId customerId providerId serviceId rating comment createdAt'
		).populate('serviceId', 'title').populate('customerId', 'username email profile.firstName profile.lastName');
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
			.populate('customerId', 'username email profile.firstName profile.lastName')
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
        if (req.user._id !== existingReview.customerId.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ err: 'You can only update your own reviews or be an admin' });
        }

        // copy incoming updates but prevent changing immutable fields
        const updates = { ...req.body };
        delete updates._id;
        delete updates.createdAt;
        delete updates.customerId; // Prevent changing customerId

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
