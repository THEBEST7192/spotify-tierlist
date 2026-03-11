import express from 'express';
import { hashSpotifyUserId } from '../utils/tierlistUtils.js';

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

export function createSpotifyAccountsRouter(db, { requireAuth }) {
  const router = express.Router();
  const users = db.collection('users', {
    readPreference: 'primary',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' }
  });

  router.get('/accounts', requireAuth, async (req, res) => {
    return res.json({ spotifyAccounts: req.user.spotifyAccounts || [] });
  });

  router.post('/link', requireAuth, async (req, res) => {
    try {
      const { spotifyUserId, displayName } = req.body || {};
      if (typeof spotifyUserId !== 'string' || !spotifyUserId.trim()) {
        return res.status(400).json({ error: 'spotifyUserId is required' });
      }

      const spotifyUserHash = hashSpotifyUserId(spotifyUserId.trim());
      const now = new Date();
      const account = {
        spotifyUserHash,
        displayName: typeof displayName === 'string' ? displayName.trim() : '',
        linkedAt: now
      };

      await users.updateOne(
        { _id: req.user._id },
        {
          $set: { updatedAt: now },
          $addToSet: { spotifyAccounts: account }
        }
      );

      const updated = await users.findOne({ _id: req.user._id });
      req.user = updated;
      return res.json({ user: sanitizeUser(updated), spotifyUserHash });
    } catch (err) {
      console.error('Error linking Spotify account:', err);
      return res.status(500).json({ error: 'Failed to link Spotify account' });
    }
  });

  router.delete('/unlink/:spotifyUserHash', requireAuth, async (req, res) => {
    try {
      const { spotifyUserHash } = req.params;
      if (typeof spotifyUserHash !== 'string' || !spotifyUserHash.trim()) {
        return res.status(400).json({ error: 'spotifyUserHash is required' });
      }
      const now = new Date();
      await users.updateOne(
        { _id: req.user._id },
        {
          $set: { updatedAt: now },
          $pull: { spotifyAccounts: { spotifyUserHash: spotifyUserHash.trim() } }
        }
      );
      const updated = await users.findOne({ _id: req.user._id });
      req.user = updated;
      return res.json({ user: sanitizeUser(updated) });
    } catch (err) {
      console.error('Error unlinking Spotify account:', err);
      return res.status(500).json({ error: 'Failed to unlink Spotify account' });
    }
  });

  return router;
}
