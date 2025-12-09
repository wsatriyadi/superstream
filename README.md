# Super Stream App

A web-based application to manage YouTube live streams and analytics for multiple channels. Automate video streaming to YouTube using FFmpeg with intelligent scheduling and comprehensive channel management.

## Features

- 🔐 **Secure Authentication** - Session-based authentication with Passport.js
- 📺 **Multi-Channel Management** - Connect and manage multiple YouTube channels via OAuth 2.0
- 📊 **Analytics Dashboard** - View subscriber counts, watch time, views, and active streams
- 🎬 **Video Gallery** - Upload and manage video content with metadata
- 🤖 **Automated Scheduling** - Cron-based scheduler for automatic stream initiation
- 🔄 **Smart Video Selection** - Random selection with daily streaming limits
- 📡 **Live Stream Monitoring** - Real-time monitoring of active broadcasts
- ⚙️ **Configurable Settings** - Manage API credentials and application settings

## Tech Stack

- **Backend**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Passport.js (local strategy)
- **Streaming**: FFmpeg for RTMP video streaming
- **Scheduling**: node-cron for automated tasks
- **Frontend**: EJS templating with Bootstrap 5
- **Testing**: Jest with fast-check for property-based testing

## Documentation

- **[Quick Start Guide](QUICKSTART.md)** - Get up and running in 15 minutes
- **[Installation Guide](#installation)** - Detailed installation instructions (below)
- **[Google Cloud Setup](#google-cloud-console-setup)** - Configure YouTube API access (below)
- **[Usage Guide](#application-workflow)** - Step-by-step usage instructions (below)
- **[Deployment Guide](DEPLOYMENT.md)** - Production deployment with security best practices
- **[Contributing Guide](CONTRIBUTING.md)** - How to contribute to the project
- **[Troubleshooting](#troubleshooting)** - Common issues and solutions (below)
- **[FAQ](#frequently-asked-questions-faq)** - Frequently asked questions (below)

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **MongoDB** (v5.0 or higher)
- **FFmpeg** (v4.4 or higher with libx264 and AAC support)
- **Google Cloud Console** account for YouTube API access

**New to Super Stream?** Check out the [Quick Start Guide](QUICKSTART.md) to get running in 15 minutes!

## Installation

You have two options for installing Super Stream:

### Option A: Automated Installation (Linux Only - Recommended for Production)

For Linux servers, use our automated installation script with PM2:

```bash
# Download the installation script
curl -fsSL https://raw.githubusercontent.com/yourusername/superstream/main/install-superstream.sh -o install-superstream.sh

# Run the script with your repository URL
sudo bash install-superstream.sh https://github.com/yourusername/superstream.git
```

The script will automatically:
- Install Node.js 18 and npm
- Install PM2 process manager
- Clone the repository to `/opt/superstream`
- Install dependencies
- Configure environment variables
- Start the application with PM2
- Enable auto-start on system boot

After installation, configure your `.env` file and restart:
```bash
sudo nano /opt/superstream/.env
pm2 restart superstream
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete production deployment instructions.

### Option B: Manual Installation (All Platforms)

Follow these steps carefully to set up the Super Stream application on your system.

#### 1. Install Node.js

The application requires Node.js v18 or higher.

#### Windows
1. Download the installer from [nodejs.org](https://nodejs.org/)
2. Run the installer and follow the prompts
3. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

#### macOS
Using Homebrew:
```bash
brew install node@18
```

Or download from [nodejs.org](https://nodejs.org/)

Verify installation:
```bash
node --version
npm --version
```

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify installation:
```bash
node --version
npm --version
```

### 2. Install MongoDB

The application requires MongoDB v5.0 or higher.

#### Windows
1. Download MongoDB Community Server from [mongodb.com](https://www.mongodb.com/try/download/community)
2. Run the installer
3. Choose "Complete" installation
4. Install MongoDB as a Windows Service (recommended)
5. Verify installation:
   ```cmd
   mongod --version
   ```

#### macOS
Using Homebrew:
```bash
brew tap mongodb/brew
brew install mongodb-community@5.0
brew services start mongodb-community@5.0
```

Verify installation:
```bash
mongod --version
mongo --version
```

#### Linux (Ubuntu/Debian)
```bash
# Import MongoDB public GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# Create list file for MongoDB
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list

# Update package database
sudo apt-get update

# Install MongoDB
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

Verify installation:
```bash
mongod --version
```

### 3. Install FFmpeg

FFmpeg is required for video streaming. The application needs FFmpeg v4.4 or higher with libx264 and AAC support.

#### Windows
1. Download FFmpeg from [ffmpeg.org](https://ffmpeg.org/download.html#build-windows)
2. Extract the archive to a location (e.g., `C:\ffmpeg`)
3. Add FFmpeg to your system PATH:
   - Open System Properties → Environment Variables
   - Under System Variables, find "Path" and click Edit
   - Click New and add the path to FFmpeg's bin folder (e.g., `C:\ffmpeg\bin`)
   - Click OK to save
4. Restart your terminal/command prompt
5. Verify installation:
   ```cmd
   ffmpeg -version
   ```

#### macOS
Using Homebrew:
```bash
brew install ffmpeg
```

Verify installation:
```bash
ffmpeg -version
```

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

Verify installation:
```bash
ffmpeg -version
```

**Verify FFmpeg has required codecs**:
```bash
ffmpeg -codecs | grep h264
ffmpeg -codecs | grep aac
```

You should see libx264 and AAC in the output.

### 4. Clone the Repository

```bash
git clone <repository-url>
cd super-stream-app
```

### 5. Install Application Dependencies

```bash
npm install
```

This will install all required Node.js packages including Express, Mongoose, Passport, and testing libraries.

### 6. Configure Environment Variables

Copy the example environment file:

```bash
# macOS/Linux
cp .env.example .env

# Windows
copy .env.example .env
```

Edit the `.env` file and configure all variables:

```env
# Application Environment
NODE_ENV=development
PORT=3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/superstream

# Session Security (generate a random string)
SESSION_SECRET=your-random-secret-here-min-32-characters

# Google OAuth Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/channels/oauth/callback

# File Upload Configuration
UPLOAD_DIR=./uploads/videos
MAX_UPLOAD_SIZE=5368709120

# Scheduler Configuration (in minutes)
SCHEDULER_INTERVAL=5

# FFmpeg Configuration
FFMPEG_PATH=ffmpeg

# Encryption Key (generate a random 32-character string)
ENCRYPTION_KEY=your-32-character-encryption-key
```

**Generating Secure Keys**:

For `SESSION_SECRET` and `ENCRYPTION_KEY`, generate random strings:

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

### 7. Create Initial User (Optional)

The application requires authentication. You can create an initial user by connecting to MongoDB:

```bash
mongosh superstream
```

Then run:
```javascript
db.users.insertOne({
  username: "admin",
  passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEHaSuu", // password: "admin123"
  email: "admin@example.com",
  createdAt: new Date(),
  updatedAt: new Date()
})
```

**Important**: Change this password immediately after first login in production!

### 8. Start MongoDB

Ensure MongoDB is running:

#### Windows
```cmd
net start MongoDB
```

Or if installed as a service, it should start automatically.

#### macOS
```bash
brew services start mongodb-community@5.0
```

#### Linux
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

### 9. Verify Installation

Check that all prerequisites are properly installed:

```bash
node --version    # Should be v18 or higher
npm --version     # Should be 8 or higher
mongod --version  # Should be v5.0 or higher
ffmpeg -version   # Should be v4.4 or higher
```

## Google Cloud Console Setup

To enable YouTube API access, you need to set up OAuth 2.0 credentials. This is a critical step for the application to function properly.

### 1. Create a Google Cloud Project

1. Navigate to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top of the page
3. Click "New Project" in the dialog that appears
4. Enter a project name (e.g., "Super Stream App")
5. Select your organization (if applicable)
6. Click "Create" and wait for the project to be created
7. Select your new project from the project dropdown

### 2. Enable Required YouTube APIs

The application requires two YouTube APIs to be enabled:

1. In the Cloud Console navigation menu, go to "APIs & Services" → "Library"
2. Search for "YouTube Data API v3"
   - Click on the API
   - Click "Enable"
   - Wait for the API to be enabled
3. Return to the API Library
4. Search for "YouTube Live Streaming API"
   - Click on the API
   - Click "Enable"
   - Wait for the API to be enabled

**Important**: Both APIs must be enabled for the application to work correctly.

### 3. Configure OAuth Consent Screen

Before creating credentials, you must configure the OAuth consent screen:

1. Go to "APIs & Services" → "OAuth consent screen"
2. Select **User Type**:
   - Choose "External" for testing with any Google account
   - Choose "Internal" only if you have a Google Workspace organization
3. Click "Create"
4. Fill in the **App information**:
   - App name: `Super Stream App`
   - User support email: Your email address
   - App logo: (optional)
5. Fill in **App domain** (optional for development):
   - Application home page: `http://localhost:3000`
   - Application privacy policy link: (optional)
   - Application terms of service link: (optional)
6. Fill in **Developer contact information**:
   - Email addresses: Your email address
7. Click "Save and Continue"
8. On the **Scopes** page, click "Add or Remove Scopes"
9. Add the following scopes:
   - `https://www.googleapis.com/auth/youtube.readonly` - View your YouTube account
   - `https://www.googleapis.com/auth/youtube` - Manage your YouTube account
   - `https://www.googleapis.com/auth/youtube.force-ssl` - Manage your YouTube account (SSL)
10. Click "Update" then "Save and Continue"
11. On the **Test users** page (if using External user type):
    - Click "Add Users"
    - Enter the Google account email addresses you'll use for testing
    - Click "Add"
    - Click "Save and Continue"
12. Review the summary and click "Back to Dashboard"

### 4. Create OAuth 2.0 Credentials

Now create the OAuth client credentials:

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" at the top
3. Select "OAuth client ID"
4. Choose **Application type**: "Web application"
5. Enter a **Name**: `Super Stream OAuth Client`
6. Under **Authorized JavaScript origins**, click "Add URI":
   - For development: `http://localhost:3000`
   - For production: Add your production domain (e.g., `https://yourdomain.com`)
7. Under **Authorized redirect URIs**, click "Add URI":
   - For development: `http://localhost:3000/channels/oauth/callback`
   - For production: Add your production callback URL (e.g., `https://yourdomain.com/channels/oauth/callback`)
8. Click "Create"
9. A dialog will appear with your credentials:
   - **Client ID**: Copy this value
   - **Client Secret**: Copy this value
10. Click "OK"

### 5. Configure Application with Credentials

1. Open your `.env` file
2. Paste the credentials:
   ```env
   GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_REDIRECT_URI=http://localhost:3000/channels/oauth/callback
   ```
3. Save the file

### 6. Important Notes

- **Keep credentials secure**: Never commit your `.env` file or share your Client Secret publicly
- **Test users limitation**: If using External user type in testing mode, only added test users can authenticate
- **Publishing the app**: To allow any Google account to authenticate, you must submit your app for verification (not required for personal use)
- **API Quotas**: YouTube Data API has daily quota limits. Monitor your usage in the Cloud Console
- **Redirect URI must match exactly**: The redirect URI in your `.env` file must exactly match the one configured in Google Cloud Console (including protocol, domain, port, and path)

## Usage

### Development Mode

Start the server with auto-reload:

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

The application will be available at `http://localhost:3000`

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run only property-based tests
npm run test:properties

# Run with coverage
npm test -- --coverage
```

### Linting and Formatting

```bash
# Run ESLint
npm run lint

# Fix ESLint issues
npm run lint:fix

# Format code with Prettier
npm run format
```

## Application Workflow

This section provides a step-by-step guide for using the Super Stream application.

### 1. First-Time Setup

#### Start the Application

```bash
npm start
```

The application will start on `http://localhost:3000`

#### Login

1. Open your browser and navigate to `http://localhost:3000`
2. You'll be redirected to the login page
3. Enter your credentials:
   - Username: `admin`
   - Password: `admin123` (or the password you set during installation)
4. Click "Login"
5. You'll be redirected to the dashboard

**Security Note**: Change the default password immediately in production environments!

### 2. Configure Google API Credentials

Before connecting channels, you must configure your Google API credentials:

1. Click "Settings" in the navigation menu
2. Enter your Google API credentials:
   - **Client ID**: Paste the Client ID from Google Cloud Console
   - **Client Secret**: Paste the Client Secret from Google Cloud Console
3. Click "Save Settings"
4. You should see a success message

**Important**: This step must be completed before connecting any YouTube channels.

### 3. Connect YouTube Channels

Now you can connect your YouTube channels to the application:

1. Click "Channel Management" in the navigation menu
2. Click the "Connect Channel" button
3. You'll be redirected to Google's OAuth consent screen
4. Select the Google account associated with your YouTube channel
5. Review the permissions requested:
   - View your YouTube account
   - Manage your YouTube account
   - Manage your YouTube videos
6. Click "Allow" to grant permissions
7. You'll be redirected back to the application
8. Your channel will now appear in the channel list with:
   - Channel thumbnail
   - Channel name
   - Subscriber count
   - Total views
   - Watch time

#### Configure Channel Settings

1. In the channel list, find your connected channel
2. Click "Settings" or "Edit" for that channel
3. Configure the following:
   - **Max Simultaneous Streams**: Set the maximum number of concurrent streams allowed for this channel (default: 1)
4. Click "Save"

**Note**: You can connect multiple YouTube channels by repeating this process.

### 4. Upload Videos

Upload video content that will be streamed to your channels:

1. Click "Gallery" in the navigation menu
2. Click the "Upload Video" button
3. Fill in the upload form:
   - **Video File**: Select a video file from your computer (MP4, AVI, MOV, etc.)
   - **Title**: Enter a title for the video (this will appear on YouTube)
   - **Description**: Enter a description (this will appear on YouTube)
   - **Channel**: Select which YouTube channel this video belongs to
   - **Loop Count**: Set how many times the video should loop during streaming (default: 1)
4. Click "Upload"
5. Wait for the upload to complete
6. The video will appear in your gallery

**Important Notes**:
- Each video must be associated with exactly one channel
- Videos can only be streamed to their associated channel
- Maximum file size is 5GB by default (configurable in settings)
- Supported formats: MP4, AVI, MOV, MKV, FLV, WMV

#### Managing Videos

- **View Videos**: All uploaded videos appear in the gallery with thumbnails
- **Filter by Channel**: Use the channel dropdown to view videos for a specific channel
- **Delete Videos**: Click the delete button to remove a video (this also deletes the file from disk)

### 5. Understanding the Automated Scheduler

The application includes an automated scheduler that manages livestreams:

#### How It Works

1. **Scheduler Runs Periodically**: Every N minutes (configured in `SCHEDULER_INTERVAL`)
2. **Checks Each Channel**: Evaluates if each channel is eligible for a new stream
3. **Eligibility Criteria**:
   - Channel has not reached its maximum simultaneous stream limit
   - Channel has at least one video uploaded
   - At least one video hasn't been streamed today
4. **Video Selection**: Randomly selects an eligible video that hasn't been streamed today
5. **Stream Initiation**:
   - Creates a YouTube broadcast with the video's title and description
   - Retrieves the RTMP endpoint and stream key
   - Starts FFmpeg to stream the video
   - Logs the stream in the daily log
6. **Stream Completion**: When the video finishes all loops, FFmpeg terminates and the stream ends

#### Daily Streaming Rules

- Each video can only be streamed **once per day** per channel
- At midnight (00:00), the daily log resets and all videos become eligible again
- If all videos for a channel have been streamed today, the scheduler skips that channel

### 6. Monitor Active Streams

Track your currently running livestreams:

1. Click "Live Menu" in the navigation menu
2. View all active streams with:
   - Video thumbnail
   - Video title
   - Associated channel name
   - Stream duration (how long it's been running)
   - Current viewer count (if available from YouTube)
3. **Manual Stop**: Click "Stop Stream" to manually terminate a stream

**Note**: Streams automatically appear here when started by the scheduler or manually.

### 7. View Analytics Dashboard

Monitor your channel performance:

1. Click "Dashboard" in the navigation menu
2. View aggregate statistics across all channels:
   - Total subscribers
   - Total views
   - Total watch time
   - Number of active streams
3. View individual channel statistics:
   - Each channel shows its own metrics
   - Click on a channel to view detailed information

**Note**: Statistics are refreshed periodically from the YouTube Data API.

### 8. Advanced Configuration

#### Adjust Scheduler Interval

To change how often the scheduler runs:

1. Stop the application
2. Edit your `.env` file
3. Change `SCHEDULER_INTERVAL` (value in minutes)
4. Restart the application

#### Adjust Upload Limits

To change the maximum upload file size:

1. Edit your `.env` file
2. Change `MAX_UPLOAD_SIZE` (value in bytes)
3. Restart the application

Example: For 10GB limit: `MAX_UPLOAD_SIZE=10737418240`

### 9. Best Practices

- **Upload Quality Content**: Ensure videos are properly encoded and have good quality
- **Set Appropriate Loop Counts**: For longer streams, increase the loop count
- **Monitor Daily Limits**: Keep track of which videos have been streamed each day
- **Check Stream Health**: Regularly monitor the Live Menu for any issues
- **Manage Channel Limits**: Adjust max simultaneous streams based on your bandwidth and YouTube limits
- **Regular Backups**: Backup your MongoDB database and uploaded videos regularly

## Project Structure

```
super-stream-app/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   ├── views/           # EJS templates
│   └── index.js         # Application entry point
├── tests/
│   ├── unit/            # Unit tests
│   ├── properties/      # Property-based tests
│   └── integration/     # Integration tests
├── uploads/             # Uploaded video files
├── .env.example         # Environment variables template
├── package.json         # Dependencies and scripts
└── README.md            # This file
```

## Troubleshooting

This section covers common issues and their solutions.

### Application Won't Start

#### Error: "Cannot find module"
**Cause**: Missing dependencies

**Solution**:
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Error: "Port 3000 is already in use"
**Cause**: Another application is using port 3000

**Solution**:
- Change the `PORT` in your `.env` file to a different port (e.g., 3001)
- Or stop the other application using port 3000

#### Error: "MONGODB_URI is not defined"
**Cause**: Environment variables not loaded

**Solution**:
- Ensure `.env` file exists in the project root
- Verify all required variables are set
- Restart the application

### MongoDB Connection Issues

#### Error: "MongoServerError: Authentication failed"
**Cause**: MongoDB requires authentication but credentials are not provided

**Solution**:
- Update `MONGODB_URI` in `.env` to include credentials:
  ```env
  MONGODB_URI=mongodb://username:password@localhost:27017/superstream
  ```

#### Error: "MongooseServerSelectionError: connect ECONNREFUSED"
**Cause**: MongoDB is not running

**Solution**:

**Windows**:
```cmd
net start MongoDB
```

**macOS**:
```bash
brew services start mongodb-community@5.0
```

**Linux**:
```bash
sudo systemctl start mongod
sudo systemctl status mongod
```

#### Error: "MongoParseError: Invalid connection string"
**Cause**: Malformed MongoDB URI

**Solution**:
- Check the format: `mongodb://localhost:27017/superstream`
- Ensure no extra spaces or special characters
- For MongoDB Atlas, use the full connection string provided

### FFmpeg Issues

#### Error: "FFmpeg not found" or "spawn ffmpeg ENOENT"
**Cause**: FFmpeg is not installed or not in PATH

**Solution**:

1. Verify FFmpeg is installed:
   ```bash
   ffmpeg -version
   ```

2. If not installed, install FFmpeg (see Installation section)

3. If installed but not found:
   - **Windows**: Add FFmpeg to system PATH or set full path in `.env`:
     ```env
     FFMPEG_PATH=C:\ffmpeg\bin\ffmpeg.exe
     ```
   - **macOS/Linux**: Set full path in `.env`:
     ```env
     FFMPEG_PATH=/usr/local/bin/ffmpeg
     ```

#### Error: "Unknown encoder 'libx264'"
**Cause**: FFmpeg was compiled without H.264 support

**Solution**:
- Reinstall FFmpeg with full codec support
- On Linux, install from official repositories or use a static build
- Verify codecs: `ffmpeg -codecs | grep h264`

#### Stream Starts But No Video on YouTube
**Cause**: Incorrect RTMP URL or stream key

**Solution**:
- Check application logs for FFmpeg errors
- Verify the YouTube broadcast was created successfully
- Ensure your YouTube channel is enabled for live streaming
- Check YouTube Studio for stream health indicators

### YouTube API Issues

#### Error: "Invalid client_id or client_secret"
**Cause**: Incorrect Google OAuth credentials

**Solution**:
1. Verify credentials in Google Cloud Console
2. Copy the exact Client ID and Client Secret
3. Update `.env` file with correct values
4. Restart the application

#### Error: "redirect_uri_mismatch"
**Cause**: Redirect URI doesn't match Google Cloud Console configuration

**Solution**:
1. Check `GOOGLE_REDIRECT_URI` in `.env`
2. Go to Google Cloud Console → Credentials
3. Edit your OAuth client
4. Ensure the redirect URI matches exactly (including protocol, domain, port, and path)
5. Common correct format: `http://localhost:3000/channels/oauth/callback`

#### Error: "Access blocked: This app's request is invalid"
**Cause**: OAuth consent screen not properly configured

**Solution**:
1. Go to Google Cloud Console → OAuth consent screen
2. Ensure all required fields are filled
3. Add your Google account as a test user
4. Save changes and try again

#### Error: "The caller does not have permission"
**Cause**: Required YouTube APIs are not enabled

**Solution**:
1. Go to Google Cloud Console → APIs & Services → Library
2. Enable "YouTube Data API v3"
3. Enable "YouTube Live Streaming API"
4. Wait a few minutes for changes to propagate

#### Error: "Quota exceeded"
**Cause**: You've exceeded YouTube API daily quota limits

**Solution**:
- YouTube Data API has a default quota of 10,000 units per day
- Check usage in Google Cloud Console → APIs & Services → Dashboard
- Wait until quota resets (midnight Pacific Time)
- Request quota increase if needed for production use

### File Upload Issues

#### Error: "File too large"
**Cause**: File exceeds `MAX_UPLOAD_SIZE` limit

**Solution**:
- Increase `MAX_UPLOAD_SIZE` in `.env` (value in bytes)
- For 10GB: `MAX_UPLOAD_SIZE=10737418240`
- Restart the application

#### Error: "ENOSPC: no space left on device"
**Cause**: Insufficient disk space

**Solution**:
- Free up disk space
- Change `UPLOAD_DIR` to a location with more space
- Delete old videos from the gallery

#### Error: "EACCES: permission denied"
**Cause**: Application doesn't have write permissions

**Solution**:

**macOS/Linux**:
```bash
chmod -R 755 uploads/
```

**Windows**:
- Right-click the uploads folder → Properties → Security
- Ensure your user has write permissions

#### Upload Succeeds But Video Won't Stream
**Cause**: Video codec incompatibility

**Solution**:
- Re-encode the video with compatible codecs:
  ```bash
  ffmpeg -i input.mp4 -c:v libx264 -c:a aac -strict experimental output.mp4
  ```
- Upload the re-encoded video

### Scheduler Issues

#### Scheduler Not Starting Streams
**Cause**: Multiple possible reasons

**Solution**:

1. **Check logs** for specific errors:
   ```bash
   tail -f logs/combined-*.log
   ```

2. **Verify channel is connected**:
   - Go to Channel Management
   - Ensure at least one channel is connected

3. **Verify videos are uploaded**:
   - Go to Gallery
   - Ensure videos are associated with the channel

4. **Check daily limits**:
   - If all videos were streamed today, wait until midnight
   - Or upload new videos

5. **Check channel stream limit**:
   - Ensure max simultaneous streams is not set to 0
   - Ensure current active streams < max limit

6. **Verify scheduler interval**:
   - Check `SCHEDULER_INTERVAL` in `.env`
   - Ensure it's a reasonable value (e.g., 5 minutes)

#### Scheduler Runs But Skips All Channels
**Cause**: No eligible videos or channels

**Solution**:
- Check logs for "No eligible videos" messages
- Verify videos haven't all been streamed today
- Ensure videos are properly associated with channels
- Check that channels have available stream slots

### Authentication Issues

#### Can't Login - "Invalid credentials"
**Cause**: Incorrect username or password

**Solution**:
- Verify username and password
- Reset password in MongoDB if needed:
  ```javascript
  // Connect to MongoDB
  mongosh superstream
  
  // Update password (this sets password to "newpassword123")
  db.users.updateOne(
    { username: "admin" },
    { $set: { passwordHash: "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYIeWEHaSuu" } }
  )
  ```

#### Session Expires Immediately
**Cause**: Invalid `SESSION_SECRET` or session configuration issue

**Solution**:
- Generate a new `SESSION_SECRET`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Update `.env` with the new secret
- Restart the application
- Clear browser cookies and try again

### Stream Quality Issues

#### Stream is Laggy or Buffering
**Cause**: Insufficient upload bandwidth or encoding settings

**Solution**:
- Check your internet upload speed
- Reduce video bitrate before uploading
- Reduce number of simultaneous streams
- Use hardware acceleration if available

#### Stream Has No Audio
**Cause**: Video file has no audio track or incompatible audio codec

**Solution**:
- Verify the source video has audio
- Re-encode with AAC audio:
  ```bash
  ffmpeg -i input.mp4 -c:v copy -c:a aac output.mp4
  ```

### General Debugging

#### Enable Debug Logging

Set `NODE_ENV=development` in `.env` for more verbose logging.

#### Check Application Logs

Logs are stored in the `logs/` directory:
- `combined-*.log`: All logs
- `error-*.log`: Error logs only

View recent logs:
```bash
# macOS/Linux
tail -f logs/combined-*.log

# Windows
type logs\combined-*.log
```

#### Check FFmpeg Logs

FFmpeg output is logged when streams are active. Check application logs for FFmpeg stderr output.

#### Test YouTube API Connection

Use the Google OAuth Playground to test your credentials:
1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Configure with your Client ID and Secret
3. Test YouTube API scopes

### Getting Help

If you're still experiencing issues:

1. **Check the logs**: Most errors are logged with detailed information
2. **Search existing issues**: Check the repository's issue tracker
3. **Create a new issue**: Include:
   - Error message (full stack trace)
   - Steps to reproduce
   - Environment details (OS, Node version, MongoDB version)
   - Relevant log excerpts
   - Configuration (sanitize sensitive data)

### Common Error Messages Reference

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| `ECONNREFUSED` | Service not running | Start MongoDB/check network |
| `ENOENT` | File/command not found | Check paths and installations |
| `EACCES` | Permission denied | Fix file permissions |
| `ENOSPC` | No disk space | Free up space |
| `401 Unauthorized` | Invalid credentials | Check API keys |
| `403 Forbidden` | Insufficient permissions | Check OAuth scopes |
| `404 Not Found` | Resource doesn't exist | Verify IDs and URLs |
| `429 Too Many Requests` | Rate limit exceeded | Wait and retry |
| `500 Internal Server Error` | Server-side error | Check logs for details |

## Architecture Overview

### System Design

Super Stream follows a three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (EJS + Bootstrap)                │
│              Dashboard | Gallery | Live Menu | Settings      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
┌────────────────────────▼────────────────────────────────────┐
│                   Express.js Application                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Controllers  │  │  Middleware  │  │   Services   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    MongoDB Database                          │
│     Users | Channels | Videos | Streams | Settings          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                  Background Processes                         │
│  ┌────────────────────┐      ┌────────────────────┐         │
│  │ Stream Scheduler   │      │  FFmpeg Processes  │         │
│  │   (node-cron)      │─────▶│   (child_process)  │         │
│  └────────────────────┘      └────────────────────┘         │
└──────────────────────────────────────────────────────────────┘
                                        │
                                        │ RTMP
                                        ▼
                              ┌──────────────────┐
                              │  YouTube Live    │
                              │   Streaming      │
                              └──────────────────┘
```

### Key Components

- **Authentication Layer**: Passport.js with session-based authentication
- **Channel Management**: OAuth 2.0 integration with YouTube
- **Video Management**: Multer for uploads, file system storage
- **Stream Scheduler**: Cron-based automation with business rules
- **FFmpeg Manager**: Child process management for video streaming
- **YouTube API Integration**: googleapis for channel data and broadcast management

### Data Flow

1. **User uploads video** → Stored in file system + metadata in MongoDB
2. **Scheduler runs** → Checks eligibility → Selects random video
3. **Creates YouTube broadcast** → Gets RTMP endpoint
4. **Spawns FFmpeg** → Streams video to YouTube
5. **Logs stream** → Records in daily log to prevent re-streaming

## Security Considerations

### Critical Security Practices

#### Environment Variables
- **Never commit `.env` file** to version control
- Add `.env` to `.gitignore`
- Use strong, random values for `SESSION_SECRET` (min 32 characters)
- Use strong, random values for `ENCRYPTION_KEY` (exactly 32 characters)
- Generate secrets using cryptographically secure methods:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

#### Authentication & Sessions
- Change default passwords immediately
- Use bcrypt for password hashing (configured with 12+ salt rounds)
- Session cookies are httpOnly and secure (HTTPS only in production)
- Implement session timeout (default: 24 hours)
- Clear sessions on logout

#### API Credentials
- OAuth tokens are encrypted at rest using AES-256
- Google API credentials stored encrypted in database
- Never log or expose credentials in error messages
- Rotate credentials regularly (every 90 days recommended)
- Use environment-specific credentials (dev vs production)

#### File Upload Security
- File size limits enforced (default: 5GB)
- MIME type validation on server side
- File names sanitized to prevent path traversal
- Uploaded files stored outside web root
- Consider implementing virus scanning for production

#### Database Security
- Use MongoDB authentication in production
- Create dedicated database user with minimal privileges
- Use connection string with authentication
- Enable MongoDB access control
- Regular backups with encryption

#### FFmpeg Security
- All inputs to FFmpeg commands are sanitized
- Prevent command injection by using parameterized execution
- Run FFmpeg processes with limited privileges
- Implement resource limits (CPU, memory, time)
- Monitor and kill runaway processes

#### Network Security
- **Enable HTTPS in production** (required for OAuth)
- Use helmet.js for security headers (already configured)
- Implement rate limiting on all endpoints
- Configure CORS with strict origin policies
- Use secure session cookies (secure flag enabled in production)

#### Dependency Security
- Regularly update dependencies: `npm audit`
- Fix vulnerabilities: `npm audit fix`
- Review dependency licenses
- Use `npm ci` in production for reproducible builds

### Production Deployment Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Use strong, unique secrets for `SESSION_SECRET` and `ENCRYPTION_KEY`
- [ ] Enable MongoDB authentication
- [ ] Configure firewall rules (allow only necessary ports)
- [ ] Set up log rotation
- [ ] Implement automated backups
- [ ] Configure process manager (PM2) with restart policies
- [ ] Set up monitoring and alerting
- [ ] Review and restrict file permissions
- [ ] Disable debug logging
- [ ] Configure rate limiting
- [ ] Set up intrusion detection
- [ ] Regular security audits

### Security Best Practices

1. **Principle of Least Privilege**: Grant minimum necessary permissions
2. **Defense in Depth**: Multiple layers of security controls
3. **Fail Securely**: Errors should not expose sensitive information
4. **Keep Software Updated**: Regular updates for all dependencies
5. **Monitor and Log**: Track security-relevant events
6. **Incident Response Plan**: Prepare for security incidents
7. **Regular Backups**: Automated, encrypted, tested backups
8. **Security Testing**: Regular penetration testing and vulnerability scans

## Frequently Asked Questions (FAQ)

### General Questions

**Q: Can I use this application for commercial purposes?**
A: Yes, but ensure you comply with YouTube's Terms of Service and API usage policies. Monitor your API quota usage.

**Q: How many channels can I connect?**
A: There's no hard limit in the application, but YouTube API quota limits may restrict the number of channels you can effectively manage.

**Q: Can I stream to platforms other than YouTube?**
A: Currently, the application only supports YouTube. Adding support for other platforms would require significant modifications.

**Q: Is this application free to use?**
A: The application itself is open source, but you're responsible for your own hosting costs, bandwidth, and YouTube API usage.

### Technical Questions

**Q: Why does each video only stream once per day?**
A: This is a business rule to prevent repetitive content and comply with platform guidelines. The daily log resets at midnight.

**Q: Can I manually start a stream instead of using the scheduler?**
A: Currently, streams are only initiated by the automated scheduler. Manual streaming could be added as a feature enhancement.

**Q: What video formats are supported?**
A: Any format that FFmpeg can read (MP4, AVI, MOV, MKV, FLV, WMV, etc.). For best results, use H.264 video with AAC audio.

**Q: How much bandwidth do I need?**
A: This depends on your video bitrate and number of simultaneous streams. For 1080p at 6 Mbps, you need at least 6 Mbps upload per stream.

**Q: Can I run multiple instances of the application?**
A: Yes, but you'll need to implement distributed locking for the scheduler to prevent conflicts. Use Redis or a similar solution.

**Q: Does the application support hardware encoding?**
A: FFmpeg can use hardware acceleration if available (NVENC, QuickSync, etc.). Configure this in the FFmpeg command generation.

### Troubleshooting Questions

**Q: Why isn't my stream appearing on YouTube?**
A: Check that:
- Your YouTube channel is enabled for live streaming
- The broadcast was created successfully (check logs)
- FFmpeg is running without errors
- Your RTMP connection is stable

**Q: Why do I get "Quota exceeded" errors?**
A: YouTube Data API has daily quota limits (10,000 units by default). Each API call consumes units. Wait for quota reset or request an increase.

**Q: Can I increase the video upload size limit?**
A: Yes, change `MAX_UPLOAD_SIZE` in `.env`. Note that larger files require more disk space and upload time.

**Q: Why are my streams ending prematurely?**
A: Check:
- FFmpeg logs for errors
- Your internet connection stability
- YouTube stream health in YouTube Studio
- Server resource usage (CPU, memory)

**Q: How do I backup my data?**
A: Backup both:
- MongoDB database: `mongodump --db superstream --out /backup/path`
- Uploaded videos: Copy the `uploads/` directory

### Feature Questions

**Q: Can I schedule streams for specific times?**
A: Currently, the scheduler runs at fixed intervals. Time-based scheduling would require code modifications.

**Q: Can I stream the same video to multiple channels simultaneously?**
A: No, each video is associated with one channel. Upload the video multiple times for different channels.

**Q: Can I edit video metadata after upload?**
A: This feature is not currently implemented but could be added as an enhancement.

**Q: Can I see stream analytics after a stream ends?**
A: The application tracks basic information. For detailed analytics, use YouTube Studio.

## Performance Optimization

### Database Optimization

- **Indexes**: The application creates indexes on frequently queried fields
- **Connection Pooling**: Mongoose handles connection pooling automatically
- **Lean Queries**: Use `.lean()` for read-only operations to improve performance

### File Storage Optimization

- **Use SSD Storage**: Store videos on fast SSD drives for better streaming performance
- **Disk Space Monitoring**: Implement alerts when disk space is low
- **File Cleanup**: Regularly remove deleted videos from disk

### FFmpeg Optimization

- **Hardware Acceleration**: Enable GPU encoding if available:
  ```bash
  # NVIDIA
  ffmpeg -hwaccel cuda -i input.mp4 ...
  
  # Intel QuickSync
  ffmpeg -hwaccel qsv -i input.mp4 ...
  ```

- **Encoding Presets**: Balance quality and performance:
  - `ultrafast`: Lowest CPU usage, larger file size
  - `fast`: Good balance for live streaming
  - `medium`: Default, good quality
  - `slow`: Better quality, higher CPU usage

- **Concurrent Streams**: Limit based on server capacity:
  - Monitor CPU and memory usage
  - Adjust `maxSimultaneousStreams` per channel
  - Consider dedicated streaming servers for production

### Application Performance

- **Caching**: Implement Redis for session storage in production
- **Load Balancing**: Use nginx or similar for multiple application instances
- **Process Management**: Use PM2 with cluster mode for better resource utilization
- **Monitoring**: Implement APM tools (New Relic, DataDog, etc.)

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `npm test`
5. Follow the existing code style
6. Commit with clear messages
7. Push to your fork
8. Create a Pull Request

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Format code
npm run format
```

### Code Style

- Use ESLint and Prettier (configured in the project)
- Follow existing patterns and conventions
- Write meaningful variable and function names
- Add comments for complex logic
- Write tests for new features

## Roadmap

Potential future enhancements:

- [ ] Multi-platform support (Twitch, Facebook Live)
- [ ] Manual stream initiation
- [ ] Time-based scheduling (stream at specific times)
- [ ] Stream templates and presets
- [ ] Advanced analytics dashboard
- [ ] Video editing capabilities
- [ ] Playlist support
- [ ] Stream overlays and graphics
- [ ] Webhook notifications
- [ ] REST API for external integrations
- [ ] Mobile application
- [ ] Docker containerization
- [ ] Kubernetes deployment support

## License

MIT License - See LICENSE file for details

## Acknowledgments

- Express.js team for the excellent web framework
- MongoDB team for the robust database
- FFmpeg team for the powerful video processing tool
- Google for YouTube APIs
- All open source contributors

## Support

### Getting Help

- **Documentation**: Read this README thoroughly
- **Issues**: Check existing issues on the repository
- **Discussions**: Use GitHub Discussions for questions
- **Bug Reports**: Open an issue with detailed information

### Reporting Issues

When reporting issues, please include:

1. **Environment Information**:
   - Operating System and version
   - Node.js version
   - MongoDB version
   - FFmpeg version

2. **Steps to Reproduce**:
   - Detailed steps to reproduce the issue
   - Expected behavior
   - Actual behavior

3. **Logs and Errors**:
   - Relevant log excerpts
   - Full error messages and stack traces
   - Screenshots if applicable

4. **Configuration**:
   - Relevant `.env` settings (sanitize sensitive data)
   - Any custom modifications

### Contact

For questions and support:
- Open an issue on GitHub
- Check the documentation
- Review existing issues and discussions

---

**Note**: This application is provided as-is without warranty. Use at your own risk. Always comply with YouTube's Terms of Service and API usage policies.
