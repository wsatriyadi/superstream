# Background Download dengan Real-time Progress

## Deskripsi
Fitur ini memungkinkan download video dari URL eksternal berjalan di background server. Download akan terus berlanjut meskipun browser ditutup, dan progress dapat dimonitor secara real-time dengan informasi detail.

## Fitur Utama

### 1. **Background Processing**
- Download berjalan di server menggunakan Bull job queue
- Tidak terpengaruh jika user menutup browser
- Job queue persistent menggunakan Redis

### 2. **Real-time Progress**
- **Persentase download**: 0-100%
- **Ukuran terunduh**: X MB / Y MB
- **Kecepatan download**: Z MB/s
- Update setiap 0.5 detik

### 3. **Resume Monitoring**
- Jika browser ditutup dan dibuka lagi, progress otomatis dilanjutkan
- Menggunakan localStorage untuk menyimpan job ID
- Auto-reconnect ke SSE stream

### 4. **Active Downloads Section**
- Menampilkan semua download yang sedang berjalan
- Progress bar visual dengan animasi
- Informasi detail real-time

## Teknologi

### Backend
- **Bull**: Job queue untuk background processing
- **Redis**: Storage untuk job queue
- **Server-Sent Events (SSE)**: Real-time communication
- **Axios**: HTTP client dengan progress tracking

### Frontend
- **EventSource API**: Untuk menerima SSE
- **localStorage**: Persist job ID
- **Bootstrap**: UI components

## Arsitektur

```
User Submit URL
     ↓
Create Job → Redis Queue
     ↓
Return Job ID (202 Accepted)
     ↓
Client Connect SSE
     ↓
Worker Process Job
     ↓
Send Progress via SSE
     ↓
Client Update UI
     ↓
Job Complete → Reload Page
```

## API Endpoints

### 1. Start Download
```
POST /api/videos/download-url
Content-Type: multipart/form-data

Response (202):
{
  "success": true,
  "message": "Download started",
  "jobId": "uuid-here",
  "queueJobId": 123
}
```

### 2. Get Job Status
```
GET /api/videos/download-status/:jobId

Response:
{
  "success": true,
  "jobId": "uuid-here",
  "state": "active",
  "progress": {
    "loaded": 12345678,
    "total": 50000000,
    "percent": 25,
    "speed": 1048576
  }
}
```

### 3. SSE Progress Stream
```
GET /api/videos/download-progress/:jobId

Response (text/event-stream):
data: {"loaded":12345678,"total":50000000,"percent":25,"speed":1048576}

data: {"loaded":25000000,"total":50000000,"percent":50,"speed":2097152}

data: {"state":"completed","percent":100}
```

## Job States

- **waiting**: Job dalam antrian
- **active**: Download sedang berjalan
- **completed**: Download selesai
- **failed**: Download gagal

## Progress Data Structure

```javascript
{
  loaded: 12345678,      // Bytes downloaded
  total: 50000000,       // Total bytes (0 if unknown)
  percent: 25,           // Percentage (0-100)
  speed: 1048576,        // Bytes per second
  state: 'active'        // Job state
}
```

## Cara Kerja

### 1. User Memulai Download
```javascript
// Submit form
POST /api/videos/download-url
→ Job created with unique ID
→ Store jobId in localStorage
→ Close modal
→ Show in Active Downloads section
```

### 2. Monitor Progress
```javascript
// Connect to SSE
const eventSource = new EventSource(`/api/videos/download-progress/${jobId}`);

eventSource.onmessage = function(event) {
  const progress = JSON.parse(event.data);
  // Update UI with progress
};
```

### 3. Resume After Browser Close
```javascript
// On page load
const activeJobId = localStorage.getItem('activeDownloadJobId');
if (activeJobId) {
  // Check if still active
  fetch(`/api/videos/download-status/${activeJobId}`)
    .then(data => {
      if (data.state === 'active') {
        // Resume monitoring
        showActiveDownload(activeJobId);
      }
    });
}
```

## Configuration

### Redis Configuration
```javascript
// src/services/downloadQueue.js
const downloadQueue = new Bull('video-downloads', {
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
  },
});
```

