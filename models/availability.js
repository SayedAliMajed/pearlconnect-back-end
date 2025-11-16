const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const BreakTimeSchema = new mongoose.Schema({
    startTime: {
        type: String,
    },
    endTime: {
        type: String,
    }
});

const DayScheduleSchema = new mongoose.Schema({
    enabled: {
        type: Boolean,
        default: false,
    },
    startTime: {
        type: String,
        default: '09:00',
    },
    endTime: {
        type: String,
        default: '17:00',
    },
    breakTimes: [BreakTimeSchema]
});

const availabilitySchema = new mongoose.Schema({
    serviceId: {
        type: Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
        index: true,
        unique: true,
    },
    appointmentDuration: {
        type: Number,
        required: true,
        default: 60, // minutes
    },
    minimumAdvanceBooking: {
        type: Number,
        default: 60, // minutes
    },
    workingHours: {
        sunday: DayScheduleSchema,
        monday: DayScheduleSchema,
        tuesday: DayScheduleSchema,
        wednesday: DayScheduleSchema,
        thursday: DayScheduleSchema,
        friday: DayScheduleSchema,
        saturday: DayScheduleSchema,
    }
});

const Availability = mongoose.model('Availability', availabilitySchema);

module.exports = Availability;
