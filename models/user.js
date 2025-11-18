const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  hashedPassword: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
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
    firstName: { 
      type: String, 
      trim: true,
      required: true,
    },
    lastName: { 
      type: String, 
      trim: true,
      required: true,
    },
    phone: { 
      type: String, 
      trim: true,
      default: ""  // Optional string
    },
    address: {
      type: String,
      trim: true
    }
  }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    delete returnedObject.hashedPassword;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
