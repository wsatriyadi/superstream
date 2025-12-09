const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const settingsSchema = new mongoose.Schema(
  {
    googleClientId: {
      type: String,
      trim: true,
    },
    googleClientSecret: {
      type: String,
    },
    googleRedirectUri: {
      type: String,
      trim: true,
    },
    schedulerInterval: {
      type: Number,
      default: 5,
      min: [1, 'Scheduler interval must be at least 1 minute'],
      max: [60, 'Scheduler interval cannot exceed 60 minutes'],
      comment: 'Interval in minutes',
    },
    uploadDirectory: {
      type: String,
      default: './uploads/videos',
    },
    maxUploadSize: {
      type: Number,
      default: 5368709120, // 5GB in bytes
      min: [1048576, 'Max upload size must be at least 1MB'],
      comment: 'Maximum upload size in bytes',
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt sensitive fields before saving
settingsSchema.pre('save', function (next) {
  if (this.isModified('googleClientId') && this.googleClientId && !this.googleClientId.startsWith('encrypted:')) {
    this.googleClientId = encrypt(this.googleClientId);
  }
  if (this.isModified('googleClientSecret') && this.googleClientSecret && !this.googleClientSecret.startsWith('encrypted:')) {
    this.googleClientSecret = encrypt(this.googleClientSecret);
  }
  next();
});

// Method to get decrypted Google Client ID
settingsSchema.methods.getGoogleClientId = function () {
  return this.googleClientId ? decrypt(this.googleClientId) : null;
};

// Method to get decrypted Google Client Secret
settingsSchema.methods.getGoogleClientSecret = function () {
  return this.googleClientSecret ? decrypt(this.googleClientSecret) : null;
};

// Method to get Google Redirect URI
settingsSchema.methods.getGoogleRedirectUri = function () {
  return this.googleRedirectUri || null;
};

// Static method to get or create settings (singleton pattern)
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Static method to update settings
settingsSchema.statics.updateSettings = async function (updates) {
  let settings = await this.getSettings();
  Object.assign(settings, updates);
  await settings.save();
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
