import mongoose from "mongoose";

const AvailabilitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    weekStart: { type: Date, required: true },
    capacityHours: { type: Number, default: 40 },
    timeOffHours: { type: Number, default: 0 }
  },
  { timestamps: true }
);

AvailabilitySchema.index({ userId: 1, weekStart: 1 }, { unique: true });

export default mongoose.model("Availability", AvailabilitySchema);
