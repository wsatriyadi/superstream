# Download Timeout Fix

## Issue
Background video downloads were failing with "aborted" error after approximately 1 hour 10 minutes.

**Error Log:**
```
2025-12-08 17:07:03 [error]: Background video download failed {"jobId":"677e0d6a-5598-4397-8b9c-7a2f88d4c4c8","error":"aborted"}
```

## Root Cause
Bull queue jobs have a default timeout that was causing long-running download jobs to be aborted. Large video files that take more than an hour to download were being terminated.

## Solution
Added explicit timeout configuration to both the job processor and job creation:

### 1. Job Processor Configuration (`src/services/downloadQueue.js`)
```javascript
// Process download jobs with extended timeout
downloadQueue.process({ timeout: 0 }, async (job) => {
  // ... processing logic
});
```

### 2. Job Creation Configuration (`src/controllers/videoController.js`)
```javascript
const job = await downloadQueue.add({
  jobId,
  url,
  title,
  description,
  channelId,
  loopCount,
  thumbnailPath,
}, {
  timeout: 0, // No timeout for large file downloads
  attempts: 3, // Retry up to 3 times on failure
});
```

## Changes Made
- Set `timeout: 0` in `downloadQueue.process()` to disable job processing timeout
- Added job options with `timeout: 0` when adding jobs to the queue
- Added `attempts: 3` for automatic retry on failure

## Benefits
- Downloads can now run indefinitely without timeout
- Large video files (multi-GB) can be downloaded successfully
- Failed downloads will automatically retry up to 3 times
- No more "aborted" errors for long-running downloads

## Testing
To test the fix:
1. Upload a large video file (>1GB) via URL download
2. Monitor the download progress
3. Verify the download completes successfully even if it takes over 1 hour

## Notes
- The axios request already had `timeout: 0` configured, which was correct
- The issue was specifically with Bull's job timeout, not the HTTP request timeout
- Redis connection should remain stable for long-running jobs
