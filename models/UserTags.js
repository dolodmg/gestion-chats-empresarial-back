const mongoose = require('mongoose');

const userTagSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tags: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    color: {
      type: String,
      default: '#df5a98ff' 
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
});

userTagSchema.index({ userId: 1 });

module.exports = mongoose.model('UserTag', userTagSchema);