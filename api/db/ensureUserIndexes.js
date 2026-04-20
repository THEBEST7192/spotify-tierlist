export async function ensureUserIndexes(db) {
  const collection = db.collection('users');

  await collection.createIndexes([
    {
      key: { usernameLower: 1 },
      name: 'unique_usernameLower',
      unique: true
    },
    {
      key: { email: 1 },
      name: 'email_index'
    }
  ]);
}
