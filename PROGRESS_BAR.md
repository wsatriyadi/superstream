# Progress Bar untuk Upload dan Download Video

## Deskripsi
Fitur progress bar menampilkan progres real-time saat mengupload video dari komputer atau mengunduh video dari URL eksternal.

## Fitur

### 1. Upload Video Progress
Saat mengupload video dari komputer:
- **Progress bar visual**: Menampilkan persentase upload (0-100%)
- **Upload size**: Menampilkan ukuran yang sudah diupload vs total ukuran (MB)
- **Status text**: Menampilkan status upload saat ini
- **Animasi**: Progress bar dengan animasi striped

### 2. Download Video Progress
Saat mengunduh video dari URL:
- **Progress bar visual**: Menampilkan status download
- **Status text**: Menampilkan tahapan download
- **Feedback**: Indikasi bahwa server sedang memproses download

## Implementasi Teknis

### Frontend
- Menggunakan **XMLHttpRequest** untuk tracking progress (bukan fetch API)
- Event `xhr.upload.progress` untuk tracking upload progress
- Event `xhr.progress` untuk tracking download progress
- Bootstrap progress bar component untuk UI

### Progress Stages

#### Upload Video:
1. **0%**: Preparing upload...
2. **1-99%**: Uploading: X MB / Y MB
3. **100%**: Upload complete! Reloading...

#### Download from URL:
1. **0%**: Starting download...
2. **50%**: Server is downloading video...
3. **100%**: Download complete! Reloading...

## UI Components

### Progress Bar HTML:
```html
<div id="uploadProgress" class="mt-3" style="display: none;">
  <div class="progress" style="height: 25px;">
    <div id="uploadProgressBar" 
         class="progress-bar progress-bar-striped progress-bar-animated" 
         role="progressbar" 
         style="width: 0%">
      0%
    </div>
  </div>
  <small class="text-muted mt-2 d-block" id="uploadProgressText">
    Preparing upload...
  </small>
</div>
```

### Styling:
- Height: 25px untuk visibility yang baik
- Striped dan animated untuk feedback visual
- Text muted untuk informasi tambahan
- Hidden by default, ditampilkan saat proses dimulai

## Error Handling

Progress bar akan disembunyikan jika:
- Upload/download gagal
- Server mengembalikan error
- Network error terjadi
- User membatalkan operasi

Button akan dikembalikan ke state semula dan user bisa mencoba lagi.

## Browser Compatibility

Fitur ini menggunakan XMLHttpRequest yang didukung oleh semua browser modern:
- Chrome/Edge: ✅
- Firefox: ✅
- Safari: ✅
- Opera: ✅

## Limitations

### Download Progress:
- Progress untuk download dari URL tidak bisa menampilkan persentase exact karena server yang melakukan download
- Hanya menampilkan status "Server is downloading video..." dengan progress 50%
- Progress 100% ditampilkan setelah server selesai dan mengirim response

### Upload Progress:
- Akurat menampilkan persentase upload
- Menampilkan ukuran file yang sudah diupload
- Real-time update setiap beberapa KB

## Future Improvements

Potensial enhancement untuk masa depan:
1. **Server-Sent Events (SSE)**: Untuk real-time progress dari server saat download dari URL
2. **WebSocket**: Untuk two-way communication dan progress yang lebih akurat
3. **Chunked Upload**: Untuk file besar dengan resume capability
4. **Speed indicator**: Menampilkan kecepatan upload/download (MB/s)
5. **Time remaining**: Estimasi waktu yang tersisa

## Testing

### Test Upload Progress:
1. Pilih file video besar (>100MB)
2. Klik "Upload Video"
3. Observe progress bar naik dari 0% ke 100%
4. Verify ukuran file ditampilkan dengan benar

### Test Download Progress:
1. Masukkan URL video
2. Klik "Download Video"
3. Observe progress bar dan status text
4. Verify completion message

## Troubleshooting

### Progress bar tidak muncul:
- Check browser console untuk errors
- Verify XMLHttpRequest didukung
- Check network tab untuk request status

### Progress stuck di 0%:
- File mungkin terlalu kecil (upload instant)
- Network issue
- Server tidak merespons

### Progress tidak akurat:
- Normal untuk download dari URL (server-side process)
- Check file size untuk upload

## Code Reference

### Upload Handler:
```javascript
xhr.upload.addEventListener('progress', function(e) {
  if (e.lengthComputable) {
    const percentComplete = Math.round((e.loaded / e.total) * 100);
    progressBar.style.width = percentComplete + '%';
    progressBar.textContent = percentComplete + '%';
    
    const loadedMB = (e.loaded / 1024 / 1024).toFixed(2);
    const totalMB = (e.total / 1024 / 1024).toFixed(2);
    progressText.textContent = `Uploading: ${loadedMB} MB / ${totalMB} MB`;
  }
});
```

### Download Handler:
```javascript
xhr.addEventListener('progress', function(e) {
  progressText.textContent = 'Server is downloading video...';
  progressBar.style.width = '50%';
  progressBar.textContent = '50%';
});
```
