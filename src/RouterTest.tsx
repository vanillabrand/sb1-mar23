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

// Function to test the router
export function testRouter() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  try {
    const root = createRoot(container);
    root.render(
      <React.StrictMode>
        <RouterProvider router={router} />
      </React.StrictMode>
    );
    console.log('Router test successful!');
    return true;
  } catch (error) {
    console.error('Router test failed:', error);
    document.body.innerHTML = `
      <div style="padding: 20px; font-family: Arial, sans-serif; color: red;">
        <h1>Router Error</h1>
        <p>Error: ${error instanceof Error ? error.message : String(error)}</p>
        <pre>${error instanceof Error && error.stack ? error.stack : 'No stack trace available'}</pre>
      </div>
    `;
    return false;
  }
}
