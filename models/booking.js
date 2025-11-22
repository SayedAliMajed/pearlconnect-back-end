const mongoose = require('mongoose');

/**
 * Booking Model for PearlConnect
 *
 * Represents a service booking transaction between a customer and a service provider.
 * Links to the service being booked, the customer making the booking, and the provider
 * who will perform the service.
 */

const bookingSchema = new mongoose.Schema({
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  providerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  timeSlot: {
    type: String,
    required: true,  // Format: "HH:MM AM/PM" (e.g., "02:30 PM")
    validate: {
      validator: function(v) {
        return /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i.test(v);
      },
      message: 'Time slot must be in HH:MM AM/PM format (e.g., "09:30 AM")'
    }
  },
  status: {
    type: String,
    enum: ["pending", "confirmed", "completed", "cancelled"],
    default: "pending",
  },
  messages: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
  },
},
  { timestamps: true }
);

// Index for efficient conflict detection queries
bookingSchema.index({ providerId: 1, date: 1, timeSlot: 1 });
bookingSchema.index({ customerId: 1, createdAt: -1 });

// Virtual for formatted display date/time
bookingSchema.virtual('formattedDateTime').get(function() {
  return `${this.date.toISOString().split('T')[0]} ${this.timeSlot}`;
});

// Ensure virtual fields are serialised
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
