import mongoose from "mongoose";

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === "production";
  const target = (process.env.MONGO_TARGET || "local").toLowerCase();
  const uri =
    target === "atlas"
      ? process.env.MONGO_URI_ATLAS
      : process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MongoDB URI is required for the selected target");
  }
  await mongoose.connect(uri, {
    autoIndex: process.env.MONGO_AUTO_INDEX === "true" || !isProduction,
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || 10000)
  });
  console.log(`MongoDB connected (${target})`);
};

export default connectDB;
