import { MongoClient, ServerApiVersion } from 'mongodb';
import dns from 'node:dns';

const PUBLIC_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

const isSrvLookupFailure = (error) =>
  /querysrv|srv record/i.test(String(error?.message || ''));

/**
 * Connects to MongoDB. When the local DNS resolver fails to perform the SRV
 * lookup for the MongoDB connection string (querySrv ECONNREFUSED), retries
 * using public DNS servers. This is a common issue when behind routers/VPNs or
 * firewalls that block the SRV lookup query.
 */
export async function connectMongo(uri, options = {}) {
  const clientOptions = {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
    ...options,
  };

  const client = new MongoClient(uri, clientOptions);
  try {
    await client.connect();
    return client;
  } catch (error) {
    await client.close().catch(() => {});
    if (!isSrvLookupFailure(error)) {
      throw error;
    }
    console.warn('SRV lookup refused by local DNS, retrying with public DNS servers');
    dns.setServers(PUBLIC_DNS_SERVERS);
    const retryClient = new MongoClient(uri, clientOptions);
    await retryClient.connect();
    return retryClient;
  }
}
