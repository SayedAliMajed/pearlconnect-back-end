const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  hashedPassword: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    trim: true,
    default: null  // Make optional to prevent duplicate key errors
  },
  role: { 
    type: String, 
    enum: ["customer", "provider", "admin"], 
    default: "customer"  // Set default role
  },
  profile: {
    fullName: { 
      type: String, 
      trim: true,
      default: ""  // Optional string
    },
    phone: { 
      type: String, 
      trim: true,
      default: ""  // Optional string
    },
    address: { 
      type: String, 
      trim: true,
      default: ""  // Optional string
    },
  },
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    delete returnedObject.hashedPassword;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
