// =============================================================================
// Database Utilities
// (c) Mathigon
// =============================================================================


import {createConnection, Types} from 'mongoose';
import {CONFIG, IS_PROD} from './utilities';


export function isMongoID(str: string) {
  if (!str) return false;
  return Types.ObjectId.isValid(str);
}

export async function connectMongo() {
  try {
    try {
      const url = CONFIG.accounts.mongoServer || 'mongodb://localhost:27017/tmp';
      const response = await createConnection(url, {}).asPromise();
      return response.getClient();
    } catch {
      if (IS_PROD) throw new Error();
      console.log('Trying in-memory Mongo DB...');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {MongoMemoryReplSet} = require('mongodb-memory-server');
      const memoryServer = new MongoMemoryReplSet();
      await memoryServer.waitUntilRunning();
      const mongoUri = await memoryServer.getUri();
      const response = await createConnection(mongoUri, {}).asPromise();
      return response.getClient();
    }
  } catch (e) {
    console.error('Failed to connect to MongoDB!');
    process.exit(1);
  }
}
