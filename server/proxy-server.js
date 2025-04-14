const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// News API proxy endpoint
app.get('/api/news', async (req, res) => {
  try {
    const { asset, apiKey } = req.query;
    
    if (!asset || !apiKey) {
      return res.status(400).json({ error: 'Missing required parameters: asset and apiKey' });
    }
    
    // Construct the URL for the Coindesk API
    const url = `https://data-api.coindesk.com/news/v1/article/list?lang=EN&limit=10&categories=${asset}`;
    
    // Make the request to the Coindesk API
    const response = await axios.get(url, {
      headers: {
        'x-api-key': apiKey,
        'Accept': 'application/json'
      }
    });
    
    // Return the data from the Coindesk API
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying news request:', error.message);
    
    // Return a more detailed error response
    res.status(500).json({
      error: 'Failed to fetch news data',
      details: error.message,
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
