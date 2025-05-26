// Simple test script to verify Rust API integration
console.log('🦀 Testing Rust API Integration...');

// Test health endpoint
async function testHealth() {
  try {
    console.log('Testing health endpoint...');
    const response = await fetch('http://127.0.0.1:3000/health');
    const data = await response.json();
    console.log('✅ Health check successful:', data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error);
    return false;
  }
}

// Test market data endpoint
async function testMarketData() {
  try {
    console.log('Testing market data endpoint...');
    const response = await fetch('http://127.0.0.1:3000/api/market/data/BTC-USDT');
    const data = await response.json();
    console.log('✅ Market data successful:', data);
    return true;
  } catch (error) {
    console.error('❌ Market data failed:', error);
    return false;
  }
}

// Test CORS
async function testCORS() {
  try {
    console.log('Testing CORS...');
    const response = await fetch('http://127.0.0.1:3000/health', {
      method: 'GET',
      headers: {
        'Origin': 'http://localhost:5173',
        'Content-Type': 'application/json'
      }
    });
    console.log('✅ CORS test successful, status:', response.status);
    return true;
  } catch (error) {
    console.error('❌ CORS test failed:', error);
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting Rust API integration tests...\n');

  const healthResult = await testHealth();
  console.log('');

  const marketResult = await testMarketData();
  console.log('');

  const corsResult = await testCORS();
  console.log('');

  console.log('📊 Test Results:');
  console.log(`Health Check: ${healthResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Market Data: ${marketResult ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`CORS: ${corsResult ? '✅ PASS' : '❌ FAIL'}`);

  const allPassed = healthResult && marketResult && corsResult;
  console.log(`\n🎯 Overall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  return allPassed;
}

// Export for use in browser console or Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { testHealth, testMarketData, testCORS, runTests };
} else {
  // Run tests immediately if in browser
  runTests();
}
