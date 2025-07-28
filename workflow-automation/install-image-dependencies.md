# Required Dependencies for File Conversion

Run these commands to install the necessary packages for comprehensive file conversion:

```bash
npm install sharp pdf2pic
npm install --save-dev @types/sharp
```

## Package Details:

- **sharp**: High-performance image processing (JPEG, PNG, WebP, TIFF, HEIC)
- **pdf2pic**: PDF to image conversion 
- **@types/sharp**: TypeScript definitions for sharp

## Notes:
- Sharp supports HEIC/HEIF natively (iPhone photos)
- PDF2pic converts PDF receipts to images
- All files are optimized for OpenAI Vision API (max 2048x2048, PNG format)
- 10MB file size limit enforced