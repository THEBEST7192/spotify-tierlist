import { ObjectId } from 'mongodb';

export async function ensureRateLimitIndexes(db) {
  const collection = db.collection('rate_limits');
  
  // Create compound index on ip + endpoint + timestamp 
  await collection.createIndex(
    { ip: 1, endpoint: 1, timestamp: 1 },
    { name: 'rate_limit_lookup' }
  );
  
  // Create TTL index to automatically expire old entries (1 hour)
  await collection.createIndex(
    { timestamp: 1 },
    { 
      name: 'rate_limit_ttl',
      expireAfterSeconds: 60 * 60 // 1 hour
    }
  );
  
  console.log('Rate limit indexes ensured');
}
