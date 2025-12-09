const mongoose = require('mongoose');

const dailyStreamLogSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Video',
      required: [true, 'Video ID is required'],
      index: true,
    },
    channelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Channel',
      required: [true, 'Channel ID is required'],
      index: true,
    },
    streamDate: {
      type: Date,
      required: [true, 'Stream date is required'],
      comment: 'Date only, no time component',
    },
    streamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Stream',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast lookups - critical for performance
dailyStreamLogSchema.index({ videoId: 1, streamDate: 1 });
dailyStreamLogSchema.index({ channelId: 1, streamDate: 1 });

// Pre-save hook to normalize date (remove time component)
dailyStreamLogSchema.pre('save', function (next) {
  if (this.streamDate) {
    // Set time to midnight UTC
    const date = new Date(this.streamDate);
    date.setUTCHours(0, 0, 0, 0);
    this.streamDate = date;
  }
  next();
});

// Static method to check if video was streamed today
dailyStreamLogSchema.statics.hasStreamedToday = async function (videoId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const log = await this.findOne({
    videoId,
    streamDate: today,
  });

  return !!log;
};

// Static method to get all videos streamed today for a channel
dailyStreamLogSchema.statics.getTodayStreamedVideos = async function (channelId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const logs = await this.find({
    channelId,
    streamDate: today,
  }).select('videoId');

  return logs.map((log) => log.videoId);
};

// Static method to create log entry
dailyStreamLogSchema.statics.createLog = async function (videoId, channelId, streamId) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return await this.create({
    videoId,
    channelId,
    streamDate: today,
    streamId,
  });
};

const DailyStreamLog = mongoose.model('DailyStreamLog', dailyStreamLogSchema);

module.exports = DailyStreamLog;
