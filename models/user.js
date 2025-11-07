const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  username: {
    type: String,
    require: true,
    trim: true,
  },
  hashedPassword: {
    type: String,
    require: true,
  },
  email: {
    type: String,
    require: true,
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
