/**
 * Image Optimizer Service
 * 
 * This service provides image optimization, lazy loading, and caching
 * to improve performance when loading and displaying images.
 */

import { logService } from './log-service';

interface ImageCache {
  [url: string]: {
    blob: Blob;
    objectUrl: string;
    timestamp: number;
    width: number;
    height: number;
  };
}

interface ImageDimensions {
  width: number;
  height: number;
}

interface OptimizedImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'original';
  placeholder?: boolean;
  cacheMaxAge?: number;
}

class ImageOptimizer {
  private cache: ImageCache = {};
  private placeholderCache: { [key: string]: string } = {};
  private readonly DEFAULT_CACHE_MAX_AGE = 1000 * 60 * 60; // 1 hour
  private readonly DEFAULT_QUALITY = 80;
  private readonly DEFAULT_FORMAT = 'webp';
  private readonly PLACEHOLDER_COLOR = '#1e293b'; // Gunmetal color
  
  constructor() {
    // Clean up cache periodically
    setInterval(() => this.cleanCache(), 1000 * 60 * 15); // Every 15 minutes
  }
  
  /**
   * Get an optimized image URL
   * @param url Original image URL
   * @param options Optimization options
   * @returns Promise with optimized image URL
   */
  async getOptimizedImageUrl(url: string, options: OptimizedImageOptions = {}): Promise<string> {
    try {
      // Check if image is already in cache
      const cachedImage = this.getCachedImage(url, options);
      if (cachedImage) {
        return cachedImage;
      }
      
      // If placeholder is requested, return a placeholder while loading
      if (options.placeholder) {
        const placeholder = this.getPlaceholder(url, options.width, options.height);
        
        // Load the actual image in the background
        this.loadAndCacheImage(url, options).catch(error => {
          logService.log('error', `Failed to load image in background: ${url}`, error, 'ImageOptimizer');
        });
        
        return placeholder;
      }
      
      // Load and optimize the image
      return await this.loadAndCacheImage(url, options);
    } catch (error) {
      logService.log('error', `Failed to optimize image: ${url}`, error, 'ImageOptimizer');
      
      // Return original URL as fallback
      return url;
    }
  }
  
  /**
   * Preload an image
   * @param url Image URL
   * @param options Optimization options
   * @returns Promise that resolves when the image is loaded
   */
  async preloadImage(url: string, options: OptimizedImageOptions = {}): Promise<void> {
    try {
      await this.loadAndCacheImage(url, options);
      logService.log('debug', `Preloaded image: ${url}`, null, 'ImageOptimizer');
    } catch (error) {
      logService.log('error', `Failed to preload image: ${url}`, error, 'ImageOptimizer');
    }
  }
  
