# Stream History Feature

## Deskripsi
Fitur History menyimpan dan menampilkan riwayat lengkap semua livestream yang pernah dilakukan, termasuk statistik detail untuk setiap stream.

## Fitur Utama

### 1. **Statistics Dashboard**
Menampilkan ringkasan statistik keseluruhan:
- **Total Streams**: Jumlah total livestream yang pernah dilakukan
- **Total Views**: Total penonton dari semua stream
- **Total Duration**: Total durasi streaming (dalam jam)
- **Peak Viewers**: Jumlah penonton tertinggi yang pernah dicapai

### 2. **Stream History Table**
Tabel lengkap dengan informasi:
- Channel name
- Video yang digunakan (dengan thumbnail)
- Waktu mulai stream
- Durasi stream
- Status (Live/Completed/Failed)
- Total views
- Peak viewers
- Likes
- Link ke video YouTube
- Action buttons (View/Delete)

### 3. **Advanced Filters**
Filter data berdasarkan:
- **Channel**: Filter by specific channel
- **Status**: Completed, Failed, atau semua
- **Date Range**: Start date dan end date
- Real-time filtering tanpa reload page

### 4. **Detailed Statistics**
Untuk setiap stream, tersimpan:
- Peak viewers
- Total views
- Likes
- Comments
- Shares
- Average view duration
- Chat messages count

## Database Schema

### StreamHistory Model
```javascript
{
  channelId: ObjectId,          // Reference to Channel
  videoId: ObjectId,            // Reference to Video
  streamKey: String,            // YouTube stream key
  broadcastId: String,          // YouTube broadcast ID
  videoUrl: String,             // YouTube video URL
  startedAt: Date,              // Stream start time
  endedAt: Date,                // Stream end time
  duration: Number,             // Duration in seconds
  status: String,               // 'live', 'completed', 'failed'
  statistics: {
    peakViewers: Number,
    totalViews: Number,
    likes: Number,
    comments: Number,
    shares: Number,
    averageViewDuration: Number,
    chatMessages: Number
  },
  metadata: {
    title: String,
    description: String,
    thumbnailUrl: String
  },
  timestamps: true              // createdAt, updatedAt
}
```

## API Endpoints

### 1. Get History Page
```
GET /history
Response: HTML page with history data
```

### 2. Get History (API)
```
GET /api/history?channelId=xxx&status=completed&startDate=2025-01-01&endDate=2025-12-31&limit=100

Response:
{
  "success": true,
  "history": [
    {
      "id": "...",
      "channelName": "Channel Name",
      "videoTitle": "Video Title",
      "videoThumbnail": "/uploads/thumbnails/...",
      "startedAt": "2025-12-07T10:00:00Z",
      "endedAt": "2025-12-07T12:00:00Z",
      "duration": 7200,
      "status": "completed",
      "statistics": {
        "peakViewers": 150,
        "totalViews": 1250,
        "likes": 85,
        "comments": 42,
        ...
      },
      "videoUrl": "https://youtube.com/watch?v=..."
    }
  ]
}
```

### 3. Get Statistics
```
GET /api/history/statistics?channelId=xxx&startDate=2025-01-01&endDate=2025-12-31

Response:
{
  "success": true,
  "statistics": {
    "totalStreams": 25,
    "totalDuration": 180000,
    "totalViews": 15000,
    "totalLikes": 850,
    "totalComments": 420,
    "avgPeakViewers": 125,
    "maxPeakViewers": 250
  }
}
```

### 4. Delete History
```
DELETE /api/history/:id

Response:
{
  "success": true,
  "message": "History deleted successfully"
}
```

## Integration dengan Stream Service

### Saat Stream Dimulai
```javascript
const streamHistory = await streamHistoryService.createStreamHistory({
  channelId: channel._id,
  videoId: video._id,
  streamKey: streamKey,
  broadcastId: broadcast.id,
  startedAt: new Date(),
  status: 'live',
  metadata: {
    title: broadcast.snippet.title,
    description: broadcast.snippet.description,
    thumbnailUrl: broadcast.snippet.thumbnails.default.url
  }
});
```

