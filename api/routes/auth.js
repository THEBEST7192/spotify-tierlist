import express from 'express';
import { normalizeUsername, hashPassword, verifyPassword } from '../utils/authUtils.js';
import { signAccessToken } from '../utils/jwtUtils.js';
import { generateTwoFactorCode, storeTwoFactorCode, verifyTwoFactorCode, hasTwoFactorEnabled, sendTwoFactorEmail, sendTwoFactorSetupEmail } from '../utils/twoFactorUtils.js';

function sanitizeUser(user) {
  if (!user) return null;
  const userCopy = { ...user };
  delete userCopy.passwordHash;
  return userCopy;
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
        return res.status(400).json({ error: 'Username is required' });
      }
      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
      }

      // Check if username already exists
      const existingUser = await users.findOne({ usernameLower: normalized });
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
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
        return res.status(409).json({ error: 'Username already exists' });
      }
      return res.status(500).json({ error: 'Network Error' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { username, password, twoFactorCode } = req.body || {};
      const normalized = normalizeUsername(username);
      if (!normalized) {
        return res.status(400).json({ error: 'Username is required' });
      }
      if (typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      const user = await users.findOne({ usernameLower: normalized });
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if 2FA is enabled
      if (hasTwoFactorEnabled(user)) {
        if (!twoFactorCode) {
          return res.status(400).json({ 
            error: 'Two-factor authentication code required',
            requiresTwoFactor: true
          });
        }

        // Verify 2FA code
        const isValid = await verifyTwoFactorCode(db, String(user._id), twoFactorCode);
        if (!isValid) {
          return res.status(401).json({ 
            error: 'Invalid or expired two-factor code',
            requiresTwoFactor: true
          });
        }
      }

      const token = signAccessToken({ sub: String(user._id) });
      return res.json({ token, user: sanitizeUser(user) });
    } catch (err) {
      console.error('Error logging in:', err);
      return res.status(500).json({ error: 'Network Error' });
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
          return res.status(400).json({ error: 'Username is required' });
        }

        // Check if new username already exists (and isn't the current user)
        const existingUser = await users.findOne({
          usernameLower: normalized,
          _id: { $ne: userId }
        });
        if (existingUser) {
          return res.status(409).json({ error: 'Username already exists' });
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
          return res.status(400).json({ error: 'Password must be at least 6 characters' });
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
        return res.status(409).json({ error: 'Username already exists' });
      }
      return res.status(500).json({ error: 'Network Error' });
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
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({ message: 'Account deleted successfully' });
    } catch (err) {
      console.error('Error deleting user account:', err);
      return res.status(500).json({ error: 'Network Error' });
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

  // Enable 2FA - send verification code
  router.post('/2fa/enable', requireAuth, async (req, res) => {
    try {
      const { email } = req.body || {};
      const userId = req.user._id;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }

      // Generate and store 2FA code
      const code = generateTwoFactorCode();
      await storeTwoFactorCode(db, String(userId), code);

      // Send email with code
      await sendTwoFactorEmail(email, code, req.user.username);

      return res.json({ message: 'Verification code sent to email' });
    } catch (err) {
      console.error('Error enabling 2FA:', err);
      return res.status(500).json({ error: 'Failed to send verification code' });
    }
  });

  // Verify 2FA code during setup
  router.post('/2fa/verify', requireAuth, async (req, res) => {
    try {
      const { email, code } = req.body || {};
      const userId = req.user._id;

      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Valid email is required' });
      }
      if (!code || typeof code !== 'string' || code.length !== 6) {
        return res.status(400).json({ error: 'Valid 6-digit code is required' });
      }

      // Verify the code
      const isValid = await verifyTwoFactorCode(db, String(userId), code);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid or expired code' });
      }

      // Enable 2FA for user
      await users.updateOne(
        { _id: userId },
        {
          $set: {
            email: email.trim(),
            twoFactorEnabled: true,
            updatedAt: new Date()
          }
        }
      );

      // Send confirmation email
      await sendTwoFactorSetupEmail(email, req.user.username);

      // Return updated user
      const updatedUser = await users.findOne({ _id: userId });
      return res.json({ user: sanitizeUser(updatedUser) });
    } catch (err) {
      console.error('Error verifying 2FA:', err);
      return res.status(500).json({ error: 'Failed to verify code' });
    }
  });

  // Disable 2FA
  router.post('/2fa/disable', requireAuth, async (req, res) => {
    try {
      const userId = req.user._id;

      await users.updateOne(
        { _id: userId },
        {
          $set: {
            twoFactorEnabled: false,
            updatedAt: new Date()
          }
        }
      );

      // Return updated user
      const updatedUser = await users.findOne({ _id: userId });
      return res.json({ user: sanitizeUser(updatedUser) });
    } catch (err) {
      console.error('Error disabling 2FA:', err);
      return res.status(500).json({ error: 'Failed to disable 2FA' });
    }
  });

  // Send 2FA code during login
  router.post('/2fa/send', async (req, res) => {
    try {
      const { username } = req.body || {};
      const normalized = normalizeUsername(username);
      if (!normalized) {
        return res.status(400).json({ error: 'Username is required' });
      }

      const user = await users.findOne({ usernameLower: normalized });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!hasTwoFactorEnabled(user)) {
        return res.status(400).json({ error: '2FA is not enabled for this account' });
      }

      // Generate and store 2FA code
      const code = generateTwoFactorCode();
      await storeTwoFactorCode(db, String(user._id), code);

      // Send email with code
      await sendTwoFactorEmail(user.email, code, user.username);

      return res.json({ message: 'Verification code sent to email' });
    } catch (err) {
      console.error('Error sending 2FA code:', err);
      return res.status(500).json({ error: 'Failed to send verification code' });
    }
  });

  return router;
}
