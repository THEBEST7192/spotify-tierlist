// Ensure indexes for the tierlists collection.
export async function ensureTierlistIndexes(db) {
  const collection = db.collection('tierlists');

  await collection.createIndexes([
    {
      key: { shortId: 1 },
      name: 'unique_shortId',
      unique: true
    },
    {
      key: { spotifyUserHash: 1 },
      name: 'idx_spotifyUserHash'
    },
    {
      key: { username: 1, isPublic: 1 },
      name: 'idx_username_isPublic'
    }
  ]);
}
