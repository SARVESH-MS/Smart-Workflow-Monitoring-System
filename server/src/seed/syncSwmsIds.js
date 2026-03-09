import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const PREFIX = "7376231SWMS";

const syncIds = async () => {
  await connectDB();

  const admin = await User.findOne({ role: "admin", email: "sarvesh.cs23@bitsathy.ac.in" });
  if (admin) {
    admin.swmsId = `${PREFIX}001`;
    await admin.save();
  }

  const raju = await User.findOne({ role: "manager", email: "ms.sarveshsarvesh.2006@gmail.com" });
  if (raju) {
    raju.swmsId = "7376231SWM101";
    await raju.save();
  }

  const leena = await User.findOne({ role: "manager", email: "ms.sarveshyawana@gmail.com" });
  if (leena) {
    leena.swmsId = `${PREFIX}102`;
    await leena.save();
  }

  const employees = await User.find({ role: "employee" }).sort({ createdAt: 1, _id: 1 });
  for (let index = 0; index < employees.length; index += 1) {
    employees[index].swmsId = `${PREFIX}${String(300 + index).padStart(3, "0")}`;
    await employees[index].save();
  }

  console.log(`SWMS IDs synced for ${employees.length + Number(Boolean(admin)) + Number(Boolean(raju)) + Number(Boolean(leena))} users.`);
  await mongoose.disconnect();
};

syncIds().catch((error) => {
  console.error(error);
  process.exit(1);
});
