// Fix counter for existing organization
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "../models/Order.js";

dotenv.config();

const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: "counters", versionKey: false }
);
const Counter = mongoose.models.__Counter || mongoose.model("__Counter", counterSchema);

async function fixCounter() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    // Find max orderNo for the specific organization
    const orgId = "6952e1204fe9c92a18708bb0";
    
    const maxOrderNo = await Order.aggregate([
      { $match: { organizationId: orgId } },
      { $group: { _id: null, max: { $max: "$orderNo" } } },
    ]);

    const maxNo = maxOrderNo[0]?.max || 0;
    console.log(`Max orderNo for organization ${orgId}: ${maxNo}`);

    // Set counter
    const counterKey = `orders:${orgId}`;
    await Counter.findOneAndUpdate(
      { _id: counterKey },
      { $set: { seq: maxNo } },
      { upsert: true, new: true }
    );
    
    console.log(`✓ Set ${counterKey} counter to ${maxNo}`);
    console.log(`\n✅ Next order number will be: ${maxNo + 1}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixCounter();

