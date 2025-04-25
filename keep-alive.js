// Simple script to keep the workspace connection alive
const http = require('http');
const fs = require('fs');

// Create a simple HTTP server that responds with a heartbeat
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Workspace is alive\n');
  
  // Log the heartbeat
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Heartbeat received`);
  
  // Also write to a log file
  fs.appendFileSync('keep-alive.log', `[${timestamp}] Heartbeat received\n`);
});

// Start the server on port 9999
const PORT = 9999;
server.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
  console.log('Your workspace will stay active as long as this script is running');
  console.log('You can make a request to http://localhost:9999 to check if it\'s still alive');
});

// Send a heartbeat to ourselves every 5 minutes
setInterval(() => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Sending self-heartbeat...`);
  
  http.get(`http://localhost:${PORT}`, (res) => {
    // Do nothing with the response
  }).on('error', (err) => {
    console.error('Error sending heartbeat:', err.message);
  });
}, 5 * 60 * 1000); // 5 minutes

// Log startup
const startTimestamp = new Date().toISOString();
console.log(`[${startTimestamp}] Keep-alive service started`);
fs.writeFileSync('keep-alive.log', `[${startTimestamp}] Keep-alive service started\n`);
