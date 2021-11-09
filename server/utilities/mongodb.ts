// =============================================================================
// Database Utilities
// (c) Mathigon
// =============================================================================


import {connect, connection, Types} from 'mongoose';
import MongoStore from 'connect-mongo';
import {CONFIG, IS_PROD} from './utilities';


export function isMongoID(str: string) {
  if (!str) return false;
  return Types.ObjectId.isValid(str);
}

export async function connectMongo() {
  try {
    try {
      const url = CONFIG.accounts.mongoServer || 'mongodb://localhost:27017/tmp';
      await connect(url);
      return connection.getClient();
    } catch {
      if (IS_PROD) throw new Error();
      console.log('Trying in-memory Mongo DB...');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const {MongoMemoryReplSet} = require('mongodb-memory-server');
      const mongo = await MongoMemoryReplSet.create();
      await connect(mongo.getUri());
      return connection.getClient();
    }
  } catch {
    console.error('Failed to connect to MongoDB!');
    process.exit(1);
  }
}

export function getMongoStore() {
  const clientPromise = connectMongo();  // async
  return MongoStore.create({clientPromise, touchAfter: 12 * 3600});
}
