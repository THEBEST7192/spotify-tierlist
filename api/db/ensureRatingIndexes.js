// Ensure indexes for the tierlist ratings collection.
export async function ensureRatingIndexes(db) {
  const collection = db.collection('tierlist_ratings');

  await collection.createIndexes([
    {
      key: { tierlistShortId: 1, userId: 1 },
      name: 'unique_tierlist_user_rating',
      unique: true
    },
    {
      key: { tierlistShortId: 1 },
      name: 'idx_tierlistShortId'
    },
    {
      key: { userId: 1 },
      name: 'idx_userId'
    }
  ]);
}
