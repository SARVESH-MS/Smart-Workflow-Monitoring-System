import dotenv from "dotenv";
import connectDB from "../config/db.js";
import { startVerificationWorker } from "../services/runtimeVerificationService.js";

dotenv.config();

connectDB()
  .then(() => {
    startVerificationWorker();
  })
  .catch((error) => {
    console.error("Verification worker failed to start", error);
    process.exit(1);
  });
