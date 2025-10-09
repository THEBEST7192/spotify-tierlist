import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables (only for local development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env.local' });
}

const app = express();
const PORT = process.env.PORT || 3001;

// Last.fm API configuration
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/'

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Last.fm API server is running' });
});

// Get similar tracks endpoint
app.get('/api/similar-tracks', async (req, res) => {
  try {
    const { artist, track } = req.query;
    
    if (!artist || !track) {
      return res.status(400).json({ 
        error: 'Missing required parameters: artist and track' 
      });
    }

    if (!LASTFM_API_KEY) {
      return res.status(500).json({ 
        error: 'Last.fm API key not configured' 
      });
    }

    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'track.getSimilar',
        artist: artist,
        track: track,
        api_key: LASTFM_API_KEY,
        format: 'json'
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching similar tracks:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch similar tracks',
      details: error.response?.data || error.message 
    });
  }
});

// Get similar artists endpoint
app.get('/api/similar-artists', async (req, res) => {
  try {
    const { artist, limit = 10 } = req.query;
    
    if (!artist) {
      return res.status(400).json({ 
        error: 'Missing required parameter: artist' 
      });
    }

    if (!LASTFM_API_KEY) {
      return res.status(500).json({ 
        error: 'Last.fm API key not configured' 
      });
    }

    const response = await axios.get(LASTFM_BASE_URL, {
      params: {
        method: 'artist.getSimilar',
        artist: artist,
        api_key: LASTFM_API_KEY,
        format: 'json',
        limit: limit
      }
    });

    res.json(response.data);
  } catch (error) {
    console.error('Error fetching similar artists:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch similar artists',
      details: error.response?.data || error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Last.fm API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
  });
}

export default app;
