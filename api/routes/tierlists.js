import express from 'express';
import { buildTierListDocument, hashSpotifyUserId } from '../utils/tierlistUtils.js';
import { ObjectId } from 'mongodb';
import { batchGetRatings } from './ratings.js';

async function getUserData(db, userId) {
  if (!userId) return null;
  const users = db.collection('users');
  const user = await users.findOne({ _id: userId }, { 
    projection: { username: 1, _id: 1 } 
  });
  return user;
}

async function batchGetUserData(db, userIds) {
  if (!userIds || userIds.length === 0) return {};
  const users = db.collection('users');
  
  // Convert string IDs to ObjectIds for MongoDB query
  const objectIds = userIds.map(id => new ObjectId(id));
  
  const userDocs = await users.find({ 
    _id: { $in: objectIds } 
  }, { 
    projection: { _id: 1, username: 1 } 
  }).toArray();
  
  return userDocs.reduce((map, user) => {
    map[String(user._id)] = user.username;
    return map;
  }, {});
}

function getLinkedSpotifyHashes(user) {
  if (!user || !user.linkedSpotifyAccounts) {
    return new Set();
  }
  return new Set(user.linkedSpotifyAccounts.map(account => account.spotifyUserHash));
}

function canReadTierlist(list, user, spotifyUser) {
  if (!list) return false;
  if (list.isPublic) return true;
  if (!user && !spotifyUser) return false;

  if (list.ownerUserId && user && String(list.ownerUserId) === String(user._id)) {
    return true;
  }

  if (list.spotifyUserHash && spotifyUser && list.spotifyUserHash === hashSpotifyUserId(spotifyUser.id)) {
    return true;
  }

  return false;
}

function canWriteTierlist(list, user, spotifyUser) {
  if (!list || (!user && !spotifyUser)) return false;
  if (list.ownerUserId && user && String(list.ownerUserId) === String(user._id)) {
    return true;
  }
  if (list.spotifyUserHash && spotifyUser && list.spotifyUserHash === hashSpotifyUserId(spotifyUser.id)) {
    return true;
  }
  return false;
}

