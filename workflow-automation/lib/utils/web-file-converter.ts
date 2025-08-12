export interface ConversionResult {
  success: boolean;
  pngDataUrl?: string;
  filename?: string;
  originalFormat?: string;
  error?: string;
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  organizationId: string;
  category: 'receipts' | 'documents' | 'avatars' | 'temp';
}

export class WebFileConverter {
  // Maximum dimensions for OpenAI Vision API
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
   * Convert any supported file format to optimized PNG data URL
   * This is a web-compatible version that works in serverless environments
   */
  static async convertToPNG(file: File): Promise<ConversionResult> {
    try {
      console.log(`Converting file of type: ${file.type} (${file.size} bytes)`);

      // Check if format is supported
      if (!this.SUPPORTED_FORMATS.includes(file.type)) {
        return {
          success: false,
          error: `Unsupported file format: ${file.type}. Supported formats: ${this.SUPPORTED_FORMATS.join(', ')}`
        };
      }

      // Check file size (10MB limit)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        return {
          success: false,
          error: `File too large. Maximum size is 10MB, got ${(file.size / 1024 / 1024).toFixed(2)}MB`
        };
      }

      let pngDataUrl: string;
      const timestamp = Date.now();

      // Handle PDF files - for now, we'll skip PDF conversion in serverless
      if (file.type === 'application/pdf') {
        return {
          success: false,
          error: 'PDF conversion is not supported in serverless environments. Please convert to image format first.'
        };
      }

      // Handle HEIC/HEIF files - skip in serverless
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        return {
          success: false,
          error: 'HEIC/HEIF conversion is not supported in serverless environments. Please convert to JPEG/PNG first.'
        };
      }

      // Handle standard image formats
      pngDataUrl = await this.convertImageToPNG(file);

      const filename = `receipt_${timestamp}.png`;
      
      console.log(`Successfully converted to PNG: ${filename}`);

      return {
        success: true,
        pngDataUrl,
        filename,
        originalFormat: file.type
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
   * Convert standard image formats to optimized PNG using Canvas API
   * This works in both browser and serverless environments
   */
  private static async convertImageToPNG(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        try {
          // Calculate dimensions while maintaining aspect ratio
          let { width, height } = img;
          
          if (width > this.MAX_WIDTH || height > this.MAX_HEIGHT) {
            const ratio = Math.min(this.MAX_WIDTH / width, this.MAX_HEIGHT / height);
            width *= ratio;
            height *= ratio;
          }

          // Set canvas dimensions
          canvas.width = width;
          canvas.height = height;

          // Draw and convert to PNG
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to data URL (PNG doesn't support quality parameter)
          const pngDataUrl = canvas.toDataURL('image/png');
          resolve(pngDataUrl);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };

      // Create object URL for the file
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;
    });
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
   * Extract base64 data from data URL
   */
  static extractBase64FromDataUrl(dataUrl: string): string {
    const match = dataUrl.match(/^data:[^;]+;base64,(.*)$/);
    if (!match || !match[1]) {
      throw new Error('Invalid data URL format. Expected format: data:[mime-type];base64,[data]');
    }
    return match[1];
  }

  /**
   * Convert base64 to buffer (for server-side processing)
   */
  static base64ToBuffer(base64: string): Buffer {
    return Buffer.from(base64, 'base64');
  }
} 