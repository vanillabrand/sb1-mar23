import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { imageOptimizer } from '../lib/image-optimizer';
import { logService } from '../lib/log-service';

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'original';
  lazy?: boolean;
  placeholderColor?: string;
  onLoad?: () => void;
  onError?: () => void;
}

export function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
  quality = 80,
  format = 'webp',
  lazy = true,
  placeholderColor = '#1e293b',
  onLoad,
  onError
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isVisible, setIsVisible] = useState(!lazy);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Set up intersection observer for lazy loading
  useEffect(() => {
    if (!lazy) {
      setIsVisible(true);
      return;
    }
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '200px', // Load images when they're 200px from viewport
        threshold: 0.01
      }
    );
    
    if (imageRef.current) {
      observer.observe(imageRef.current);
    }
    
    return () => {
      observer.disconnect();
    };
  }, [lazy]);
  
  // Load optimized image when visible
  useEffect(() => {
    if (!isVisible || !src) return;
    
    const loadImage = async () => {
      try {
        setIsLoading(true);
        
        // Get optimized image URL
        const optimizedSrc = await imageOptimizer.getOptimizedImageUrl(src, {
          width,
          height,
          quality,
          format,
          placeholder: true
        });
        
        setImageSrc(optimizedSrc);
        setIsLoading(false);
        
        // Preload the actual image if we got a placeholder
        if (optimizedSrc.startsWith('data:image/svg+xml')) {
          const actualSrc = await imageOptimizer.getOptimizedImageUrl(src, {
            width,
            height,
            quality,
            format
          });
          
          setImageSrc(actualSrc);
        }
      } catch (error) {
        logService.log('error', `Failed to load optimized image: ${src}`, error, 'OptimizedImage');
        setIsError(true);
        setIsLoading(false);
        
        // Fall back to original image
        setImageSrc(src);
        
        if (onError) {
          onError();
        }
      }
    };
    
    loadImage();
  }, [src, width, height, quality, format, isVisible]);
  
  // Generate placeholder styles
  const placeholderStyles: React.CSSProperties = {
    backgroundColor: placeholderColor,
    width: width ? `${width}px` : '100%',
    height: height ? `${height}px` : '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    fontSize: '14px',
    ...style
  };
  
  // Handle image load event
  const handleImageLoad = () => {
    setIsLoading(false);
    if (onLoad) {
      onLoad();
    }
  };
  
  // Handle image error event
  const handleImageError = () => {
    setIsError(true);
    setIsLoading(false);
    if (onError) {
      onError();
    }
  };
  
  return (
    <div
      ref={imageRef}
      className={`optimized-image-container ${className}`}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {isLoading && (
        <div style={placeholderStyles}>
          <div className="animate-pulse">Loading...</div>
        </div>
      )}
      
      {isError && !imageSrc && (
        <div
          style={placeholderStyles}
          className="optimized-image-error"
        >
          <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Failed to load image</span>
          </div>
        </div>
      )}
      
      {isVisible && imageSrc && (
        <motion.img
          src={imageSrc}
          alt={alt}
          width={width}
          height={height}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            display: isLoading ? 'none' : 'block',
            width: width ? `${width}px` : '100%',
            height: height ? `${height}px` : 'auto',
            objectFit: 'cover'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isLoading ? 0 : 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </div>
  );
}
