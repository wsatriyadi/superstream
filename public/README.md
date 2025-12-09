# Super Stream - Frontend Assets

This directory contains static assets for the Super Stream application.

## Structure

```
public/
├── css/
│   └── custom.css       # Custom styles and enhancements
├── js/
│   └── app.js          # Common JavaScript utilities
└── README.md           # This file
```

## Features

### CSS (custom.css)
- Smooth transitions for interactive elements
- Enhanced card hover effects
- Form validation styling
- Loading spinner styles
- Responsive design improvements
- Accessibility enhancements
- Print-friendly styles

### JavaScript (app.js)
- Common utility functions (debounce, formatNumber, formatDuration, etc.)
- Clipboard operations
- API error handling
- Bootstrap component initialization (tooltips, popovers)
- Smooth scroll behavior

## Usage

These assets are automatically included in all pages through the layout template.

### Custom Functions Available Globally

- `showLoading()` - Show loading overlay
- `hideLoading()` - Hide loading overlay
- `showToast(message, type)` - Display toast notification
- `validateForm(formElement)` - Validate form with Bootstrap validation
- `formatNumber(num)` - Format large numbers (1K, 1M, etc.)
- `formatDuration(seconds)` - Format duration to HH:MM:SS
- `formatFileSize(bytes)` - Format file size to human-readable format
- `copyToClipboard(text)` - Copy text to clipboard
- `fetchWithErrorHandling(url, options)` - Make API calls with error handling

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Dependencies

- Bootstrap 5.3.0
- Bootstrap Icons 1.11.0
