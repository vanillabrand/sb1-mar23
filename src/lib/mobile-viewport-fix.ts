/**
 * Mobile Viewport Fix
 * 
 * This module provides functions to fix common mobile viewport issues,
 * particularly the 100vh issue on mobile browsers.
 */

// Set the viewport height CSS variable
export function setViewportHeight(): void {
  // First we get the viewport height and multiply it by 1% to get a value for a vh unit
  const vh = window.innerHeight * 0.01;
  // Then we set the value in the --vh custom property to the root of the document
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

// Detect if the device is a mobile device
export function isMobileDevice(): boolean {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(navigator.userAgent);
  const isMobileWidth = window.innerWidth < 768;
  
  return isIOS || isAndroid || isMobileWidth;
}

// Add appropriate classes to the body element
export function addMobileClasses(): void {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(navigator.userAgent);
  
  if (isIOS) {
    document.body.classList.add('ios-device');
  }
  
  if (isAndroid) {
    document.body.classList.add('android-device');
  }
  
  if (isIOS || isAndroid || window.innerWidth < 768) {
    document.body.classList.add('mobile-device');
  }
}

// Initialize all mobile viewport fixes
export function initMobileViewportFixes(): void {
  // Set initial viewport height
  setViewportHeight();
  
  // Add mobile classes
  addMobileClasses();
  
  // Update on resize
  window.addEventListener('resize', setViewportHeight);
  
  // Update on orientation change
  window.addEventListener('orientationchange', () => {
    // Delay the update to ensure the browser has completed the orientation change
    setTimeout(setViewportHeight, 100);
  });
}
