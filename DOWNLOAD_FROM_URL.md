# Fitur Download Video dari URL

## Deskripsi
Fitur ini memungkinkan pengguna untuk mengunduh video dari link eksternal atau Google Drive tanpa perlu mengunduh ke komputer terlebih dahulu.

## Cara Menggunakan

### 1. Melalui UI (Gallery Page)
1. Buka halaman Gallery (`/gallery`)
2. Klik dropdown pada tombol "Upload Video"
3. Pilih "Download from URL"
4. Isi form dengan:
   - **Video URL**: Link langsung ke video atau link Google Drive
   - **Title**: Judul video
   - **Description**: Deskripsi video (opsional)
   - **Channel**: Pilih channel tujuan
   - **Loop Count**: Jumlah pengulangan (default: 1)
5. Klik "Download Video"

### 2. Melalui API

**Endpoint**: `POST /api/videos/download-url`

**Headers**:
```
Content-Type: application/json
X-CSRF-Token: <csrf_token>
```

**Body**:
```json
{
  "url": "https://example.com/video.mp4",
  "title": "Video Title",
  "description": "Video description",
  "channelId": "channel_id_here",
  "loopCount": 1
}
```

**Response Success**:
```json
{
  "success": true,
  "message": "Video downloaded successfully",
  "video": {
    "id": "video_id",
    "title": "Video Title",
    "description": "Video description",
    "channelId": "channel_id",
    "fileName": "sanitized-filename.mp4",
    "fileSize": 12345678,
    "loopCount": 1,
    "uploadedAt": "2025-12-07T17:00:00.000Z"
  }
}
```

**Response Error**:
```json
{
  "success": false,
  "errors": ["Error message"]
}
```

## Format URL yang Didukung

### 1. Direct Video Links
- `https://example.com/video.mp4`
- `https://example.com/path/to/video.avi`
- Link langsung ke file video dengan ekstensi yang valid

### 2. Google Drive Links
Format link Google Drive yang didukung:
- `https://drive.google.com/file/d/FILE_ID/view`
- `https://drive.google.com/open?id=FILE_ID`

Link akan otomatis dikonversi ke format download langsung.

**Catatan**: Untuk Google Drive, pastikan file diset ke "Anyone with the link can view"

## Validasi

### URL Validation
- URL harus valid (format URL yang benar)
- Wajib diisi

### Title Validation
- Wajib diisi
- Panjang: 1-200 karakter

### Description Validation
- Opsional
- Maksimal 5000 karakter

### Channel ID Validation
- Wajib diisi
- Harus berupa MongoDB ObjectId yang valid

### Loop Count Validation
- Opsional (default: 1)
- Range: 1-100

## Batasan

1. **File Size**: Video yang diunduh akan dicek terhadap `maxUploadSize` di settings (default: 5GB)
2. **Timeout**: Request timeout 5 menit (300 detik)
3. **Rate Limiting**: Menggunakan `uploadLimiter` yang sama dengan upload biasa
4. **File Type**: Hanya file video yang valid yang akan diterima

## Error Handling

### Common Errors:
- **400 Bad Request**: URL tidak valid atau parameter tidak lengkap
- **413 Payload Too Large**: File size melebihi batas maksimal
- **500 Internal Server Error**: Gagal mengunduh atau menyimpan file

### Error Messages:
- "URL is required"
- "Invalid URL format"
- "Video title is required"
- "Channel selection is required"
- "Downloaded file size exceeds maximum allowed size"
- "Failed to download video"

## Security Features

1. **Filename Sanitization**: Nama file di-sanitize untuk mencegah path traversal
2. **CSRF Protection**: Semua request memerlukan CSRF token
3. **Rate Limiting**: Mencegah abuse dengan rate limiting
4. **File Size Check**: Validasi ukuran file setelah download
5. **Authentication**: Hanya user yang login yang bisa mengakses

## Technical Details

### Dependencies
- `axios`: Untuk HTTP requests dan download file
- `stream`: Untuk streaming download
- `fs`: Untuk file operations

### File Storage
- Video disimpan di: `uploads/videos/`
- Format nama file: `{sanitized-basename}-{timestamp}-{random}.{ext}`

### Database
Video yang diunduh disimpan dengan struktur yang sama seperti video yang diupload:
- `channelId`: Reference ke channel
- `title`: Judul video
- `description`: Deskripsi
- `filePath`: Path lengkap ke file
- `fileName`: Nama file
- `fileSize`: Ukuran file dalam bytes
- `loopCount`: Jumlah pengulangan
- `uploadedAt`: Timestamp

## Troubleshooting

### Video tidak bisa diunduh dari Google Drive
- Pastikan file sharing diset ke "Anyone with the link"
- Cek apakah file terlalu besar (>5GB default)
- Pastikan link dalam format yang benar

### Download timeout
- File terlalu besar atau koneksi lambat
- Timeout default adalah 5 menit
- Pertimbangkan untuk mengupload file besar secara manual

### Error "Invalid URL format"
- Pastikan URL lengkap dengan protokol (http:// atau https://)
- Cek apakah URL dapat diakses dari server

## Changelog

### Version 1.0.0 (2025-12-07)
- Initial release
- Support untuk direct video links
- Support untuk Google Drive links
- Validasi dan error handling
- UI integration di Gallery page
