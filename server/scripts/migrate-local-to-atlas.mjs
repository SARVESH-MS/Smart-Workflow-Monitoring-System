import mongoose from "mongoose";

const getDbNameFromUri = (uri, fallback) => {
  if (!uri) return fallback;
  try {
    const normalized = uri.replace("mongodb+srv://", "mongodb://");
    const url = new URL(normalized);
    const pathDb = (url.pathname || "/").replace("/", "").split("?")[0];
    return pathDb || fallback;
  } catch {
    return fallback;
  }
};

const localUri = process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;
const atlasUri = process.env.MONGO_URI_ATLAS;

if (!localUri) {
  throw new Error("Missing MONGO_URI_LOCAL (or MONGO_URI) for local connection");
}
if (!atlasUri) {
  throw new Error("Missing MONGO_URI_ATLAS for Atlas connection");
}

const fallbackDb = "swms";
const dbName =
  process.env.MONGO_DB_NAME || getDbNameFromUri(localUri, fallbackDb);

const connect = async (uri) =>
  mongoose.createConnection(uri, { dbName, autoIndex: false }).asPromise();

const safeDrop = async (collection) => {
  try {
    await collection.drop();
  } catch (err) {
    if (err?.codeName !== "NamespaceNotFound") {
      throw err;
    }
  }
};

const copyCollection = async (localDb, atlasDb, name) => {
  const localCollection = localDb.collection(name);
  const atlasCollection = atlasDb.collection(name);

  await safeDrop(atlasCollection);

  const cursor = localCollection.find({});
  const batchSize = 1000;
  let batch = [];
  let count = 0;

  for await (const doc of cursor) {
    batch.push(doc);
    if (batch.length >= batchSize) {
      await atlasCollection.insertMany(batch);
      count += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    await atlasCollection.insertMany(batch);
    count += batch.length;
  }

  const indexes = await localCollection.indexes();
  const extraIndexes = indexes.filter((idx) => idx.name !== "_id_");
  if (extraIndexes.length) {
    const sanitizeIndex = (idx) => {
      const spec = {
        key: idx.key,
        name: idx.name
      };
      if (idx.unique === true) spec.unique = true;
      if (idx.sparse === true) spec.sparse = true;
      if (idx.expireAfterSeconds != null) spec.expireAfterSeconds = idx.expireAfterSeconds;
      if (idx.partialFilterExpression != null) spec.partialFilterExpression = idx.partialFilterExpression;
      if (idx.collation != null) spec.collation = idx.collation;
      return spec;
    };

    await atlasCollection.createIndexes(extraIndexes.map(sanitizeIndex));
  }

  return count;
};

const run = async () => {
  const localConn = await connect(localUri);
  const atlasConn = await connect(atlasUri);

  try {
    const localDb = localConn.db;
    const atlasDb = atlasConn.db;
    const collections = await localDb.listCollections().toArray();

    for (const { name } of collections) {
      if (name.startsWith("system.")) continue;
      const count = await copyCollection(localDb, atlasDb, name);
      console.log(`Copied ${name}: ${count} docs`);
    }

    console.log(`Migration complete (db: ${dbName})`);
  } finally {
    await localConn.close();
    await atlasConn.close();
  }
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
