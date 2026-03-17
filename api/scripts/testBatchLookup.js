import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from the correct path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const MONGODB_USER = process.env.MONGODB_USER;
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
const MONGODB_HOST = process.env.MONGODB_HOST;
const MONGODB_CLIENT_NAME = process.env.MONGODB_CLIENT_NAME;
const MONGODB_DB = process.env.MONGODB_DB;

const MONGODB_URI = `mongodb+srv://${encodeURIComponent(MONGODB_USER)}:${encodeURIComponent(MONGODB_PASSWORD)}@${MONGODB_HOST}/${MONGODB_DB}?retryWrites=true&w=majority&appName=${MONGODB_CLIENT_NAME}`;

async function testBatchLookup() {
  const client = new MongoClient(MONGODB_URI, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });

  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(MONGODB_DB);
    const users = db.collection('users');

    // Test the batch lookup function
    const userIds = ['69ad7db272f892b592c3103d'];
    console.log('Looking up user IDs:', userIds);
    
    // Convert string IDs to ObjectIds for MongoDB query
    const objectIds = userIds.map(id => new ObjectId(id));
    console.log('Converted to ObjectIds:', objectIds);
    
    const userDocs = await users.find({ 
      _id: { $in: objectIds } 
    }, { 
      projection: { _id: 1, username: 1 } 
    }).toArray();
    
    console.log('Found user documents:', userDocs);
    
    const userMap = userDocs.reduce((map, user) => {
      map[String(user._id)] = user.username;
      return map;
    }, {});
    
    console.log('User map result:', userMap);

  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await client.close();
  }
}

// Run the test
testBatchLookup().catch(console.error);
