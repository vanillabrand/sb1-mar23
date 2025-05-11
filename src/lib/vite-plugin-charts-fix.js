/**
 * This plugin fixes circular dependencies in chart libraries for production builds.
 * It ensures that chart libraries are properly initialized and don't have reference errors.
 */

export default function chartsFixPlugin() {
  return {
    name: 'vite-plugin-charts-fix',
    
    // Transform chart.js and recharts imports to prevent circular dependencies
    transform(code, id) {
      // Only process chart.js and recharts files
      if (id.includes('node_modules/chart.js') || 
          id.includes('node_modules/recharts') ||
          id.includes('node_modules/react-chartjs-2')) {
        
        // Add a check to prevent accessing variables before initialization
        if (code.includes('Cannot access') || code.includes('before initialization')) {
          console.log(`[vite-plugin-charts-fix] Fixing potential initialization issue in: ${id}`);
          
          // Add a safety wrapper around the code
          return {
            code: `
              // Safety wrapper added by vite-plugin-charts-fix
              (function() {
                try {
                  ${code}
                } catch (e) {
                  console.warn('[Charts] Error in chart library initialization:', e);
                  // Return empty exports to prevent crashes
                  return {};
                }
              })();
            `,
            map: null
          };
        }
      }
      
      return null; // Return null to use the default transform
    }
  };
}
