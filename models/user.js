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
    trim: true
  },
  role: { 
    type: String, 
    enum: ["customer", "provider", "admin"], 
    required: true
   },
   profile: {
      fullName: { 
      type: String, 
      trim: true 
    },
      phone: { 
      type: String, 
      trim: true 
    },
      address: { 
      type: String, 
        trim: true 
    },
    },
  },
  { timestamps: true }
);


userSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    delete returnedObject.hashedPassword;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
