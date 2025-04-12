import React from 'react';
import { createRoot } from 'react-dom/client';

// Simple test component
const TestComponent = () => {
  return (
    <div style={{ 
      backgroundColor: 'white', 
      color: 'black', 
      padding: '20px',
      margin: '20px',
      borderRadius: '8px'
    }}>
      <h1>Test Component</h1>
      <p>If you can see this, React is working!</p>
    </div>
  );
};

// Mount the component to the DOM
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<TestComponent />);
}
