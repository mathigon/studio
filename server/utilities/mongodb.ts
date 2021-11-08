// =============================================================================
// Database Utilities
// (c) Mathigon
// =============================================================================


import {createConnection, Document, FilterQuery, Model, Types} from 'mongoose';
import {CONFIG, IS_PROD} from './utilities';


const MAX_RETRIES = 5;

export function isMongoID(str: string) {
  if (!str) return false;
  return Types.ObjectId.isValid(str);
}

// TODO For better performance, we should use .findOneAndUpdate() in some cases,
// rather than replaying the same request multiple times.
export async function mongoTransaction<T extends Document>(Model: Model<T>, query: FilterQuery<T>, updateFn: (doc: T) => void, count = 0) {
  let document = await Model.findOne(query);
  if (!document) document = new Model(query);
  updateFn(document);

  try {
    await document.save();
    return document;
  } catch (e) {
    // Replay the sam request in case there was a Mongo Error, e.g. a race
    // condition caused by simultaneously trying to insert or update the same
    // document twice.
    if (count >= MAX_RETRIES) throw new Error(`Mongo Error: Failed to update ${Model} after ${count} tries [${(e as Error).message}]: ${JSON.stringify(query)}`);
    return await module.exports.mongoTransaction(Model, query, updateFn, count + 1);
  }
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
