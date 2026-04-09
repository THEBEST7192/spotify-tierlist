import { MongoClient, ServerApiVersion } from 'mongodb';
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

if (!MONGODB_USER || !MONGODB_PASSWORD || !MONGODB_HOST || !MONGODB_CLIENT_NAME || !MONGODB_DB) {
  console.error('Missing required environment variables. Please check your .env.local file.');
  process.exit(1);
}

const MONGODB_URI = `mongodb+srv://${encodeURIComponent(MONGODB_USER)}:${encodeURIComponent(MONGODB_PASSWORD)}@${MONGODB_HOST}/${MONGODB_DB}?retryWrites=true&w=majority&appName=${MONGODB_CLIENT_NAME}`;

async function migrateTierlists() {
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
    const tierlists = db.collection('tierlists');
    const users = db.collection('users');

    // Find all tierlists that have username but no ownerUserId
    const tierlistsWithoutOwner = await tierlists.find({
      username: { $exists: true },
      ownerUserId: { $exists: false }
    }).toArray();

    console.log(`Found ${tierlistsWithoutOwner.length} tierlists without ownerUserId`);

    if (tierlistsWithoutOwner.length === 0) {
      console.log('No migration needed - all tierlists already have ownerUserId');
      return;
    }

    // Create username to user ID mapping
    const usernames = [...new Set(tierlistsWithoutOwner.map(t => t.username))];
    const userDocs = await users.find({
      usernameLower: { $in: usernames.map(u => u.toLowerCase()) }
    }).toArray();

    const userMap = userDocs.reduce((map, user) => {
      map[user.usernameLower] = String(user._id);
      return map;
    }, {});

    console.log(`Found ${userDocs.length} users for ${usernames.length} unique usernames`);

    // Migrate each tierlist
    let migrated = 0;
    let skipped = 0;

    for (const tierlist of tierlistsWithoutOwner) {
      const usernameLower = tierlist.username.toLowerCase();
      const userId = userMap[usernameLower];

      if (!userId) {
        console.log(`Skipping tierlist ${tierlist.shortId} - no user found for username: ${tierlist.username}`);
        skipped++;
        continue;
      }

      await tierlists.updateOne(
        { _id: tierlist._id },
        { $set: { ownerUserId: userId } }
      );

      console.log(`Migrated tierlist ${tierlist.shortId} - assigned to user ${tierlist.username} (${userId})`);
      migrated++;
    }

    console.log(`\nMigration complete:`);
    console.log(`- Migrated: ${migrated} tierlists`);
    console.log(`- Skipped: ${skipped} tierlists (no matching user found)`);
    console.log(`- Total processed: ${tierlistsWithoutOwner.length} tierlists`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await client.close();
  }
}

// Run the migration
migrateTierlists().catch(console.error);
