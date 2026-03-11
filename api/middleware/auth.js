import { ObjectId } from 'mongodb';
import { verifyAccessToken } from '../utils/jwtUtils.js';
import axios from 'axios';

export function createAuthMiddleware(db) {
  const users = db.collection('users');
  
  // Simple in-memory cache for Spotify user info (5 minute TTL)
  const spotifyCache = new Map();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  const optionalAuth = async (req, _res, next) => {
    try {
      // Try JWT token for TuneTier auth
      const raw = req.headers.authorization;
      if (raw && typeof raw === 'string') {
        const match = raw.match(/^Bearer\s+(.+)$/i);
        if (match) {
          const token = match[1];
          const decoded = verifyAccessToken(token);
          const userId = decoded?.sub;
          if (userId && typeof userId === 'string') {
            const user = await users.findOne({ _id: new ObjectId(userId) });
            if (user) {
              req.user = user;
            }
          }
        }
      }

      // Also try Spotify auth (can work alongside TuneTier auth) - with caching
      const spotifyAccessToken = req.headers['x-spotify-access-token'];
      if (spotifyAccessToken && typeof spotifyAccessToken === 'string') {
        // Check cache first
        const cacheKey = spotifyAccessToken.slice(0, 20); // Use first 20 chars as key
        const cached = spotifyCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          req.spotifyUser = cached.data;
        } else {
          try {
            // Verify Spotify token by calling Spotify API with retry logic
            // console.log('Attempting Spotify API verification with token:', spotifyAccessToken.slice(0, 20) + '...');
            
            const makeSpotifyRequest = async (_retryCount = 0) => {
              const response = await axios.get('https://api.spotify.com/v1/me', {
                headers: {
                  'Authorization': `Bearer ${spotifyAccessToken}`,
                  'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 second timeout
              });
              
              return response;
            };
            
            let response;
            try {
              response = await makeSpotifyRequest();
            } catch (err) {
              if (err.response?.status === 429 && err.response?.headers?.['retry-after']) {
                const retryAfter = parseInt(err.response.headers['retry-after']);
                console.log(`Rate limited, retrying after ${retryAfter} seconds...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                response = await makeSpotifyRequest(1);
              } else {
                throw err;
              }
            }
            
            // console.log('Spotify API response status:', response.status);
            // console.log('Spotify API response data:', response.data);
            
            const spotifyUser = {
              id: response.data.id,
              displayName: response.data.display_name || response.data.id
            };
            
            // console.log('Created spotifyUser object:', spotifyUser);
            
            // Cache the result
            spotifyCache.set(cacheKey, {
              data: spotifyUser,
              timestamp: Date.now()
            });
            
            req.spotifyUser = spotifyUser;
            
            // Also store in a global cache for frontend access
            global.spotifyUserCache = global.spotifyUserCache || new Map();
            global.spotifyUserCache.set(spotifyAccessToken, {
              user: spotifyUser,
              timestamp: Date.now()
            });
          } catch (err) {
            // Spotify token invalid, continue without user
            console.error('Spotify API verification failed:', {
              status: err.response?.status,
              statusText: err.response?.statusText,
              data: err.response?.data,
              message: err.message,
              url: err.config?.url,
              retryAfter: err.response?.headers?.['retry-after']
            });
          }
        }
      }

      return next();
    } catch {
      req.user = null;
      req.spotifyUser = null;
      return next();
    }
  };

  const requireAuth = async (req, res, next) => {
    await optionalAuth(req, res, async () => {
      if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return next();
    });
  };

  return { optionalAuth, requireAuth };
}
