import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 9);

export function generateShortId() {
  return nanoid();
}

/**
 * Creates the base tierlist document payload from input data.
 * This does not insert into Mongo, just shapes the data.
 */
export function buildTierListDocument({
  ownerUserId,
  tierListName,
  description = '',
  coverImage = '',
  tiers = [],
  tierOrder = [],
  state = {},
  isPublic = true
}) {
  const now = new Date();

  if (!ownerUserId) {
    throw new Error('ownerUserId is required');
  }

  return {
    ownerUserId,
    tierListName,
    description,
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
