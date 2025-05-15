import React from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

// Simple component to test router
function TestComponent() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Router Test</h1>
      <p>If you can see this, the router is working correctly!</p>
    </div>
  );
}

// Create a simple router
const router = createBrowserRouter([
  {
    path: "*",
    element: <TestComponent />
  }
]);

// Initialize the app
function initApp() {
  // Create root element if it doesn't exist
  let rootElement = document.getElementById('root');
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.appendChild(rootElement);
  }

  // Create root
  const root = createRoot(rootElement);

  // Render the app
  root.render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

// Start the app
initApp();
