import express from 'express';
import { ObjectId } from 'mongodb';

export async function batchGetRatings(db, shortIds, userId = null) {
  if (!shortIds || shortIds.length === 0) return {};
  
  const collection = db.collection('tierlist_ratings');
  const ratings = await collection.find({ 
    tierlistShortId: { $in: shortIds } 
  }).toArray();
  
  // Group by tierlistShortId and calculate stats
  const result = {};
  for (const shortId of shortIds) {
    const tierlistRatings = ratings.filter(r => r.tierlistShortId === shortId);
    const totalRatings = tierlistRatings.length;
    const positiveRatings = tierlistRatings.filter(r => r.rating > 0).length;
    const negativeRatings = tierlistRatings.filter(r => r.rating === -1).length;
    
    let averageRating = 0;
    if (positiveRatings > 0) {
      const sum = tierlistRatings.filter(r => r.rating > 0).reduce((acc, r) => acc + r.rating, 0);
      averageRating = Math.round((sum / positiveRatings) * 10) / 10;
    }
    
    let userRating = null;
    if (userId) {
      const userRatingDoc = tierlistRatings.find(r => r.userId === userId);
      if (userRatingDoc) {
        userRating = userRatingDoc.rating;
      }
    }
    
    result[shortId] = {
      totalRatings,
      positiveRatings,
      negativeRatings,
      averageRating,
      userRating
    };
  }
  
  return result;
}

export function createRatingsRouter(db, { optionalAuth, requireAuth } = {}) {
  const router = express.Router();
  const collection = db.collection('tierlist_ratings', {
    readPreference: 'primary',
    readConcern: { level: 'majority' },
    writeConcern: { w: 'majority' }
  });

  const tierlistsCollection = db.collection('tierlists');

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
  // POST - Add or update a rating for a tierlist
  //
  router.post('/:shortId', requireAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;
      const { rating } = req.body;

      // Validate rating (must be 1-5 or -1 for dislike)
      if (![-1, 1, 2, 3, 4, 5].includes(rating)) {
        return res.status(400).json({ error: 'Rating must be -1 (dislike) or 1-5 (stars)' });
      }

      // Check if tierlist exists and is public
      const tierlist = await tierlistsCollection.findOne({ shortId });
      if (!tierlist) {
        return res.status(404).json({ error: 'Tierlist not found' });
      }

      if (!tierlist.isPublic) {
        return res.status(403).json({ error: 'Cannot rate private tierlists' });
      }

      const userId = String(req.user._id);

      // Upsert the rating
      const result = await collection.findOneAndUpdate(
        { tierlistShortId: shortId, userId },
        {
          $set: {
            tierlistShortId: shortId,
            userId,
            rating,
            updatedAt: new Date()
          }
        },
        { upsert: true, returnDocument: 'after' }
      );

      return res.json(result.value);
    } catch (err) {
      console.error('Error saving rating:', err);
      return res.status(500).json({ error: 'Failed to save rating' });
    }
  });

  //
  // GET - Get ratings for a specific tierlist
  //
  router.get('/:shortId', optionalAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;

      // Get all ratings for this tierlist
      const ratings = await collection.find({ tierlistShortId: shortId }).toArray();

      // Calculate statistics
      const totalRatings = ratings.length;
      const positiveRatings = ratings.filter(r => r.rating > 0).length;
      const negativeRatings = ratings.filter(r => r.rating === -1).length;
      
      let averageRating = 0;
      if (positiveRatings > 0) {
        const sum = ratings.filter(r => r.rating > 0).reduce((acc, r) => acc + r.rating, 0);
        averageRating = Math.round((sum / positiveRatings) * 10) / 10;
      }

      // Get current user's rating if logged in
      let userRating = null;
      if (req.user) {
        const userRatingDoc = await collection.findOne({
          tierlistShortId: shortId,
          userId: String(req.user._id)
        });
        if (userRatingDoc) {
          userRating = userRatingDoc.rating;
        }
      }

      return res.json({
        totalRatings,
        positiveRatings,
        negativeRatings,
        averageRating,
        userRating
      });
    } catch (err) {
      console.error('Error fetching ratings:', err);
      return res.status(500).json({ error: 'Failed to fetch ratings' });
    }
  });

  //
  // DELETE - Remove user's rating for a tierlist
  //
  router.delete('/:shortId', requireAuthMiddleware, async (req, res) => {
    try {
      const { shortId } = req.params;
      const userId = String(req.user._id);

      const result = await collection.deleteOne({
        tierlistShortId: shortId,
        userId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Rating not found' });
      }

      return res.json({ message: 'Rating removed successfully' });
    } catch (err) {
      console.error('Error removing rating:', err);
      return res.status(500).json({ error: 'Failed to remove rating' });
    }
  });

  //
  // GET - Get tierlists sorted by rating
  //
  router.get('/sorted/top', async (req, res) => {
    try {
      const { limit = 20 } = req.query;
      const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

      // Aggregate to calculate average rating per tierlist
      const pipeline = [
        {
          $match: { rating: { $gt: 0 } } // Only positive ratings
        },
        {
          $group: {
            _id: '$tierlistShortId',
            averageRating: { $avg: '$rating' },
            totalRatings: { $sum: 1 }
          }
        },
        {
          $match: { totalRatings: { $gte: 1 } } // At least 1 rating
        },
        {
          $sort: { averageRating: -1 }
        },
        {
          $limit: limitNum
        }
      ];

      const sortedTierlists = await collection.aggregate(pipeline).toArray();

      // Fetch tierlist data
      const shortIds = sortedTierlists.map(t => t._id);
      const tierlists = await tierlistsCollection.find(
        { 
          shortId: { $in: shortIds },
          isPublic: true
        },
        {
          projection: {
            shortId: 1,
            tierListName: 1,
            description: 1,
            coverImage: 1,
            isPublic: 1,
            createdAt: 1,
            updatedAt: 1,
            ownerUserId: 1
          }
        }
      ).toArray();

      // Fetch usernames for TuneTier users
      const userIds = [...new Set(tierlists
        .filter(list => list.ownerUserId)
        .map(list => list.ownerUserId)
      )];
      
      const users = db.collection('users');
      const userDocs = userIds.length > 0 ? await users.find({ 
        _id: { $in: userIds.map(id => new ObjectId(id)) } 
      }, { 
        projection: { _id: 1, username: 1 } 
      }).toArray() : [];
      
      const userMap = userDocs.reduce((map, user) => {
        map[String(user._id)] = user.username;
        return map;
      }, {});

      // Fetch ratings for consistent format
      const ratingsMap = shortIds.length > 0 ? await batchGetRatings(db, shortIds) : {};

      // Merge rating data with tierlist data
      const tierlistMap = new Map(tierlists.map(t => [t.shortId, t]));
      const result = sortedTierlists.map(rating => {
        const tierlist = tierlistMap.get(rating._id);
        if (!tierlist) return null;
        
        const ratingData = ratingsMap[rating._id] || {
          totalRatings: rating.totalRatings,
          positiveRatings: rating.totalRatings,
          negativeRatings: 0,
          averageRating: Math.round(rating.averageRating * 10) / 10,
          userRating: null
        };
        
        return {
          ...tierlist,
          username: tierlist.ownerUserId ? userMap[tierlist.ownerUserId] : tierlist.username,
          rating: ratingData
        };
      }).filter(Boolean);

      return res.json(result);
    } catch (err) {
      console.error('Error fetching top rated tierlists:', err);
      return res.status(500).json({ error: 'Failed to fetch top rated tierlists' });
    }
  });

  return router;
}