  /**
   * Get image dimensions
   * @param url Image URL
   * @returns Promise with image dimensions
   */
  async getImageDimensions(url: string): Promise<ImageDimensions> {
    // Check if image is in cache
    const cacheKey = this.getCacheKey(url, {});
    const cachedImage = this.cache[cacheKey];
    
    if (cachedImage) {
      return {
        width: cachedImage.width,
        height: cachedImage.height
      };
    }
    
    // Load image to get dimensions
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      
      img.onerror = () => {
        reject(new Error(`Failed to load image: ${url}`));
      };
      
      img.src = url;
    });
  }
  
  /**
   * Clear the image cache
   */
  clearCache(): void {
    // Revoke all object URLs
    Object.values(this.cache).forEach(entry => {
      URL.revokeObjectURL(entry.objectUrl);
    });
    
    this.cache = {};
    this.placeholderCache = {};
    
    logService.log('info', 'Image cache cleared', null, 'ImageOptimizer');
  }
  
  /**
   * Get a cached image if available
   * @param url Image URL
   * @param options Optimization options
   * @returns Cached image URL or null if not cached
   */
  private getCachedImage(url: string, options: OptimizedImageOptions): string | null {
    const cacheKey = this.getCacheKey(url, options);
    const cachedImage = this.cache[cacheKey];
    
    if (!cachedImage) {
      return null;
    }
    
    // Check if cache entry has expired
    const maxAge = options.cacheMaxAge || this.DEFAULT_CACHE_MAX_AGE;
    const now = Date.now();
    
    if (now - cachedImage.timestamp > maxAge) {
      // Cache entry has expired, remove it
      URL.revokeObjectURL(cachedImage.objectUrl);
      delete this.cache[cacheKey];
      return null;
    }
    
    return cachedImage.objectUrl;
  }
  
  /**
   * Load and cache an image
   * @param url Image URL
   * @param options Optimization options
   * @returns Promise with optimized image URL
   */
  private async loadAndCacheImage(url: string, options: OptimizedImageOptions): Promise<string> {
    const cacheKey = this.getCacheKey(url, options);
    
    // Fetch the image
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    
    // Get image blob
    let blob = await response.blob();
    
    // Optimize image if needed
    if (options.width || options.height || options.quality || options.format) {
      blob = await this.optimizeImage(blob, options);
    }
    
    // Create object URL
    const objectUrl = URL.createObjectURL(blob);
    
    // Get image dimensions
    const dimensions = await this.getBlobDimensions(blob);
    
    // Cache the image
    this.cache[cacheKey] = {
      blob,
      objectUrl,
      timestamp: Date.now(),
      width: dimensions.width,
      height: dimensions.height
    };
    
    return objectUrl;
  }
  
  /**
   * Optimize an image
   * @param blob Image blob
   * @param options Optimization options
   * @returns Promise with optimized image blob
   */
  private async optimizeImage(blob: Blob, options: OptimizedImageOptions): Promise<Blob> {
    // Create image element
    const img = await this.createImageFromBlob(blob);
    
    // Calculate dimensions
    const originalWidth = img.naturalWidth;
    const originalHeight = img.naturalHeight;
    
    let targetWidth = options.width || originalWidth;
    let targetHeight = options.height || originalHeight;
    
    // Maintain aspect ratio if only one dimension is specified
    if (options.width && !options.height) {
      targetHeight = Math.round(originalHeight * (targetWidth / originalWidth));
    } else if (!options.width && options.height) {
      targetWidth = Math.round(originalWidth * (targetHeight / originalHeight));
    }
    
    // Create canvas for resizing
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    
    // Draw image on canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    
    // Convert to desired format
    const format = options.format || this.DEFAULT_FORMAT;
    const quality = (options.quality || this.DEFAULT_QUALITY) / 100;
    
    let mimeType: string;
    switch (format) {
      case 'webp':
        mimeType = 'image/webp';
        break;
      case 'jpeg':
        mimeType = 'image/jpeg';
        break;
      case 'png':
        mimeType = 'image/png';
        break;
      default:
        mimeType = blob.type;
    }
    
    // Convert canvas to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) {
            resolve(result);
          } else {
            reject(new Error('Failed to convert canvas to blob'));
          }
        },
        mimeType,
        quality
      );
    });
  }
  
  /**
   * Create an image element from a blob
   * @param blob Image blob
   * @returns Promise with image element
   */
  private createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image from blob'));
      img.src = URL.createObjectURL(blob);
    });
  }
  
  /**
   * Get dimensions of an image blob
   * @param blob Image blob
   * @returns Promise with image dimensions
   */
  private async getBlobDimensions(blob: Blob): Promise<ImageDimensions> {
    const img = await this.createImageFromBlob(blob);
    
    return {
      width: img.naturalWidth,
      height: img.naturalHeight
    };
  }
  
  /**
   * Get a placeholder for an image
   * @param url Image URL
   * @param width Placeholder width
   * @param height Placeholder height
   * @returns Placeholder URL
   */
  private getPlaceholder(url: string, width?: number, height?: number): string {
    const key = `${url}-${width || 'auto'}-${height || 'auto'}`;
    
    // Check if placeholder is already cached
    if (this.placeholderCache[key]) {
      return this.placeholderCache[key];
    }
    
    // Create placeholder SVG
    const w = width || 100;
    const h = height || 100;
    
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
        <rect width="100%" height="100%" fill="${this.PLACEHOLDER_COLOR}" />
        <text x="50%" y="50%" font-family="Arial" font-size="14" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">Loading...</text>
      </svg>
    `;
    
    // Convert SVG to data URL
    const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
    
    // Cache placeholder
    this.placeholderCache[key] = dataUrl;
    
    return dataUrl;
  }
  
  /**
   * Generate a cache key for an image
   * @param url Image URL
   * @param options Optimization options
   * @returns Cache key
   */
  private getCacheKey(url: string, options: OptimizedImageOptions): string {
    return `${url}-${options.width || 'auto'}-${options.height || 'auto'}-${options.quality || this.DEFAULT_QUALITY}-${options.format || this.DEFAULT_FORMAT}`;
  }
  
  /**
   * Clean expired entries from the cache
   */
  private cleanCache(): void {
    const now = Date.now();
    let removedCount = 0;
    
    Object.keys(this.cache).forEach(key => {
      const entry = this.cache[key];
      
      // Remove entries older than the default cache max age
      if (now - entry.timestamp > this.DEFAULT_CACHE_MAX_AGE) {
        URL.revokeObjectURL(entry.objectUrl);
        delete this.cache[key];
        removedCount++;
      }
    });
    
    if (removedCount > 0) {
      logService.log('debug', `Cleaned ${removedCount} expired entries from image cache`, null, 'ImageOptimizer');
    }
  }
}

// Export a singleton instance
export const imageOptimizer = new ImageOptimizer();
