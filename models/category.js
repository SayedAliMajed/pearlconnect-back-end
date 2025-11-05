const mongoose = require('mongoose');

const categorySchema = mongoose.Schema({
  name: {
    type: String,
    enum: ['Plumbing', 'Tutoring', 'Cleaning', 'Repair', 'Landscaping', 'Painting', 'Electrician'],
    require: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Category = mongoose.model('Category', categorySchema);

module.exports = Category;
