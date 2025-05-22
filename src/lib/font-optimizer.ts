/**
 * Font Optimizer Service
 * 
 * This service optimizes font loading to improve performance and reduce layout shifts.
 * It implements font preloading, font display strategies, and font subsetting.
 */

import { logService } from './log-service';

interface FontDefinition {
  family: string;
  url: string;
  weight?: string | number;
  style?: string;
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  unicodeRange?: string;
  preload?: boolean;
  format?: 'woff2' | 'woff' | 'truetype' | 'opentype' | 'embedded-opentype' | 'svg';
}

interface FontLoadingStatus {
  family: string;
  loaded: boolean;
  error: boolean;
  startTime: number;
  endTime: number | null;
}

class FontOptimizer {
  private loadedFonts: Map<string, FontLoadingStatus> = new Map();
  private fontObserver: FontFaceObserver | null = null;
  private fontTimeoutMs: number = 3000; // 3 seconds timeout for font loading
  
  constructor() {
    // Initialize FontFaceObserver if available
    this.initFontObserver();
  }
  
  /**
   * Load a font with optimized settings
   * @param fontDefinition Font definition
   * @returns Promise that resolves when the font is loaded
   */
  async loadFont(fontDefinition: FontDefinition): Promise<void> {
    try {
      const fontId = this.getFontId(fontDefinition);
      
      // Check if font is already loaded
      if (this.loadedFonts.has(fontId)) {
        const status = this.loadedFonts.get(fontId)!;
        if (status.loaded) {
          return;
        }
      }
      
      // Initialize loading status
      this.loadedFonts.set(fontId, {
        family: fontDefinition.family,
        loaded: false,
        error: false,
        startTime: performance.now(),
        endTime: null
      });
      
      // Preload font if requested
      if (fontDefinition.preload) {
        this.preloadFont(fontDefinition);
      }
      
      // Create @font-face rule
      this.createFontFaceRule(fontDefinition);
      
      // Load font using FontFaceObserver if available
      if (this.fontObserver) {
        await this.loadFontWithObserver(fontDefinition);
      } else {
        // Fallback to native font loading
        await this.loadFontNative(fontDefinition);
      }
      
      // Update loading status
      const status = this.loadedFonts.get(fontId)!;
      status.loaded = true;
      status.endTime = performance.now();
      this.loadedFonts.set(fontId, status);
      
      const loadTime = status.endTime - status.startTime;
      logService.log('info', `Font loaded: ${fontDefinition.family} (${Math.round(loadTime)}ms)`, null, 'FontOptimizer');
    } catch (error) {
      const fontId = this.getFontId(fontDefinition);
      
      // Update loading status
      if (this.loadedFonts.has(fontId)) {
        const status = this.loadedFonts.get(fontId)!;
        status.error = true;
        status.endTime = performance.now();
        this.loadedFonts.set(fontId, status);
      }
      
      logService.log('error', `Failed to load font: ${fontDefinition.family}`, error, 'FontOptimizer');
    }
  }
  
  /**
   * Load multiple fonts with optimized settings
   * @param fontDefinitions Array of font definitions
   * @returns Promise that resolves when all fonts are loaded
   */
  async loadFonts(fontDefinitions: FontDefinition[]): Promise<void> {
    await Promise.all(fontDefinitions.map(font => this.loadFont(font)));
  }
  
  /**
   * Get font loading status
   * @param fontFamily Font family name
   * @param weight Font weight
   * @param style Font style
   * @returns Font loading status or null if not found
   */
  getFontStatus(fontFamily: string, weight?: string | number, style?: string): FontLoadingStatus | null {
    const fontId = this.getFontId({
      family: fontFamily,
      url: '',
      weight,
      style
    });
    
    return this.loadedFonts.get(fontId) || null;
  }
  
  /**
   * Check if a font is loaded
   * @param fontFamily Font family name
   * @param weight Font weight
   * @param style Font style
   * @returns True if the font is loaded
   */
  isFontLoaded(fontFamily: string, weight?: string | number, style?: string): boolean {
    const status = this.getFontStatus(fontFamily, weight, style);
    return status ? status.loaded : false;
  }
  
  /**
   * Get font loading metrics
   * @returns Object with font loading metrics
   */
  getFontLoadingMetrics() {
    const metrics = {
      totalFonts: this.loadedFonts.size,
      loadedFonts: 0,
      failedFonts: 0,
      averageLoadTime: 0,
      maxLoadTime: 0,
      totalLoadTime: 0
    };
    
    let totalLoadTime = 0;
    let loadedCount = 0;
    
    this.loadedFonts.forEach(status => {
      if (status.loaded) {
        metrics.loadedFonts++;
        
        if (status.endTime) {
          const loadTime = status.endTime - status.startTime;
          totalLoadTime += loadTime;
          loadedCount++;
          
          if (loadTime > metrics.maxLoadTime) {
            metrics.maxLoadTime = loadTime;
          }
        }
      }
      
      if (status.error) {
        metrics.failedFonts++;
      }
    });
    
    if (loadedCount > 0) {
      metrics.averageLoadTime = totalLoadTime / loadedCount;
    }
    
    metrics.totalLoadTime = totalLoadTime;
    
    return metrics;
  }
  
