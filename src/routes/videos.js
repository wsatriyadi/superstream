const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const videoController = require('../controllers/videoController');
const { apiLimiter, uploadLimiter, handleValidationErrors } = require('../middleware/security');
const {
  sanitizeFilename,
  isValidVideoMimeType,
  hasValidVideoExtension,
} = require('../utils/validators');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads/videos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    try {
      // Generate unique filename with timestamp
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext);
      
      // Sanitize the filename to prevent path traversal and injection
      const sanitizedBasename = sanitizeFilename(basename);
      const sanitizedFilename = `${sanitizedBasename}-${uniqueSuffix}${ext}`;
      
      cb(null, sanitizedFilename);
    } catch (error) {
      cb(error, null);
    }
  },
});

// Enhanced file filter with MIME type and extension validation
const fileFilter = (req, file, cb) => {
  // Validate MIME type
  if (!isValidVideoMimeType(file.mimetype)) {
    return cb(
      new Error('Invalid file type. Only video files (MP4, MPEG, MOV, AVI, MKV, WebM) are allowed.'),
      false
    );
  }

  // Validate file extension
  if (!hasValidVideoExtension(file.originalname)) {
    return cb(
      new Error('Invalid file extension. File extension does not match a valid video format.'),
      false
    );
  }

  // Additional security: check for double extensions
  const filename = file.originalname.toLowerCase();
  const doubleExtPattern = /\.(php|js|exe|sh|bat|cmd|com|pif|scr|vbs|jar)\./i;
  if (doubleExtPattern.test(filename)) {
    return cb(new Error('Invalid filename. Suspicious file extension detected.'), false);
  }

  cb(null, true);
};

// Configure multer with size limits and security settings
// Note: We set a high limit here and check against settings in middleware
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 161061273600, // 150GB maximum (checked against settings in middleware)
    files: 1, // Only allow one file per upload
    fields: 10, // Limit number of fields
    fieldSize: 1024 * 1024, // 1MB max field size
  },
});

// All video routes require authentication
router.use(requireAuth);

// Gallery page
router.get('/gallery', videoController.getGalleryPage);

// Redirect /videos to /gallery for compatibility
router.get('/videos', (req, res) => {
  res.redirect('/gallery');
});

// API Routes

// Create upload handler that accepts both video and thumbnail
const uploadFields = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      if (file.fieldname === 'video') {
        cb(null, uploadDir);
      } else if (file.fieldname === 'thumbnail') {
        const thumbnailDir = path.join(uploadDir, '../thumbnails');
        if (!fs.existsSync(thumbnailDir)) {
          fs.mkdirSync(thumbnailDir, { recursive: true });
        }
        cb(null, thumbnailDir);
      }
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      if (file.fieldname === 'video') {
        const basename = path.basename(file.originalname, ext);
        const sanitizedBasename = sanitizeFilename(basename);
        cb(null, `${sanitizedBasename}-${uniqueSuffix}${ext}`);
      } else {
        cb(null, `thumbnail-${uniqueSuffix}${ext}`);
      }
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'video') {
      if (!isValidVideoMimeType(file.mimetype) || !hasValidVideoExtension(file.originalname)) {
        return cb(new Error('Invalid video file'), false);
      }
    } else if (file.fieldname === 'thumbnail') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files allowed for thumbnails'), false);
      }
    }
    cb(null, true);
  },
  limits: {
    fileSize: parseInt(process.env.MAX_UPLOAD_SIZE || '5368709120', 10),
  },
});

// Upload video - with strict rate limiting and validation
router.post(
  '/api/videos/upload',
  uploadLimiter,
  (req, res, next) => { console.log('=== UPLOAD REQUEST RECEIVED ==='); next(); },
  uploadFields.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  videoController.checkFileSize,
  [
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Video title is required')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Description cannot exceed 5000 characters'),
    body('channelId')
      .notEmpty()
      .withMessage('Channel selection is required')
      .isMongoId()
      .withMessage('Invalid channel ID'),
    body('loopCount')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Loop count must be between 1 and 100')
      .toInt(),
  ],
  handleValidationErrors,
  videoController.uploadVideo
);

// Get all videos (with optional channel filter)
router.get('/api/videos', apiLimiter, videoController.getVideos);

// Get single video by ID
router.get('/api/videos/:id', apiLimiter, videoController.getVideoById);

// Configure multer for thumbnail uploads
const thumbnailStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const thumbnailDir = path.join(uploadDir, '../thumbnails');
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }
    cb(null, thumbnailDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `thumbnail-${uniqueSuffix}${ext}`);
  },
});

const thumbnailFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed for thumbnails'), false);
  }
};

const thumbnailUpload = multer({
  storage: thumbnailStorage,
  fileFilter: thumbnailFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for thumbnails
  },
});

// Update video
router.put(
  '/api/videos/:id',
  apiLimiter,
  thumbnailUpload.single('thumbnail'),
  [
    body('title')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('Video title cannot be empty')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Description cannot exceed 5000 characters'),
    body('channelId')
      .optional()
      .isMongoId()
      .withMessage('Invalid channel ID'),
    body('loopCount')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Loop count must be between 1 and 100')
      .toInt(),
  ],
  handleValidationErrors,
  videoController.updateVideo
);

// Delete video
router.delete('/api/videos/:id', apiLimiter, videoController.deleteVideo);

// Download video from URL
router.post(
  '/api/videos/download-url',
  uploadLimiter,
  thumbnailUpload.single('thumbnail'),
  [
    body('url')
      .trim()
      .notEmpty()
      .withMessage('URL is required')
      .isURL()
      .withMessage('Invalid URL format'),
    body('title')
      .trim()
      .notEmpty()
      .withMessage('Video title is required')
      .isLength({ min: 1, max: 200 })
      .withMessage('Title must be between 1 and 200 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 5000 })
      .withMessage('Description cannot exceed 5000 characters'),
    body('channelId')
      .notEmpty()
      .withMessage('Channel selection is required')
      .isMongoId()
      .withMessage('Invalid channel ID'),
    body('loopCount')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Loop count must be between 1 and 100')
      .toInt(),
  ],
  handleValidationErrors,
  videoController.downloadFromUrl
);

// Get download job status
router.get('/api/videos/download-status/:jobId', apiLimiter, videoController.getDownloadStatus);

// SSE endpoint for download progress
router.get('/api/videos/download-progress/:jobId', videoController.downloadProgress);


// Error handling for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
  console.log('=== MULTER ERROR ===', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        errors: ['File size exceeds the maximum allowed limit'],
      });
    }
    return res.status(400).json({
      success: false,
      errors: [error.message],
    });
  } else if (error) {
    return res.status(400).json({
      success: false,
      errors: [error.message],
    });
  }
  next();
});

module.exports = router;