### Environment Variables
```bash
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
```

## Error Handling

### Job Failures
- Automatic retry (Bull default: 3 attempts)
- Error logged to Winston
- User notified via UI

### SSE Connection Loss
- EventSource auto-reconnects
- Progress resumes from last known state
- No data loss

### Browser Compatibility
- Modern browsers support EventSource
- Fallback: polling (not implemented)

## Monitoring

### Check Active Jobs
```bash
# Redis CLI
redis-cli
> KEYS bull:video-downloads:*
> HGETALL bull:video-downloads:123
```

### View Logs
```bash
tail -f logs/combined-*.log | grep "download"
```

## Performance

### Metrics
- **Progress update interval**: 0.5 seconds
- **SSE connection**: Keep-alive
- **Memory usage**: ~10MB per active job
- **Redis storage**: ~1KB per job

### Scalability
- Multiple concurrent downloads supported
- Redis handles job distribution
- Can scale horizontally with multiple workers

## Limitations

### Current
1. No pause/resume functionality
2. No download cancellation from UI
3. Progress accuracy depends on Content-Length header
4. Single worker process

### Future Improvements
1. **Pause/Resume**: Add job control
2. **Cancel Download**: Stop job from UI
3. **Multiple Workers**: Scale processing
4. **Download History**: Track completed downloads
5. **Bandwidth Limiting**: Control download speed
6. **Retry Logic**: Smart retry on failure

## Testing

### Test Background Download
1. Start download dari URL besar (>100MB)
2. Observe progress bar
3. Close browser tab
4. Open new tab ke gallery page
5. Verify progress continues from last state

### Test Progress Accuracy
1. Download file dengan known size
2. Monitor loaded/total values
3. Verify speed calculation
4. Check completion at 100%

### Test Multiple Downloads
1. Start multiple downloads
2. Verify all show in Active Downloads
3. Check Redis for multiple jobs
4. Verify all complete successfully

## Troubleshooting

### Redis Connection Error
```bash
# Check Redis status
redis-cli ping

# Start Redis
systemctl start redis
# or
redis-server --daemonize yes
```

### SSE Not Connecting
- Check browser console for errors
- Verify job ID is correct
- Check server logs for SSE errors

### Progress Not Updating
- Verify Redis is running
- Check worker is processing jobs
- Monitor server logs

### Job Stuck in Queue
```bash
# Check job status in Redis
redis-cli
> HGETALL bull:video-downloads:active
```

## Security

### Considerations
- Job IDs are UUIDs (hard to guess)
- SSE requires authentication
- Rate limiting on download endpoint
- CSRF protection

### Best Practices
- Validate URLs before download
- Check file size limits
- Sanitize filenames
- Clean up failed downloads

## Code Examples

### Start Download
```javascript
const response = await fetch('/api/videos/download-url', {
  method: 'POST',
  headers: { 'X-CSRF-Token': csrfToken },
  body: formData
});

const { jobId } = await response.json();
localStorage.setItem('activeDownloadJobId', jobId);
```

### Monitor Progress
```javascript
const eventSource = new EventSource(`/api/videos/download-progress/${jobId}`);

eventSource.onmessage = (event) => {
  const { loaded, total, percent, speed } = JSON.parse(event.data);
  
  const loadedMB = (loaded / 1024 / 1024).toFixed(2);
  const totalMB = (total / 1024 / 1024).toFixed(2);
  const speedMBps = (speed / 1024 / 1024).toFixed(2);
  
  console.log(`${loadedMB} MB / ${totalMB} MB @ ${speedMBps} MB/s`);
};
```

### Resume Monitoring
```javascript
window.addEventListener('load', async () => {
  const jobId = localStorage.getItem('activeDownloadJobId');
  if (!jobId) return;
  
  const res = await fetch(`/api/videos/download-status/${jobId}`);
  const { state } = await res.json();
  
  if (state === 'active' || state === 'waiting') {
    showActiveDownload(jobId);
  } else {
    localStorage.removeItem('activeDownloadJobId');
  }
});
```
