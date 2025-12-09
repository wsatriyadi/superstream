# Footer Component

## Deskripsi
Footer dengan copyright text "Copyright © 2025 Satriyadi Soft" telah ditambahkan ke semua halaman aplikasi.

## Implementasi

### File
- **Location**: `/src/views/partials/footer.ejs`
- **Type**: EJS Partial

### Code
```html
<footer style="text-align: center; padding: 20px; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; margin-top: 40px;">
  Copyright &copy; 2025 Satriyadi Soft
</footer>
```

### Styling
- **Text Align**: Center
- **Padding**: 20px
- **Color**: #6b7280 (gray)
- **Font Size**: 14px
- **Border Top**: 1px solid #e5e7eb
- **Margin Top**: 40px

## Pages with Footer

Footer telah ditambahkan ke semua halaman:
- ✅ Dashboard (`dashboard.ejs`)
- ✅ Gallery (`gallery.ejs`)
- ✅ Channels (`channels.ejs`)
- ✅ Live Streams (`live.ejs`)
- ✅ Settings (`settings.ejs`)
- ✅ History (`history.ejs`)
- ✅ Login (`login.ejs`)
- ✅ Setup (`setup.ejs`)

## Usage

Footer di-include sebelum closing `</body>` tag:

```html
  <%- include('partials/footer') %>
</body>
</html>
```

## Customization

Untuk mengubah footer, edit file `/src/views/partials/footer.ejs`:

### Change Text
```html
Copyright &copy; 2025 Your Company Name
```

### Change Year Dynamically
```html
Copyright &copy; <%= new Date().getFullYear() %> Satriyadi Soft
```

### Add Links
```html
<footer style="...">
  Copyright &copy; 2025 Satriyadi Soft | 
  <a href="/privacy">Privacy Policy</a> | 
  <a href="/terms">Terms of Service</a>
</footer>
```

### Change Styling
Modify inline styles or add CSS class:
```html
<footer class="app-footer">
  Copyright &copy; 2025 Satriyadi Soft
</footer>
```

Then add to `/public/css/custom.css`:
```css
.app-footer {
  text-align: center;
  padding: 20px;
  color: #6b7280;
  font-size: 14px;
  border-top: 1px solid #e5e7eb;
  margin-top: 40px;
}
```

## Responsive Design

Footer is responsive by default:
- Full width on all screen sizes
- Centered text
- Adequate padding for mobile devices

## Accessibility

- Uses semantic `<footer>` HTML5 element
- Proper color contrast (gray text on white background)
- Readable font size (14px)

## Browser Compatibility

Works on all modern browsers:
- ✅ Chrome/Edge
- ✅ Firefox
- ✅ Safari
- ✅ Opera
- ✅ Mobile browsers

## Maintenance

### Update Copyright Year
Manually update year in footer.ejs or use dynamic year:
```html
Copyright &copy; <%= new Date().getFullYear() %> Satriyadi Soft
```

### Add New Pages
When creating new pages, include footer:
```html
<%- include('partials/footer') %>
```

## Testing

Verify footer appears on all pages:
1. Navigate to each page
2. Scroll to bottom
3. Verify footer text is visible
4. Check styling is consistent

## Notes

- Footer uses inline styles for simplicity
- Can be moved to external CSS if needed
- Copyright symbol uses HTML entity `&copy;`
- Year is static (2025) - can be made dynamic if needed
