const express = require('express');
const Review = require('../models/reviews');

const router = express.Router();

// CREATE a review
router.post('/', async (req, res) => {
	try {
		const { bookingId, reviewerId, providerId, serviceId, rating, comment } = req.body;

		// basic validations (keep it simple and consistent with other controllers)
		if (!bookingId || !reviewerId || !providerId || !serviceId) {
			return res.status(400).json({ err: 'bookingId, reviewerId, providerId, and serviceId are required' });
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

// get one review by id
router.get('/:id', async (req, res) => {
	try {
		const review = await Review.findById(req.params.id);
		if (!review) return res.status(404).json({ err: 'Review not found' });
		return res.json(review);
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

// update a review (allow updating any review fields)
router.patch('/:id', async (req, res) => {
    try {
        // copy incoming updates but prevent changing immutable fields
        const updates = { ...req.body };
        delete updates._id;
        delete updates.createdAt;

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
            req.params.id,
            updates,
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ err: 'Review not found' });
        return res.json(updated);
    } catch (err) {
        return res.status(500).json({ err: err.message });
    }
});

// deletle a review
router.delete('/:id', async (req, res) => {
	try {
		const deleted = await Review.findByIdAndDelete(req.params.id);
		if (!deleted) return res.status(404).json({ err: 'Review not found' });
		return res.json({ message: 'Review deleted', _id: deleted._id });
	} catch (err) {
		return res.status(500).json({ err: err.message });
	}
});

module.exports = router;
