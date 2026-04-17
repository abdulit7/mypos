const mongoose = require("mongoose");

async function connectDatabase() {
  const useMemory = process.env.USE_MEMORY_DB === "true";
  let uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/mypos";

  if (useMemory) {
    // Lazy-require so production installs don't need the dev dependency.
    const { MongoMemoryServer } = require("mongodb-memory-server");
    const mongod = await MongoMemoryServer.create({
      instance: { dbName: "mypos" },
    });
    uri = mongod.getUri();
    console.log(`[db] Using in-memory MongoDB at ${uri}`);
  } else {
    console.log(`[db] Connecting to MongoDB at ${uri}`);
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("[db] Connected");
  return uri;
}

module.exports = connectDatabase;
