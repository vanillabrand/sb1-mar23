import React, { useEffect, useState } from 'react';
import { fontOptimizer } from '../lib/font-optimizer';
import { logService } from '../lib/log-service';

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

interface FontLoaderProps {
  fonts: FontDefinition[];
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
  fallbackFonts?: string[];
  children?: React.ReactNode;
}

export function FontLoader({
  fonts,
  onComplete,
  onProgress,
  onError,
  fallbackFonts = ['system-ui', 'sans-serif'],
  children
}: FontLoaderProps) {
  const [loadedFonts, setLoadedFonts] = useState<number>(0);
  const [totalFonts, setTotalFonts] = useState<number>(fonts.length);
  const [isComplete, setIsComplete] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    // Reset state when fonts change
    setLoadedFonts(0);
    setTotalFonts(fonts.length);
    setIsComplete(false);
    setError(null);
    
    // Skip if no fonts to load
    if (fonts.length === 0) {
      setIsComplete(true);
      if (onComplete) {
        onComplete();
      }
      return;
    }
    
    // Apply fallback fonts to body
    if (fallbackFonts && fallbackFonts.length > 0) {
      document.body.style.fontFamily = fallbackFonts.join(', ');
    }
    
    // Load fonts
    const loadAllFonts = async () => {
      try {
        // Load fonts in parallel
        await Promise.all(
          fonts.map(async (font, index) => {
            try {
              await fontOptimizer.loadFont(font);
              
              // Update loaded fonts count
              setLoadedFonts(prev => {
                const newCount = prev + 1;
                
                // Call progress callback
                if (onProgress) {
                  onProgress(newCount / totalFonts);
                }
                
                return newCount;
              });
            } catch (fontError) {
              logService.log('error', `Failed to load font: ${font.family}`, fontError, 'FontLoader');
              // Continue loading other fonts
            }
          })
        );
        
        // Apply primary font to body
        if (fonts.length > 0 && fonts[0].family) {
          const fontFamily = [fonts[0].family, ...(fallbackFonts || [])].join(', ');
          document.body.style.fontFamily = fontFamily;
        }
        
        // Mark as complete
        setIsComplete(true);
        
        // Call complete callback
        if (onComplete) {
          onComplete();
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load fonts');
        setError(error);
        
        // Call error callback
        if (onError) {
          onError(error);
        }
        
        logService.log('error', 'Failed to load fonts', error, 'FontLoader');
      }
    };
    
    loadAllFonts();
  }, [fonts, onComplete, onProgress, onError, fallbackFonts]);
  
  // Apply CSS variables for font families
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      
      // Set CSS variables for each font family
      fonts.forEach(font => {
        const cssVarName = `--font-${font.family.toLowerCase().replace(/\s+/g, '-')}`;
        const fontStack = [font.family, ...(fallbackFonts || [])].join(', ');
        root.style.setProperty(cssVarName, fontStack);
      });
      
      // Set primary font variable
      if (fonts.length > 0) {
        const primaryFont = fonts[0].family;
        const primaryFontStack = [primaryFont, ...(fallbackFonts || [])].join(', ');
        root.style.setProperty('--font-primary', primaryFontStack);
      }
    }
  }, [fonts, fallbackFonts]);
  
  return (
    <>
      {/* Font loading indicator */}
      {!isComplete && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 9999,
            pointerEvents: 'none',
            opacity: 0.7
          }}
        >
          Loading fonts: {loadedFonts}/{totalFonts}
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            background: 'rgba(255, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            zIndex: 9999
          }}
        >
          Error loading fonts: {error.message}
        </div>
      )}
      
      {/* Render children */}
      {children}
    </>
  );
}
