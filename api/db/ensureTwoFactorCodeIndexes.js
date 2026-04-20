export async function ensureTwoFactorCodeIndexes(db) {
  const collection = db.collection('two_factor_codes');

  await collection.createIndexes([
    {
      key: { userId: 1 },
      name: 'userId_index'
    },
    {
      key: { expiresAt: 1 },
      name: 'expiresAt_ttl',
      expireAfterSeconds: 0 // Auto-delete documents when expiresAt is in the past
    }
  ]);
}
