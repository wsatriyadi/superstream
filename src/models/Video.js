const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: [true, 'Channel ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    filePath: {
      type: String,
      required: [true, 'File path is required'],
    },
    fileName: {
      type: String,
      required: [true, 'File name is required'],
    },
    fileSize: {
      type: Number,
      min: 0,
    },
    duration: {
      type: Number,
      min: 0,
      comment: 'Duration in seconds',
    },
    loopCount: {
      type: Number,
      default: 1,
      min: [1, 'Loop count must be at least 1'],
      max: [100, 'Loop count cannot exceed 100'],
    },
    thumbnailPath: {
      type: String,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for channel association queries
videoSchema.index({ channelId: 1, createdAt: -1 });

// Virtual for checking if video exists on disk
videoSchema.virtual('exists').get(function () {
  const fs = require('fs');
  try {
    return fs.existsSync(this.filePath);
  } catch (error) {
    return false;
  }
});

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
