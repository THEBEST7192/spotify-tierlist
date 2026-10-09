import { ObjectId } from 'mongodb';
import { verifyAccessToken } from '../utils/jwtUtils.js';

export function createAuthMiddleware(db) {
  const users = db.collection('users');

  const optionalAuth = async (req, _res, next) => {
    try {
      // JWT token for TuneTier auth
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

      return next();
    } catch {
      req.user = null;
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
