import express from 'express';
import { normalizeUsername, hashPassword, verifyPassword } from '../utils/authUtils.js';
import { signAccessToken } from '../utils/jwtUtils.js';

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function getLinkedSpotifyHashes(user) {
  if (!user || !user.linkedSpotifyAccounts) {
    return new Set();
  }
  return new Set(user.linkedSpotifyAccounts.map(account => account.spotifyUserHash));
}

export function createAuthRouter(db, { requireAuth, optionalAuth }) {
  const router = express.Router();
  const users = db.collection('users');

  router.post('/register', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const normalized = normalizeUsername(username);
      if (!normalized) {
        return res.status(400).json({ error: 'username is required' });
      }
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'password must be at least 6 characters' });
      }

      // Check if username already exists
      const existingUser = await users.findOne({ usernameLower: normalized });
      if (existingUser) {
        return res.status(409).json({ error: 'username already exists' });
      }

      const now = new Date();
      const doc = {
        username: username.trim(),
        usernameLower: normalized,
        passwordHash: await hashPassword(password),
        createdAt: now,
        updatedAt: now
      };

      // console.log('Attempting to insert new user:', normalized);
      const result = await users.insertOne(doc);
      // console.log('Insert successful, ID:', result.insertedId);
      const saved = { ...doc, _id: result.insertedId };
      const token = signAccessToken({ sub: String(result.insertedId) });

      return res.status(201).json({ token, user: sanitizeUser(saved) });
    } catch (err) {
      console.error('Registration error:', err);
      if (err?.code === 11000) {
        return res.status(409).json({ error: 'username already exists' });
      }
      return res.status(500).json({ error: 'failed to register' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const normalized = normalizeUsername(username);
      if (!normalized) {
        return res.status(400).json({ error: 'username is required' });
      }
      if (typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'password is required' });
      }

      const user = await users.findOne({ usernameLower: normalized });
      if (!user) {
        return res.status(401).json({ error: 'invalid credentials' });
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: 'invalid credentials' });
      }

      const token = signAccessToken({ sub: String(user._id) });
      return res.json({ token, user: sanitizeUser(user) });
    } catch (err) {
      console.error('Error logging in:', err);
      return res.status(500).json({ error: 'failed to login' });
    }
  });

  router.get('/me', requireAuth, async (req, res) => {
    return res.json({ user: sanitizeUser(req.user) });
  });

  router.put('/me', requireAuth, async (req, res) => {
    try {
      const { username, password } = req.body || {};
      const userId = req.user._id;
      
      // Validate username if provided
      if (username !== undefined) {
        const normalized = normalizeUsername(username);
        if (!normalized) {
          return res.status(400).json({ error: 'username is required' });
        }
        
        // Check if new username already exists (and isn't the current user)
        const existingUser = await users.findOne({ 
          usernameLower: normalized,
          _id: { $ne: userId }
        });
        if (existingUser) {
          return res.status(409).json({ error: 'username already exists' });
        }
        
        // Update username
        await users.updateOne(
          { _id: userId },
          { 
            $set: { 
              username: username.trim(),
              usernameLower: normalized,
              updatedAt: new Date()
            }
          }
        );
      }
      
      // Validate password if provided
      if (password !== undefined) {
        if (typeof password !== 'string' || password.length < 6) {
          return res.status(400).json({ error: 'password must be at least 6 characters' });
        }
        
        // Update password
        const passwordHash = await hashPassword(password);
        await users.updateOne(
          { _id: userId },
          { 
            $set: { 
              passwordHash,
              updatedAt: new Date()
            }
          }
        );
      }
      
      // Return updated user
      const updatedUser = await users.findOne({ _id: userId });
      return res.json({ user: sanitizeUser(updatedUser) });
    } catch (err) {
      console.error('Error updating user:', err);
      if (err?.code === 11000) {
        return res.status(409).json({ error: 'username already exists' });
      }
      return res.status(500).json({ error: 'failed to update user' });
    }
  });

  router.delete('/me', requireAuth, async (req, res) => {
    try {
      const userId = req.user._id;
      
      // First, delete all tierlists associated user
      const tierlists = db.collection('tierlists');
      const linked = Array.from(getLinkedSpotifyHashes(req.user));
      await tierlists.deleteMany({
        $or: [
          { ownerUserId: String(userId) },
          ...(linked.length ? [{ spotifyUserHash: { $in: linked } }] : [])
        ]
      });
      
      // Then delete the user account
      const result = await users.deleteOne({ _id: userId });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'user not found' });
      }
      
      return res.json({ message: 'account deleted successfully' });
    } catch (err) {
      console.error('Error deleting user account:', err);
      return res.status(500).json({ error: 'failed to delete account' });
    }
  });
  
  // GET current Spotify user info  
  router.get('/spotify/me', optionalAuth, (req, res) => {
    try {
      if (req.spotifyUser) {
        return res.json({
          id: req.spotifyUser.id,
          displayName: req.spotifyUser.displayName
        });
      } else {
        return res.json(null);
      }
    } catch (err) {
      console.error('Error getting Spotify user info:', err);
      return res.status(500).json({ error: 'Failed to get Spotify user info' });
    }
  });

  return router;
}
