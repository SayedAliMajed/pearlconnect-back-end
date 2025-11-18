/**
 * @fileoverview Provider Availability Model for PearlConnect
 *
 * Global availability schedules for service providers. Each provider has one availability document
 * that defines their weekly recurring schedule, exceptions, and break times. This applies to all
 * services provided by the user rather than per-service availability.
 */

const mongoose = require('mongoose');

const BreakTimeSchema = new mongoose.Schema({
    startTime: {
        type: String,
        required: true,
    },
    endTime: {
        type: String,
        required: true,
    },
    reason: {
        type: String,
        default: "Break",
        enum: ["Lunch", "Meeting", "Travel", "Personal", "Maintenance", "Cleaning"]
    }
});

// Weekly recurring schedule for each day of the week
const ScheduleSchema = new mongoose.Schema({
    dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6  // 0 = Sunday, 6 = Saturday
    },
    isEnabled: {
        type: Boolean,
        default: true
    },
    startTime: {
        type: String,
        required: true  // Format: "HH:MM AM/PM" (12-hour)
    },
    endTime: {
        type: String,
        required: true  // Format: "HH:MM AM/PM" (12-hour)
    },
    slotDuration: {
        type: Number,
        required: true,
        min: 15,
        max: 480,  // 15 min to 8 hours
        default: 60  // Minutes
    },
    bufferTime: {
        type: Number,
        default: 0,    // Minutes between appointments
        min: 0,
        max: 120
    },
    breakTimes: [BreakTimeSchema]  // Breaks specific to this day
});

// Date-specific availability overrides/exceptions
const ExceptionSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        index: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    customStartTime: {
        type: String,
        validate: {
            validator: function(v) {
                return !v || /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i.test(v); // HH:MM AM/PM format
            },
            message: 'Start time must be in HH:MM AM/PM format (e.g., "09:30 AM")'
        }
    },
    customEndTime: {
        type: String,
        validate: {
            validator: function(v) {
                return !v || /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/i.test(v); // HH:MM AM/PM format
            },
            message: 'End time must be in HH:MM AM/PM format (e.g., "05:00 PM")'
        }
    },
    reason: {
        type: String,
        trim: true  // "Holiday", "Emergency", "Vacation", "Training"
    }
});

const availabilitySchema = new mongoose.Schema({
    providerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true  // One availability document per provider
    },
    // Weekly recurring schedule (what days/times they're available)
    schedules: {
        type: [ScheduleSchema],
        validate: {
            validator: function(v) {
                return v.length > 0; // Must have at least one schedule
            },
            message: 'At least one schedule is required'
        }
    },
    // Date-specific overrides and exceptions
    exceptions: [{
        type: ExceptionSchema
    }],
    // Provider settings
    timezone: {
        type: String,
        default: 'Asia/Bahrain'
    },
    advanceBookingDays: {
        type: Number,
        min: 0,
        max: 365,
        default: 30  // How far in advance can customers book
    },
    // System fields
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Indexes for efficient lookups
availabilitySchema.index({ providerId: 1 }, { unique: true });
availabilitySchema.index({ 'exceptions.date': 1 });
availabilitySchema.index({ providerId: 1, 'exceptions.date': 1 });

// Update the updatedAt field before saving
availabilitySchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = Availability;
