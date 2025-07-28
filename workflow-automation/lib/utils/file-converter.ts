import sharp from 'sharp';
import * as pdf2pic from 'pdf2pic';

export interface ConversionResult {
  success: boolean;
  pngBuffer?: Buffer;
  filename?: string;
  originalFormat?: string;
  error?: string;
}

export class FileConverter {
  // Maximum dimensions for OpenAI Vision API (to keep under size limits)
  private static readonly MAX_WIDTH = 2048;
  private static readonly MAX_HEIGHT = 2048;
  
  // Supported formats for conversion
  private static readonly SUPPORTED_FORMATS = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/webp',
    'image/tiff',
    'image/bmp',
    'image/heic',
    'image/heif',
    'application/pdf'
  ];

  /**
   * Convert any supported file format to optimized PNG for OpenAI processing
   */
  static async convertToPNG(file: File | Buffer, originalMimeType?: string): Promise<ConversionResult> {
    try {
      let buffer: Buffer;
      let mimeType: string;

      // Handle File object vs Buffer
      if (file instanceof File) {
        buffer = Buffer.from(await file.arrayBuffer());
        mimeType = file.type;
      } else {
        buffer = file;
        mimeType = originalMimeType || 'application/octet-stream';
      }

      console.log(`Converting file of type: ${mimeType} (${buffer.length} bytes)`);

      // Check if format is supported
      if (!this.SUPPORTED_FORMATS.includes(mimeType)) {
        return {
          success: false,
          error: `Unsupported file format: ${mimeType}. Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`
        };
      }

      let pngBuffer: Buffer;
      const timestamp = Date.now();

      // Handle PDF files
      if (mimeType === 'application/pdf') {
        pngBuffer = await this.convertPDFToPNG(buffer);
      }
      // Handle HEIC/HEIF files (iPhone photos)
      else if (mimeType === 'image/heic' || mimeType === 'image/heif') {
        pngBuffer = await this.convertHEICToPNG(buffer);
      }
      // Handle standard image formats
      else {
        pngBuffer = await this.convertImageToPNG(buffer);
      }

      const filename = `receipt_${timestamp}.png`;
      
      console.log(`Successfully converted to PNG: ${filename} (${pngBuffer.length} bytes)`);

      return {
        success: true,
        pngBuffer,
        filename,
        originalFormat: mimeType
      };

    } catch (error) {
      console.error('File conversion error:', error);
      return {
        success: false,
        error: `File conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Convert standard image formats to optimized PNG
   */
  private static async convertImageToPNG(buffer: Buffer): Promise<Buffer> {
    return await sharp(buffer)
      .resize(this.MAX_WIDTH, this.MAX_HEIGHT, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png({
        quality: 90,
        compressionLevel: 6
      })
      .toBuffer();
  }

  /**
   * Convert HEIC/HEIF to PNG (common for iPhone photos)
   */
  private static async convertHEICToPNG(buffer: Buffer): Promise<Buffer> {
    try {
      // Sharp supports HEIC natively in newer versions
      return await sharp(buffer)
        .resize(this.MAX_WIDTH, this.MAX_HEIGHT, {
          fit: 'inside',
          withoutEnlargement: true
        })
        .png({
          quality: 90,
          compressionLevel: 6
        })
        .toBuffer();
    } catch (error) {
      throw new Error(`HEIC conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert PDF to PNG (first page only)
   */
  private static async convertPDFToPNG(buffer: Buffer): Promise<Buffer> {
    try {
      // For PDF conversion, we'll use a simpler approach with pdf2pic
      // Note: In production, you might want to use a more robust solution
      const options = {
        density: 200,           // DPI
        saveFilename: "receipt",
        savePath: "/tmp",
        format: "png",
        width: this.MAX_WIDTH,
        height: this.MAX_HEIGHT
      };

      // Convert first page only
      const convert = pdf2pic.fromBuffer(buffer, options);
      const result = await convert(1); // Page 1 only

      if (result && result.buffer) {
        return result.buffer;
      } else {
        throw new Error('PDF conversion returned no data');
      }
    } catch (error) {
      throw new Error(`PDF conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate file size and type before processing
   */
  static validateFile(file: File): { valid: boolean; error?: string } {
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File too large. Maximum size is 10MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`
      };
    }

    // Check file type
    if (!this.SUPPORTED_FORMATS.includes(file.type)) {
      return {
        valid: false,
        error: `Unsupported file type: ${file.type}. Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`
      };
    }

    return { valid: true };
  }

  /**
   * Create a data URL from PNG buffer for OpenAI Vision API
   */
  static createPNGDataURL(pngBuffer: Buffer): string {
    const base64 = pngBuffer.toString('base64');
    return `data:image/png;base64,${base64}`;
  }
}