  /**
   * Initialize FontFaceObserver if available
   */
  private initFontObserver(): void {
    // Check if FontFaceObserver is available
    if (typeof window !== 'undefined' && 'FontFaceObserver' in window) {
      this.fontObserver = (window as any).FontFaceObserver;
    } else {
      // Dynamically load FontFaceObserver
      this.loadFontObserverScript()
        .then(() => {
          if (typeof window !== 'undefined' && 'FontFaceObserver' in window) {
            this.fontObserver = (window as any).FontFaceObserver;
          }
        })
        .catch(error => {
          logService.log('warn', 'Failed to load FontFaceObserver script', error, 'FontOptimizer');
        });
    }
  }
  
  /**
   * Load FontFaceObserver script
   * @returns Promise that resolves when the script is loaded
   */
  private loadFontObserverScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('Document not available'));
        return;
      }
      
      // Check if script is already loaded
      if (document.querySelector('script[src*="fontfaceobserver"]')) {
        resolve();
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fontfaceobserver/2.3.0/fontfaceobserver.js';
      script.async = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load FontFaceObserver script'));
      
      document.head.appendChild(script);
    });
  }
  
  /**
   * Preload a font
   * @param fontDefinition Font definition
   */
  private preloadFont(fontDefinition: FontDefinition): void {
    if (typeof document === 'undefined') {
      return;
    }
    
    // Check if preload link already exists
    const existingLink = document.querySelector(`link[rel="preload"][href="${fontDefinition.url}"]`);
    if (existingLink) {
      return;
    }
    
    // Create preload link
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = fontDefinition.url;
    link.as = 'font';
    link.type = `font/${fontDefinition.format || this.getFontFormat(fontDefinition.url)}`;
    link.crossOrigin = 'anonymous';
    
    document.head.appendChild(link);
  }
  
  /**
   * Create @font-face rule
   * @param fontDefinition Font definition
   */
  private createFontFaceRule(fontDefinition: FontDefinition): void {
    if (typeof document === 'undefined') {
      return;
    }
    
    // Generate font-face rule
    const fontFaceRule = `
      @font-face {
        font-family: '${fontDefinition.family}';
        src: url('${fontDefinition.url}') format('${fontDefinition.format || this.getFontFormat(fontDefinition.url)}');
        font-weight: ${fontDefinition.weight || 'normal'};
        font-style: ${fontDefinition.style || 'normal'};
        font-display: ${fontDefinition.display || 'swap'};
        ${fontDefinition.unicodeRange ? `unicode-range: ${fontDefinition.unicodeRange};` : ''}
      }
    `;
    
    // Check if style element exists
    let styleElement = document.getElementById('font-optimizer-styles');
    
    if (!styleElement) {
      // Create style element
      styleElement = document.createElement('style');
      styleElement.id = 'font-optimizer-styles';
      document.head.appendChild(styleElement);
    }
    
    // Add font-face rule
    styleElement.textContent += fontFaceRule;
  }
  
  /**
   * Load font using FontFaceObserver
   * @param fontDefinition Font definition
   * @returns Promise that resolves when the font is loaded
   */
  private async loadFontWithObserver(fontDefinition: FontDefinition): Promise<void> {
    if (!this.fontObserver) {
      throw new Error('FontFaceObserver not available');
    }
    
    // Create font observer
    const observer = new this.fontObserver(
      fontDefinition.family,
      {
        weight: fontDefinition.weight || 'normal',
        style: fontDefinition.style || 'normal'
      }
    );
    
    // Load font with timeout
    await observer.load(null, this.fontTimeoutMs);
  }
  
  /**
   * Load font using native FontFace API
   * @param fontDefinition Font definition
   * @returns Promise that resolves when the font is loaded
   */
  private async loadFontNative(fontDefinition: FontDefinition): Promise<void> {
    if (typeof document === 'undefined' || !('fonts' in document)) {
      throw new Error('FontFace API not available');
    }
    
    // Create font face
    const fontFace = new FontFace(
      fontDefinition.family,
      `url(${fontDefinition.url})`,
      {
        weight: fontDefinition.weight?.toString() || 'normal',
        style: fontDefinition.style || 'normal',
        display: fontDefinition.display || 'swap',
        unicodeRange: fontDefinition.unicodeRange
      }
    );
    
    // Load font
    await fontFace.load();
    
    // Add to font registry
    (document as any).fonts.add(fontFace);
  }
  
  /**
   * Get font format from URL
   * @param url Font URL
   * @returns Font format
   */
  private getFontFormat(url: string): string {
    if (url.endsWith('.woff2')) return 'woff2';
    if (url.endsWith('.woff')) return 'woff';
    if (url.endsWith('.ttf')) return 'truetype';
    if (url.endsWith('.otf')) return 'opentype';
    if (url.endsWith('.eot')) return 'embedded-opentype';
    if (url.endsWith('.svg')) return 'svg';
    
    // Default to woff2
    return 'woff2';
  }
  
  /**
   * Generate a unique ID for a font
   * @param fontDefinition Font definition
   * @returns Font ID
   */
  private getFontId(fontDefinition: FontDefinition): string {
    return `${fontDefinition.family}:${fontDefinition.weight || 'normal'}:${fontDefinition.style || 'normal'}`;
  }
}

// Export a singleton instance
export const fontOptimizer = new FontOptimizer();

// FontFaceObserver type definition
interface FontFaceObserver {
  new (family: string, descriptors?: { weight?: string | number; style?: string }): {
    load: (text?: string | null, timeout?: number) => Promise<void>;
  };
}
