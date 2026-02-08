import "dotenv/config";
import mongoose from "mongoose";
import Project from "./src/models/Project.js";

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI missing");
    process.exit(1);
  }
  await mongoose.connect(uri);
  const description = `A Cloud Kitchen (also called a ghost kitchen or virtual kitchen) is a food service model where meals are prepared only for online orders without a physical dine-in facility. Orders are received through mobile apps or websites and delivered to customers via delivery partners.

The Cloud Kitchen Management System is a software solution designed to manage online food orders, menu items, kitchen operations, delivery tracking, and payments efficiently.`;
  const res = await Project.updateOne({ name: "Cloud kitchen" }, { $set: { description } });
  console.log(res);
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
