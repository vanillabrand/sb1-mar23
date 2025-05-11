import React, { useEffect, useState } from 'react';
import { Zap, ArrowRight } from 'lucide-react';

export function Preloader() {
  const [visibilityState, setVisibilityState] = useState<string>(document.visibilityState);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [loadingTime, setLoadingTime] = useState(0);
  const [fadeIn, setFadeIn] = useState(false);

  // Detect Safari and iOS
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
    (navigator.userAgent.includes('AppleWebKit') && !navigator.userAgent.includes('Chrome'));
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Show continue button sooner on Safari/iOS
  const timeToShowButton = (isSafari || isIOS) ? 5000 : 10000; // 5 seconds for Safari/iOS, 10 for others

  useEffect(() => {
    // Trigger fade-in animation after component mounts
    setTimeout(() => {
      setFadeIn(true);
    }, 50);

    // Handle visibility change events
    const handleVisibilityChange = () => {
      setVisibilityState(document.visibilityState);

      // If the page becomes visible again and was previously hidden
      if (document.visibilityState === 'visible' && visibilityState === 'hidden') {
        console.log('Page visibility changed from hidden to visible');
        // Don't reload the page, just update the state
      }
    };

    // Add event listener for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Set up a timer to show the continue button after a delay
    const timer = setTimeout(() => {
      setShowContinueButton(true);
    }, timeToShowButton);

    // Set up an interval to track loading time
    const interval = setInterval(() => {
      setLoadingTime(prev => prev + 1);
    }, 1000);

    // Clean up the event listener when component unmounts
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [visibilityState, timeToShowButton]);

  // Function to manually continue past the preloader
  const handleContinue = () => {
    // Dispatch a custom event that App.tsx can listen for
    window.dispatchEvent(new CustomEvent('manual-continue'));

    // For Safari, force a layout recalculation
    if (isSafari || isIOS) {
      document.body.style.display = 'none';
      void document.body.offsetHeight;
      document.body.style.display = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-gunmetal-950 flex items-center justify-center z-50">
      <div className="text-center">
        {/* Logo */}
        <div
          className={`relative w-20 h-20 mx-auto mb-8 transition-all duration-500 ${fadeIn ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}
        >
          {/* Outer Ring */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-neon-turquoise via-neon-yellow to-neon-raspberry animate-spin" style={{ animationDuration: '3s' }} />

          {/* Inner Shape */}
          <div className="absolute inset-[2px] rounded-xl bg-gunmetal-950 flex items-center justify-center">
            <Zap className="w-10 h-10 text-neon-yellow transform rotate-12" />
          </div>
        </div>

        {/* Title */}
        <h1
          className={`text-2xl font-bold mb-4 transition-all duration-500 delay-200 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
        >
          <span className="bg-gradient-to-r from-neon-raspberry via-neon-orange to-neon-yellow bg-clip-text text-transparent">
            GIGAntic
          </span>
        </h1>

        {/* Progress Bar */}
        <div className="w-48 h-1 bg-gunmetal-800 rounded-full overflow-hidden mx-auto">
          <div className="w-full h-full bg-gradient-to-r from-neon-turquoise via-neon-yellow to-neon-raspberry animate-progress" />
        </div>

        {/* Loading Text */}
        <p
          className={`mt-4 text-gray-400 text-sm transition-all duration-500 delay-400 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}
        >
          Initializing AI Trading Platform {loadingTime > 0 && `(${loadingTime}s)`}
        </p>

        {/* Continue Button */}
        {showContinueButton && (
          <div
            className={`mt-6 transition-all duration-500 ${fadeIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
          >
            <button
              onClick={handleContinue}
              className="px-4 py-2 bg-neon-raspberry text-white rounded-lg hover:bg-opacity-90 transition-all duration-300 flex items-center gap-2 mx-auto"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-gray-500 mt-2">
              {(isSafari || isIOS) ?
                "Safari detected. Click to continue if loading takes too long." :
                "Click to continue if loading takes too long."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
