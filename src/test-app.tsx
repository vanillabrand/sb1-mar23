import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Simple test component with background and styling
const TestApp = () => {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gunmetal-950">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-neon-raspberry mx-auto"></div>
          <p className="text-gray-400">Loading test application...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gunmetal-950 text-white p-8">
      <div className="max-w-md mx-auto">
        <h1 className="gradient-text mb-6">Test Application</h1>
        
        <div className="panel-metallic p-6 rounded-xl mb-6">
          <h2 className="text-xl font-bold mb-4">Component Test</h2>
          <p className="text-gray-300 mb-4">
            If you can see this content with proper styling, the basic rendering is working.
          </p>
          
          <div className="flex items-center gap-4 mb-6">
            <button 
              onClick={() => setCount(count - 1)}
              className="px-4 py-2 bg-gunmetal-800 hover:bg-gunmetal-700 rounded-lg transition-colors"
            >
              -
            </button>
            
            <span className="text-xl font-bold">{count}</span>
            
            <button 
              onClick={() => setCount(count + 1)}
              className="px-4 py-2 bg-neon-raspberry hover:bg-opacity-90 rounded-lg transition-colors"
            >
              +
            </button>
          </div>
          
          <div className="h-2 w-full bg-gunmetal-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-neon-raspberry to-neon-yellow transition-all duration-300"
              style={{ width: `${Math.abs(count) * 5}%` }}
            ></div>
          </div>
        </div>
        
        <div className="panel-metallic p-6 rounded-xl">
          <h2 className="text-xl font-bold mb-4">Styling Test</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gunmetal-800 p-4 rounded-lg text-center">
              <p className="text-neon-raspberry">Raspberry</p>
            </div>
            <div className="bg-gunmetal-800 p-4 rounded-lg text-center">
              <p className="text-neon-yellow">Yellow</p>
            </div>
            <div className="bg-gunmetal-800 p-4 rounded-lg text-center">
              <p className="text-neon-turquoise">Turquoise</p>
            </div>
            <div className="bg-gunmetal-800 p-4 rounded-lg text-center">
              <p className="text-neon-orange">Orange</p>
            </div>
          </div>
          
          <p className="text-gray-400 text-sm">
            If colors and styling look correct, CSS is working properly.
          </p>
        </div>
      </div>
    </div>
  );
};

// Mount the component to the DOM
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<TestApp />);
} else {
  console.error('Root element not found!');
  
  // Create root element if it doesn't exist
  const newRoot = document.createElement('div');
  newRoot.id = 'root';
  document.body.appendChild(newRoot);
  
  const root = createRoot(newRoot);
  root.render(<TestApp />);
}
