import { customAlphabet } from 'nanoid';
import crypto from 'crypto';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 9);

export function hashSpotifyUserId(spotifyUserId) {
  return crypto.createHash('sha256').update(spotifyUserId).digest('hex');
}

export function generateShortId() {
  return nanoid();
}

/**
 * Creates the base tierlist document payload from input data.
 * This does not insert into Mongo, just shapes the data.
 */
export function buildTierListDocument({
  spotifyUserId,
  username,
  tierListName,
  coverImage = '',
  tiers = [],
  tierOrder = [],
  state = {},
  isPublic = true
}) {
  const now = new Date();
  const spotifyUserHash = hashSpotifyUserId(spotifyUserId);

  return {
    spotifyUserHash,
    username,
    tierListName,
    coverImage,   // base64 string or external URL
    tiers,
    tierOrder,
    state,
    shortId: generateShortId(),
    isPublic,
    createdAt: now,
    updatedAt: now
  };
}