export function createTierlistsRouter(db, { optionalAuth, requireAuth } = {}) {
  const router = express.Router();
  const collection = db.collection('tierlists', {
    readPreference: 'primary',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' }
  });

  const requireAuthMiddleware = typeof requireAuth === 'function'
    ? requireAuth
    : (_req, res) => res.status(500).json({ error: 'Auth middleware not configured' });

  const optionalAuthMiddleware = typeof optionalAuth === 'function'
    ? optionalAuth
    : (req, _res, next) => {
      req.user = null;
      return next();
    };

  //
  // CREATE new tierlist
  //
  router.post('/', requireAuthMiddleware, async (req, res) => {
    try {
      const {
        tierListName,
        description,
        coverImage,
        tiers,
        tierOrder,
        state,
        isPublic,
        spotifyUserId
      } = req.body;

      if (!tierListName) {
        return res.status(400).json({ error: 'tierListName is required' });
      }

      const maxRetries = 5;

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const doc = buildTierListDocument({
          ownerUserId: String(req.user._id),
          spotifyUserId,
          tierListName,
          description,
          coverImage,
          tiers,
          tierOrder,
          state,
          isPublic
        });

        try {
          const result = await collection.insertOne(doc);
          const saved = { ...doc, _id: result.insertedId };
          
          // Add username to response
          const user = await getUserData(db, req.user._id);
          saved.username = user?.username;
          
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
  router.get('/public', optionalAuthMiddleware, async (req, res) => {
    try {
      const { limit } = req.query;
      const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
      const cursor = collection.find(
        { isPublic: true }, 
        { 
          projection: { 
            shortId: 1, 
            tierListName: 1, 
            description: 1, 
            coverImage: 1, 
            isPublic: 1, 
            createdAt: 1, 
            updatedAt: 1,
            ownerUserId: 1,
            spotifyUserHash: 1
          }
        }
      ).sort({ createdAt: -1 }).limit(limitNum).maxTimeMS(10000); // 10 second timeout
      const lists = await cursor.toArray();
      
      // Fetch usernames for TuneTier users using batch lookup
      const userIds = [...new Set(lists
        .filter(list => list.ownerUserId)
        .map(list => list.ownerUserId)
      )];
      
      const userMap = userIds.length > 0 ? await batchGetUserData(db, userIds) : {};
      
      // Fetch ratings for all tierlists
      const shortIds = lists.map(list => list.shortId);
      const userId = req.user ? String(req.user._id) : null;
      const ratingsMap = shortIds.length > 0 ? await batchGetRatings(db, shortIds, userId) : {};
      
      // Add usernames and ratings to lists
      const listsWithUsernames = lists.map(list => ({
        ...list,
        username: list.ownerUserId ? userMap[list.ownerUserId] : list.username,
        rating: ratingsMap[list.shortId] || null
      }));
      
      return res.json(listsWithUsernames);
    } catch (err) {
      console.error('Error fetching public tierlists:', err);
      return res.status(500).json({ error: 'Failed to fetch public tierlists' });
    }
  });

  //
  // GET all tierlists for the current user (public + private)
  //
  router.get('/user/self', optionalAuthMiddleware, async (req, res) => {
    try {
      // Debug: Log authentication state
      // console.log('Auth state in /user/self:', {
      //   hasTuneTierUser: !!req.user,
      //   hasSpotifyUser: !!req.spotifyUser,
      //   tuneTierUserId: req.user?._id,
      //   spotifyUserId: req.spotifyUser?.id,
      //   spotifyDisplayName: req.spotifyUser?.displayName
      // });
      
      // Build single optimized query
      const query = { $or: [] };
      
      // Add TuneTier user condition
      if (req.user) {
        query.$or.push({ ownerUserId: String(req.user._id) });
      }
      
      // Add Spotify user condition
      if (req.spotifyUser) {
        const spotifyUserHash = hashSpotifyUserId(req.spotifyUser.id);
        // console.log('Spotify user hash:', spotifyUserHash);
        query.$or.push({ spotifyUserHash: spotifyUserHash });
      }
      
      // If no auth, return empty
      if (query.$or.length === 0) {
        return res.json([]);
      }
      
      const cursor = collection.find(query, { 
        projection: { 
          shortId: 1, 
          tierListName: 1, 
          description: 1, 
          coverImage: 1, 
          isPublic: 1, 
          createdAt: 1, 
          updatedAt: 1,
          ownerUserId: 1,
          spotifyUserHash: 1
        }
      }).sort({ createdAt: -1 }).maxTimeMS(10000); // 10 second timeout
      
      const lists = await cursor.toArray();
      
      // Fetch usernames for TuneTier users using batch lookup
      const userIds = [...new Set(lists
        .filter(list => list.ownerUserId)
        .map(list => list.ownerUserId)
      )];
      
      const userMap = userIds.length > 0 ? await batchGetUserData(db, userIds) : {};
      
      // Fetch ratings for all tierlists
      const shortIds = lists.map(list => list.shortId);
      const userId = req.user ? String(req.user._id) : null;
      const ratingsMap = shortIds.length > 0 ? await batchGetRatings(db, shortIds, userId) : {};
      
      // Add usernames and ratings to lists
      const finalLists = lists.map(list => ({
        ...list,
        username: list.ownerUserId ? userMap[list.ownerUserId] : list.username,
        rating: ratingsMap[list.shortId] || null
      }));
      
      return res.json(finalLists);
    } catch (err) {
      console.error('Error fetching user tierlists:', err);
      return res.status(500).json({ error: 'Failed to fetch user tierlists' });
    }
  });

  //
  // Transfer ownership of tierlist between Spotify and TuneTier accounts
  //
  router.post('/:shortId/transfer', requireAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;
      
      // Use lean query to find only needed fields
      const list = await collection.findOne(
        { shortId },
        { projection: { shortId: 1, ownerUserId: 1, spotifyUserHash: 1 } }
      );

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      // Require both TuneTier and Spotify auth for transfer
      if (!req.user || !req.spotifyUser) {
        return res.status(403).json({ error: 'Must be logged into both TuneTier and Spotify accounts to transfer ownership' });
      }

      let updateData = {};
      
      // Transfer from Spotify to TuneTier
      if (list.spotifyUserHash && !list.ownerUserId) {
        if (list.spotifyUserHash !== hashSpotifyUserId(req.spotifyUser.id)) {
          return res.status(403).json({ error: 'Cannot transfer ownership - not Spotify owner' });
        }
        updateData = {
          ownerUserId: String(req.user._id),
          spotifyUserHash: null
        };
      }
      // Transfer from TuneTier to Spotify
      else if (list.ownerUserId && !list.spotifyUserHash) {
        if (String(list.ownerUserId) !== String(req.user._id)) {
          return res.status(403).json({ error: 'Cannot transfer ownership - not TuneTier owner' });
        }
        updateData = {
          ownerUserId: null,
          spotifyUserHash: hashSpotifyUserId(req.spotifyUser.id)
        };
      }
      // Already owned by both or neither - no transfer needed
      else {
        return res.status(400).json({ error: 'Cannot transfer - invalid ownership state' });
      }

      // Use lean update operation
      const result = await collection.findOneAndUpdate(
        { shortId },
        { 
          $set: { 
            ...updateData,
            updatedAt: new Date()
          }
        },
        { 
          returnDocument: 'after'
        }
      );

      // Add username to response if TuneTier owner
      let response = result.value || result;
      if (response.ownerUserId) {
        const user = await getUserData(db, response.ownerUserId);
        response.username = user?.username;
      } else if (req.spotifyUser) {
        response.username = req.spotifyUser.displayName;
      }

      return res.json(response);
    } catch (err) {
      console.error('Error transferring ownership:', err);
      return res.status(500).json({ error: 'Failed to transfer ownership' });
    }
  });

  //
  // GET tierlist by shortId
  //
  router.get('/:shortId', optionalAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (!canReadTierlist(list, req.user, req.spotifyUser)) {
        return res.status(403).json({ error: 'Tierlist is private' });
      }

      // Add username if this is a TuneTier user's tierlist
      let listWithUsername = { ...list };
      if (list.ownerUserId) {
        const user = await getUserData(db, list.ownerUserId);
        listWithUsername.username = user?.username;
      }

      return res.json(listWithUsername);
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
      
      // Find user by username first
      const user = await db.collection('users').findOne({ 
        usernameLower: username.trim().toLowerCase() 
      });
      
      if (!user) {
        return res.json([]);
      }
      
      // Then find tierlists by ownerUserId
      const cursor = collection.find({ 
        ownerUserId: String(user._id), 
        isPublic: true 
      }).sort({ createdAt: -1 });
      const lists = await cursor.toArray();
      
      // Add username to response
      const listsWithUsername = lists.map(list => ({
        ...list,
        username: user.username
      }));
      
      return res.json(listsWithUsername);
    } catch (err) {
      console.error('Error fetching tierlists:', err);
      return res.status(500).json({ error: 'Failed to fetch tierlists' });
    }
  });

  //
  // UPDATE tierlist by shortId
  //
  router.put('/:shortId', requireAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;
      const { spotifyUserId, ...updateData } = req.body;
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (!canWriteTierlist(list, req.user, req.spotifyUser)) {
        return res.status(403).json({ error: 'Unauthorized update attempt' });
      }

      const updated = {
        ...updateData,
        ...(spotifyUserId ? { spotifyUserHash: hashSpotifyUserId(String(spotifyUserId).trim()) } : {}),
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
  router.delete('/:shortId', requireAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (!canWriteTierlist(list, req.user, req.spotifyUser)) {
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
  router.delete('/user/all', requireAuthMiddleware, async (req, res) => {
    try {
      const linked = Array.from(getLinkedSpotifyHashes(req.user));
      const result = await collection.deleteMany({
        $or: [
          { ownerUserId: String(req.user._id) },
          ...(linked.length ? [{ spotifyUserHash: { $in: linked } }] : [])
        ]
      });

      return res.json({ message: `Deleted ${result.deletedCount} tierlists.` });
    } catch (err) {
      console.error('Error deleting all tierlists:', err);
      return res.status(500).json({ error: 'Failed to delete tierlists' });
    }
  });

  //
  // TOGGLE privacy (public/private) for a tierlist
  //
  router.patch('/:shortId/privacy', requireAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;
      const list = await collection.findOne({ shortId });

      if (!list) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (!canWriteTierlist(list, req.user, req.spotifyUser)) {
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

// Batch endpoint for username lookups
export function createUsersBatchRouter(db) {
  const router = express.Router();

  router.post('/usernames', async (req, res) => {
    try {
      const { userIds } = req.body;
      
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.json({});
      }
      
      const userMap = await batchGetUserData(db, userIds);
      return res.json(userMap);
    } catch (err) {
      console.error('Error batch fetching usernames:', err);
      return res.status(500).json({ error: 'Failed to fetch usernames' });
    }
  });

  return router;
}
