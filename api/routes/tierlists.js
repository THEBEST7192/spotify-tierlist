import express from 'express';
import { buildTierListDocument, hashSpotifyUserId } from '../utils/tierlistUtils.js';

export function createTierlistsRouter(db) {
  const router = express.Router();
  const collection = db.collection('tierlists', {
    readPreference: 'primary',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' }
  });

  //
  // CREATE new tierlist
  //
  router.post('/', async (req, res) => {
    try {
      const {
        spotifyUserId,
        username,
        tierListName,
        coverImage,
        tiers,
        tierOrder,
        state,
        isPublic
      } = req.body;

      if (!spotifyUserId || !username || !tierListName) {
        return res.status(400).json({ error: 'spotifyUserId, username and tierListName are required' });
      }

      const maxRetries = 5;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const doc = buildTierListDocument({
          spotifyUserId,
          username,
          tierListName,
          coverImage,
          tiers,
          tierOrder,
          state,
          isPublic
        });

        try {
          const result = await collection.insertOne(doc);
          const saved = { ...doc, _id: result.insertedId };
          return res.status(201).json(saved);
        } catch (err) {
          if (err.code === 11000 && attempt < maxRetries - 1) {
            continue;
          }

          if (err.code === 11000) {
            console.error('Failed to create tierlist after duplicate shortId retries:', err);
            return res.status(500).json({ error: 'Failed to generate unique tierlist ID' });
          }

          throw err;
        }
      }
    } catch (err) {
      console.error('Error creating tierlist:', err);
      return res.status(500).json({ error: 'Failed to create tierlist' });
    }
  });

  //
  // GET all public tierlists
  //
  router.get('/public', async (req, res) => {
    try {
      const { limit } = req.query;
      const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
      const cursor = collection.find({ isPublic: true }).sort({ createdAt: -1 }).limit(limitNum);
      const lists = await cursor.toArray();
      return res.json(lists);
    } catch (err) {
      console.error('Error fetching public tierlists:', err);
      return res.status(500).json({ error: 'Failed to fetch public tierlists' });
    }
  });

  //
  // GET all tierlists for the current user (public + private)
  //
  router.get('/user/self', async (req, res) => {
    try {
      const { spotifyUserId } = req.query;

      if (!spotifyUserId) {
        return res.status(400).json({ error: 'spotifyUserId is required' });
      }

      const spotifyUserHash = hashSpotifyUserId(spotifyUserId);
      const cursor = collection.find({ spotifyUserHash }).sort({ createdAt: -1 });
      const lists = await cursor.toArray();
      return res.json(lists);
    } catch (err) {
      console.error('Error fetching user tierlists:', err);
      return res.status(500).json({ error: 'Failed to fetch user tierlists' });
    }
  });

  //
  // GET tierlist by shortId
  //
  router.get('/:shortId', async (req, res) => {
    try {
      const { shortId } = req.params;
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      return res.json(list);
    } catch (err) {
      console.error('Error fetching tierlist:', err);
      return res.status(500).json({ error: 'Failed to fetch tierlist' });
    }
  });

  //
  // GET all public tierlists for a username
  //
  router.get('/user/:username/public', async (req, res) => {
    try {
      const { username } = req.params;
      const cursor = collection.find({ username, isPublic: true }).sort({ createdAt: -1 });
      const lists = await cursor.toArray();
      return res.json(lists);
    } catch (err) {
      console.error('Error fetching tierlists:', err);
      return res.status(500).json({ error: 'Failed to fetch tierlists' });
    }
  });

  //
  // UPDATE tierlist by shortId
  // Requires spotifyUserId in body to verify ownership.
  //
  router.put('/:shortId', async (req, res) => {
    try {
      const { shortId } = req.params;
      const { spotifyUserId, ...updateData } = req.body;

      if (!spotifyUserId) {
        return res.status(400).json({ error: 'spotifyUserId is required' });
      }

      const spotifyUserHash = hashSpotifyUserId(spotifyUserId);
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (list.spotifyUserHash !== spotifyUserHash) {
        return res.status(403).json({ error: 'Unauthorized update attempt' });
      }

      const updated = {
        ...updateData,
        updatedAt: new Date()
      };

      const result = await collection.findOneAndUpdate(
        { shortId },
        { $set: updated },
        { returnDocument: 'after' }
      );

      return res.json(result);
    } catch (err) {
      console.error('Error updating tierlist:', err);
      return res.status(500).json({ error: 'Failed to update tierlist' });
    }
  });

  //
  // DELETE a specific tierlist by shortId
  //
  router.delete('/:shortId', async (req, res) => {
    try {
      const { shortId } = req.params;
      const { spotifyUserId } = req.body;

      if (!spotifyUserId) {
        return res.status(400).json({ error: 'spotifyUserId is required' });
      }

      const spotifyUserHash = hashSpotifyUserId(spotifyUserId);
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (list.spotifyUserHash !== spotifyUserHash) {
        return res.status(403).json({ error: 'Unauthorized delete attempt' });
      }

      await collection.deleteOne({ shortId });
      return res.json({ message: 'Tierlist deleted successfully' });
    } catch (err) {
      console.error('Error deleting tierlist:', err);
      return res.status(500).json({ error: 'Failed to delete tierlist' });
    }
  });

  //
  // DELETE all tierlists for a specific user
  //
  router.delete('/user/all', async (req, res) => {
    try {
      const { spotifyUserId } = req.body;

      if (!spotifyUserId) {
        return res.status(400).json({ error: 'spotifyUserId is required' });
      }

      const spotifyUserHash = hashSpotifyUserId(spotifyUserId);
      const result = await collection.deleteMany({ spotifyUserHash });

      return res.json({ message: `Deleted ${result.deletedCount} tierlists.` });
    } catch (err) {
      console.error('Error deleting all tierlists:', err);
      return res.status(500).json({ error: 'Failed to delete tierlists' });
    }
  });

  //
  // TOGGLE privacy (public/private) for a tierlist
  //
  router.patch('/:shortId/privacy', async (req, res) => {
    try {
      const { shortId } = req.params;
      const { spotifyUserId } = req.body;

      if (!spotifyUserId) {
        return res.status(400).json({ error: 'spotifyUserId is required' });
      }

      const spotifyUserHash = hashSpotifyUserId(spotifyUserId);
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (list.spotifyUserHash !== spotifyUserHash) {
        return res.status(403).json({ error: 'Unauthorized privacy toggle' });
      }

      const newPrivacy = !list.isPublic;

      const result = await collection.findOneAndUpdate(
        { shortId },
        { $set: { isPublic: newPrivacy, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

      return res.json(result);
    } catch (err) {
      console.error('Error toggling privacy:', err);
      return res.status(500).json({ error: 'Failed to toggle privacy' });
    }
  });

  return router;
}
