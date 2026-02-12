import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import EmailLog from "../models/EmailLog.js";

dotenv.config();

const TEMPLATE_KEYS = ["seed.welcome", "seed.daily.summary"];

const seedInboxMails = async () => {
  await connectDB();

  const users = await User.find({}).select("_id name email role");
  let inserted = 0;

  for (const user of users) {
    const existing = await EmailLog.countDocuments({
      to: user.email,
      templateKey: { $in: TEMPLATE_KEYS }
    });
    if (existing >= 2) continue;

    const docs = [
      {
        to: user.email,
        subject: `Welcome to SWMS, ${user.name}`,
        body: `<p>Hello ${user.name}, your ${user.role} account is active in Smart Workflow Monitoring System.</p>`,
        templateKey: "seed.welcome",
        sentByRole: "system",
        meta: { userId: user._id, seeded: true },
        deliveryStatus: "sent",
        read: false
      },
      {
        to: user.email,
        subject: "Daily Workflow Summary Available",
        body: `<p>Hi ${user.name}, check your dashboard for task status, delays, and updates.</p>`,
        templateKey: "seed.daily.summary",
        sentByRole: "system",
        meta: { userId: user._id, seeded: true },
        deliveryStatus: "sent",
        read: false
      }
    ];

    await EmailLog.insertMany(docs);
    inserted += 2;
  }

  console.log(`Inbox mail seed complete. Inserted ${inserted} mails.`);
  await mongoose.disconnect();
};

seedInboxMails().catch((err) => {
  console.error(err);
  process.exit(1);
});

