import mongoose from "mongoose";

const connectDB = async () => {
  const target = (process.env.MONGO_TARGET || "local").toLowerCase();
  const uri =
    target === "atlas"
      ? process.env.MONGO_URI_ATLAS
      : process.env.MONGO_URI_LOCAL || process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MongoDB URI is required for the selected target");
  }
  await mongoose.connect(uri, {
    autoIndex: true
  });
  console.log(`MongoDB connected (${target})`);
};

export default connectDB;
