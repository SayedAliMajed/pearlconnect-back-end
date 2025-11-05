const bookingSchema = new mongoose.Schema({

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true,

  },

  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  date: {
    type: Date,
    required: true,
  },

  status: {
    type: String,
    enum: ["pending", "confirmed", "completed", "cancelled"],
  },

  messages: [messageSchema], 

});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;