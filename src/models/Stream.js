const mongoose = require('mongoose');

const streamSchema = new mongoose.Schema(
  {
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: [true, 'Channel ID is required'],
      index: true,
    },
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video ID is required'],
      index: true,
    },
    broadcastId: {
      type: String,
      trim: true,
      comment: 'YouTube broadcast ID',
    },
    status: {
      type: String,
      enum: ['starting', 'active', 'stopping', 'completed', 'failed'],
      default: 'starting',
      index: true,
    },
    ffmpegProcessId: {
      type: Number,
    },
    rtmpUrl: {
      type: String,
    },
    startedAt: {
      type: Date,
    },
    endedAt: {
      type: Date,
    },
    viewerCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for active stream queries
streamSchema.index({ status: 1, startedAt: -1 });
streamSchema.index({ channelId: 1, status: 1 });

// Virtual for stream duration
streamSchema.virtual('duration').get(function () {
  if (!this.startedAt) return 0;
  const endTime = this.endedAt || new Date();
  return Math.floor((endTime - this.startedAt) / 1000); // Duration in seconds
});

// Method to check if stream is active
streamSchema.methods.isActive = function () {
  return this.status === 'active' || this.status === 'starting';
};

// Static method to get active streams count for a channel
streamSchema.statics.getActiveStreamCount = async function (channelId) {
  return await this.countDocuments({
    channelId,
    status: { $in: ['starting', 'active'] },
  });
};

const Stream = mongoose.model('Stream', streamSchema);

module.exports = Stream;
