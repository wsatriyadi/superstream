const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const channelSchema = new mongoose.Schema(
  {
    channelId: {
      type: String,
      required: [true, 'YouTube channel ID is required'],
      unique: true,
      trim: true,
    },
    channelName: {
      type: String,
      required: [true, 'Channel name is required'],
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    accessToken: {
      type: String,
      required: [true, 'Access token is required'],
    },
    refreshToken: {
      type: String,
      required: [true, 'Refresh token is required'],
    },
    tokenExpiry: {
      type: Date,
    },
    maxSimultaneousStreams: {
      type: Number,
      default: 1,
      min: [1, 'Maximum simultaneous streams must be at least 1'],
      max: [10, 'Maximum simultaneous streams cannot exceed 10'],
    },
    subscriberCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalWatchTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    lastSyncedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt tokens before saving
channelSchema.pre('save', function (next) {
  if (this.isModified('accessToken') && !this.accessToken.startsWith('encrypted:')) {
    this.accessToken = encrypt(this.accessToken);
  }
  if (this.isModified('refreshToken') && !this.refreshToken.startsWith('encrypted:')) {
    this.refreshToken = encrypt(this.refreshToken);
  }
  next();
});

// Method to get decrypted access token
channelSchema.methods.getAccessToken = function () {
  return decrypt(this.accessToken);
};

// Method to get decrypted refresh token
channelSchema.methods.getRefreshToken = function () {
  return decrypt(this.refreshToken);
};

// Index for faster lookups
channelSchema.index({ channelId: 1 });

const Channel = mongoose.model('Channel', channelSchema);

module.exports = Channel;
