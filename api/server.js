import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { MongoClient, ServerApiVersion } from 'mongodb';
import { createTierlistsRouter } from './routes/tierlists.js';
import { ensureTierlistIndexes } from './db/ensureTierlistIndexes.js';
import { ensureUserIndexes } from './db/ensureUserIndexes.js';
import { createAuthRouter } from './routes/auth.js';
import { createSpotifyAccountsRouter } from './routes/spotifyAccounts.js';
import { createAuthMiddleware } from './middleware/auth.js';

// Load environment variables (only for local development)
if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: '../.env.local' });
}

const app = express();
const PORT = process.env.PORT || 3001;

// Last.fm API configuration
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LASTFM_BASE_URL = 'https://ws.audioscrobbler.com/2.0/'

const MONGODB_USER = process.env.MONGODB_USER;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
const MONGODB_HOST = process.env.MONGODB_HOST;
const MONGODB_CLIENT_NAME = process.env.MONGODB_CLIENT_NAME;
const MONGODB_DB = process.env.MONGODB_DB;

const MONGODB_URI = `mongodb+srv://${encodeURIComponent(MONGODB_USER)}:${encodeURIComponent(MONGODB_PASSWORD)}@${MONGODB_HOST}/${MONGODB_DB}?retryWrites=true&w=majority&appName=${MONGODB_CLIENT_NAME}`;

const mongoClient = new MongoClient(MONGODB_URI, {
  readPreference: 'primary',
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function initMongoConnection() {
  try {
    await mongoClient.connect();
    const db = mongoClient.db(MONGODB_DB);
    await db.command({ ping: 1 });
    await ensureTierlistIndexes(db);
    await ensureUserIndexes(db);
    app.locals.mongoClient = mongoClient;
    app.locals.db = db;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    app.locals.mongoClient = null; // Set to null if connection fails
    app.locals.db = null;
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

async function ensureDb(req, res, next) {
  try {
    if (!app.locals.db) {
      await initMongoConnection();
    }

    const db = app.locals.db;
    if (!db) {
      return res.status(503).json({ error: 'Database not connected' });
    }

    req.db = db;
    return next();
  } catch (err) {
    console.error('Error ensuring MongoDB connection:', err);
    return res.status(503).json({ error: 'Database not connected' });
  }
}

app.use('/api/auth', ensureDb, (req, res, next) => {
  const { optionalAuth, requireAuth } = createAuthMiddleware(req.db);
  const router = createAuthRouter(req.db, { requireAuth, optionalAuth });
  return router(req, res, next);
});

app.use('/api/spotify', ensureDb, (req, res, next) => {
  const { optionalAuth, requireAuth } = createAuthMiddleware(req.db);
  const router = createSpotifyAccountsRouter(req.db, { requireAuth, optionalAuth });
  return router(req, res, next);
});

app.use('/api/tierlists', ensureDb, (req, res, next) => {
  const { optionalAuth, requireAuth } = createAuthMiddleware(req.db);
  const router = createTierlistsRouter(req.db, { optionalAuth, requireAuth });
  return router(req, res, next);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  let db = false;
  try {
    if (app.locals.mongoClient) {
      await app.locals.mongoClient.db(MONGODB_DB).command({ ping: 1 });
      db = true;
    }
  } catch {
    db = false;
  }
  res.json({ status: 'OK', message: 'Last.fm API server is running', db });
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

// Batch oEmbed endpoint for fetching multiple track covers
app.post('/api/oembed/batch', async (req, res) => {
  try {
    const { trackIds } = req.body;
    
    if (!trackIds || !Array.isArray(trackIds) || trackIds.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid trackIds array' });
    }

    if (trackIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 track IDs allowed per request' });
    }

    // Fetch oEmbed data for all tracks in parallel
    const promises = trackIds.map(async (trackId) => {
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`;
        const response = await axios.get(oembedUrl, {
          headers: {
            'User-Agent': process.env.USER_AGENT
          }
        });
        return {
          trackId,
          thumbnail_url: response.data.thumbnail_url || null,
          success: true
        };
      } catch (error) {
        console.error(`Error fetching oEmbed for track ${trackId}:`, error.message);
        return {
          trackId,
          thumbnail_url: null,
          success: false,
          error: error.message
        };
      }
    });

    const results = await Promise.all(promises);
    res.json({ results });
  } catch (error) {
    console.error('Error fetching batch oEmbed:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch batch oEmbed data',
      details: error.message 
    });
  }
});
app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    await initMongoConnection();
    app.listen(PORT, () => {
      console.log(`Last.fm API server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  })();
}

export default app;