### Saat Stream Selesai
```javascript
await streamHistoryService.updateStreamHistory(historyId, {
  endedAt: new Date(),
  duration: Math.floor((Date.now() - startTime) / 1000),
  status: 'completed',
  videoUrl: `https://youtube.com/watch?v=${videoId}`,
  statistics: {
    peakViewers: stats.peakViewers,
    totalViews: stats.totalViews,
    likes: stats.likes,
    comments: stats.comments,
    ...
  }
});
```

## UI Components

### Statistics Cards
4 kartu statistik dengan gradient backgrounds:
- Total Streams (purple gradient)
- Total Views (pink gradient)
- Total Duration (blue gradient)
- Peak Viewers (orange gradient)

### Filter Panel
Card dengan form filters:
- Channel dropdown
- Status dropdown
- Start date picker
- End date picker
- Apply/Clear buttons

### History Table
Responsive table dengan:
- Sortable columns
- Thumbnail previews
- Status badges (colored)
- Action buttons
- YouTube link integration

## Features

### 1. Real-time Filtering
```javascript
function applyFilters() {
  const params = new URLSearchParams();
  if (channelId) params.append('channelId', channelId);
  if (status) params.append('status', status);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  fetch(`/api/history?${params.toString()}`)
    .then(res => res.json())
    .then(data => updateHistoryTable(data.history));
}
```

### 2. Dynamic Table Update
Table updates tanpa page reload saat filter diterapkan.

### 3. Delete Confirmation
Konfirmasi sebelum menghapus history record.

### 4. YouTube Integration
Direct link ke video YouTube jika tersedia.

## Statistics Calculation

### Aggregate Statistics
```javascript
const stats = await StreamHistory.aggregate([
  { $match: { status: 'completed' } },
  {
    $group: {
      _id: null,
      totalStreams: { $sum: 1 },
      totalDuration: { $sum: '$duration' },
      totalViews: { $sum: '$statistics.totalViews' },
      totalLikes: { $sum: '$statistics.likes' },
      avgPeakViewers: { $avg: '$statistics.peakViewers' },
      maxPeakViewers: { $max: '$statistics.peakViewers' }
    }
  }
]);
```

## Use Cases

### 1. Performance Analysis
- Track stream performance over time
- Compare different channels
- Identify best performing content

### 2. Reporting
- Generate reports for specific date ranges
- Export statistics for analysis
- Monitor growth trends

### 3. Content Planning
- Analyze which videos perform best
- Determine optimal streaming times
- Plan future content based on history

### 4. Troubleshooting
- Review failed streams
- Identify patterns in issues
- Track stream stability

## Best Practices

### 1. Regular Cleanup
- Archive old history records
- Keep database size manageable
- Maintain query performance

### 2. Statistics Updates
- Update statistics periodically during stream
- Fetch final stats after stream ends
- Handle API rate limits

### 3. Error Handling
- Log failed streams with error details
- Retry statistics fetching on failure
- Graceful degradation if YouTube API unavailable

## Future Enhancements

### Planned Features
1. **Export to CSV/Excel**: Download history data
2. **Charts & Graphs**: Visual analytics
3. **Comparison View**: Compare multiple streams
4. **Automated Reports**: Scheduled email reports
5. **Advanced Analytics**: Engagement metrics, retention rates
6. **Stream Highlights**: Save notable moments
7. **Viewer Demographics**: Age, location, device data
8. **Revenue Tracking**: If monetized

## Performance Considerations

### Indexing
```javascript
// Indexes for fast queries
streamHistorySchema.index({ startedAt: -1 });
streamHistorySchema.index({ channelId: 1, startedAt: -1 });
streamHistorySchema.index({ status: 1 });
```

### Query Optimization
- Limit results (default: 100)
- Use pagination for large datasets
- Cache statistics for dashboard
- Aggregate queries for summaries

### Data Retention
- Consider archiving old records (>1 year)
- Implement data retention policies
- Compress archived data

## Security

### Access Control
- Require authentication for all history endpoints
- CSRF protection on delete operations
- Rate limiting on API endpoints

### Data Privacy
- Don't expose sensitive stream keys
- Sanitize user inputs
- Validate all query parameters

## Troubleshooting

### History Not Saving
- Check stream service integration
- Verify createStreamHistory is called
- Check MongoDB connection
- Review error logs

### Statistics Not Updating
- Verify YouTube API credentials
- Check API quota limits
- Review updateStreamHistory calls
- Check network connectivity

### Filters Not Working
- Check JavaScript console for errors
- Verify API endpoint responses
- Test query parameters
- Check date format

## Testing

### Manual Testing
1. Start a stream
2. Verify history record created
3. End stream
4. Check statistics updated
5. Test filters
6. Test delete functionality

### API Testing
```bash
# Get all history
curl http://localhost:3000/api/history

# Filter by channel
curl http://localhost:3000/api/history?channelId=xxx

# Get statistics
curl http://localhost:3000/api/history/statistics

# Delete history
curl -X DELETE http://localhost:3000/api/history/xxx
```

## Monitoring

### Key Metrics
- Number of history records
- Database size
- Query performance
- API response times
- Error rates

### Logging
- Stream start/end events
- Statistics updates
- Failed operations
- API errors

## Maintenance

### Regular Tasks
- Review and clean old records
- Update indexes if needed
- Monitor database performance
- Check API quota usage
- Backup history data
