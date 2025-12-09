const mongoose = require('mongoose');

const streamHistorySchema = new mongoose.Schema({
  channelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Channel',
    required: true,
    index: true,
  },
  videoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Video',
    required: true,
  },
  streamKey: {
    type: String,
    required: true,
  },
  broadcastId: {
    type: String,
    required: true,
  },
  videoUrl: {
    type: String,
  },
  startedAt: {
    type: Date,
    required: true,
  },
  endedAt: {
    type: Date,
  },
  duration: {
    type: Number, // in seconds
    default: 0,
  },
  status: {
    type: String,
    enum: ['live', 'completed', 'failed'],
    default: 'live',
  },
  statistics: {
    peakViewers: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    averageViewDuration: { type: Number, default: 0 },
    chatMessages: { type: Number, default: 0 },
  },
  metadata: {
    title: String,
    description: String,
    thumbnailUrl: String,
  },
}, {
  timestamps: true,
});

streamHistorySchema.index({ startedAt: -1 });
streamHistorySchema.index({ channelId: 1, startedAt: -1 });

module.exports = mongoose.model('StreamHistory', streamHistorySchema);
