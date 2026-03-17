# Tierlist Owner Migration Script

This script migrates existing tierlists that were created before the user ID system was implemented. It adds `ownerUserId` references to tierlists that only have `username` stored.

## Purpose

Before the user ID system was implemented, tierlists stored the `username` directly. Now we use MongoDB's native `_id` as the primary reference. This script:

1. Finds all tierlists with `username` but no `ownerUserId`
2. Looks up the corresponding user by username
3. Adds the user's `_id` as `ownerUserId` to the tierlist

## Usage

Run the migration script:

```bash
npm run migrate:tierlists
```

## What the script does

1. **Connects to MongoDB** using your existing environment variables
2. **Finds tierlists without ownerUserId**:
   ```javascript
   {
     username: { $exists: true },
     ownerUserId: { $exists: false }
   }
   ```
3. **Creates user mapping** by username (case-insensitive)
4. **Updates each tierlist** with the correct `ownerUserId`
5. **Reports results** showing migrated vs skipped tierlists

## Safety Features

- **Read-only until updates**: The script only performs updates after confirming user matches
- **Case-insensitive matching**: Uses `usernameLower` for reliable user lookup
- **Detailed logging**: Shows which tierlists are migrated and which are skipped
- **Safe for existing data**: Only adds `ownerUserId`, doesn't remove existing data

## Example Output

```
Connected to MongoDB
Found 15 tierlists without ownerUserId
Found 12 users for 10 unique usernames
Migrated tierlist abc123 - assigned to user johndoe (507f1f2...)
Migrated tierlist def456 - assigned to user janedoe (a8b3c4d...)
Skipping tierlist ghi789 - no user found for username: olduser

Migration complete:
- Migrated: 12 tierlists
- Skipped: 3 tierlists (no matching user found)
- Total processed: 15 tierlists
```

## After Migration

Once the migration is complete:
- All tierlists will have proper `ownerUserId` references
- Username changes will no longer break tierlist ownership
- The system will use user IDs for all ownership operations

## Notes

- The script is safe to run multiple times (it will only process tierlists without `ownerUserId`)
- Tierlists with no matching user will be skipped but can be manually reviewed
- The script uses MongoDB's native `_id` as intended by the system design
