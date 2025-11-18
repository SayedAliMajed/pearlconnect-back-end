/**
 * @fileoverview Provider Management Controller for PearlConnect
 *
 * Handles provider-specific operations, profile management, and business dashboard functionality.
 * Provides endpoints for service providers to manage their profile, view statistics, and access provider-specific features.
 */

const express = require('express');
const User = require('../models/user');
const Service = require('../models/services');
const Booking = require('../models/booking');
const Review = require('../models/reviews');
const verifyToken = require('../middleware/verify-token');
const checkRole = require('../middleware/checkRole');

const router = express.Router();

// GET provider profile by ID (public view)
router.get('/:providerId', verifyToken, async (req, res) => {
  try {
    const { providerId } = req.params;

    const provider = await User.findById(providerId)
      .select('username email profile createdAt')
      .populate('profile');

    if (!provider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    if (!provider.role.includes('provider')) {
      return res.status(400).json({ err: 'User is not a service provider' });
    }

    // Get additional provider statistics
    const [servicesCount, bookingsCount, avgRating] = await Promise.all([
      Service.countDocuments({ provider: providerId }),
      Booking.countDocuments({ provider: providerId }),
      Review.aggregate([
        { $match: { providerId: providerId } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ])
    ]);

    const providerProfile = {
      ...provider.toObject(),
      businessStats: {
        totalServices: servicesCount,
        totalBookings: bookingsCount,
        averageRating: avgRating.length > 0 ? Math.round(avgRating[0].avgRating * 10) / 10 : 0
      }
    };

    res.json(providerProfile);
  } catch (err) {
    console.error('Get provider error:', err);
    res.status(500).json({ err: err.message });
  }
});

// GET current provider's profile (self-view with private data)
router.get('/me/profile', verifyToken, checkRole(['provider']), async (req, res) => {
  try {
    const providerId = req.user._id;

    const provider = await User.findById(providerId)
      .select('-hashedPassword'); // Exclude sensitive data

    if (!provider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    res.json(provider);
  } catch (err) {
    console.error('Get provider profile error:', err);
    res.status(500).json({ err: err.message });
  }
});

// PUT update provider profile (self only)
router.put('/me/profile', verifyToken, checkRole(['provider']), async (req, res) => {
  try {
    const providerId = req.user._id;
    const { firstName, lastName, phone, address } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({ err: 'First name and last name are required' });
    }

    const updateData = {
      'profile.firstName': firstName,
      'profile.lastName': lastName,
      'profile.phone': phone || '',
      'profile.address': address || ''
    };

    const updatedProvider = await User.findByIdAndUpdate(
      providerId,
      updateData,
      { new: true, runValidators: true }
    ).select('-hashedPassword');

    if (!updatedProvider) {
      return res.status(404).json({ err: 'Provider not found' });
    }

    res.json({
      message: 'Provider profile updated successfully',
      provider: updatedProvider
    });
  } catch (err) {
    console.error('Update provider profile error:', err);
    res.status(500).json({ err: err.message });
  }
});

// GET provider dashboard statistics 
router.get('/dashboard/stats', verifyToken, checkRole(['provider']), async (req, res) => {
  try {
    const providerId = req.user._id;

    
    const [
      totalServices,
      totalBookings,
      pendingBookings,
      totalReviews,
      averageRating
    ] = await Promise.all([
      // Service count
      Service.countDocuments({ provider: providerId }),

      // Booking counts
      Booking.countDocuments({ provider: providerId }),
      Booking.countDocuments({ provider: providerId, status: 'pending' }),

      // Review statistics
      Review.countDocuments({ providerId }),
      Review.aggregate([
        { $match: { providerId } },
        { $group: { _id: null, avgRating: { $avg: '$rating' } } }
      ])
    ]);

    // Calculate average rating
    const avgRating = totalReviews > 0 ?
      Math.round((averageRating[0]?.avgRating || 0) * 10) / 10 : 0;

    const dashboardStats = {
      services: {
        total: totalServices
      },
      bookings: {
        total: totalBookings,
        pending: pendingBookings
      },
      reviews: {
        total: totalReviews,
        averageRating: avgRating
      }
    };

    res.json(dashboardStats);
  } catch (err) {
    console.error('Get dashboard stats error:', err);
    res.status(500).json({ err: err.message });
  }
});

// GET provider's services list (MVP simple version)
router.get('/services', verifyToken, checkRole(['provider']), async (req, res) => {
  try {
    const providerId = req.user._id;

    // Simple service list - no pagination or complex stats for MVP
    const services = await Service.find({ provider: providerId })
      .populate('category', 'name')
      .select('title description price category createdAt')
      .sort({ createdAt: -1 });

    res.json({
      services: services.map(service => service.toObject())
    });
  } catch (err) {
    console.error('Get provider services error:', err);
    res.status(500).json({ err: err.message });
  }
});

// GET provider's reviews and ratings
router.get('/reviews', verifyToken, checkRole(['provider']), async (req, res) => {
  try {
    const providerId = req.user._id;
    const { page = 1, limit = 10, rating } = req.query;

    // Build filter
    let filter = { providerId };
    if (rating) {
      filter.rating = parseInt(rating);
    }

    // Calculate skip for pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(filter)
      .populate('bookingId')
      .populate('reviewerId', 'username profile')
      .populate('serviceId', 'title')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get rating distribution
    const ratingStats = await Review.aggregate([
      { $match: { providerId: this.convertToObjectId ? this.convertToObjectId(providerId) : providerId } },
      {
        $group: {
          _id: '$rating',
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id': -1 } }
    ]);

    // Get overall statistics
    const overallStats = await Review.aggregate([
      {
        $match: { providerId: providerId.toString() }
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratingBreakdown: {
            $push: '$rating'
          }
        }
      }
    ]);

    const stats = overallStats.length > 0 ? overallStats[0] : { totalReviews: 0, averageRating: 0 };

    // Calculate rating distribution
    const ratingDistribution = {};
    [1, 2, 3, 4, 5].forEach(rating => {
      ratingDistribution[rating] = 0;
    });
    ratingStats.forEach(stat => {
      ratingDistribution[stat._id] = stat.count;
    });

    // Get total count for pagination
    const totalReviews = await Review.countDocuments(filter);
    const totalPages = Math.ceil(totalReviews / parseInt(limit));

    res.json({
      reviews: reviews.map(review => ({
        _id: review._id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        reviewer: {
          username: review.reviewerId.username,
          name: `${review.reviewerId.profile?.firstName || ''} ${review.reviewerId.profile?.lastName || ''}`.trim(),
          avatar: review.reviewerId.profile?.avatar
        },
        service: {
          title: review.serviceId.title
        },
        booking: {
          date: review.bookingId?.date,
          timeSlot: review.bookingId?.timeSlot
        }
      })),
      stats: {
        totalReviews: stats.totalReviews,
        averageRating: Math.round(stats.averageRating * 10) / 10,
        ratingDistribution
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReviews,
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
  } catch (err) {
    console.error('Get provider reviews error:', err);
    res.status(500).json({ err: err.message });
  }
});

module.exports = router;
