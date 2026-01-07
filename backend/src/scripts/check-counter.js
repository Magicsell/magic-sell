// Check current counter value
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: "counters", versionKey: false }
);
const Counter = mongoose.models.__Counter || mongoose.model("__Counter", counterSchema);

async function checkCounter() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    const orgId = "6952e1204fe9c92a18708bb0";
    const counterKey = `orders:${orgId}`;
    
    const counter = await Counter.findOne({ _id: counterKey });
    console.log(`Counter for ${counterKey}:`, counter);
    
    // Check max orderNo in DB
    const { Order } = await import("./models/Order.js");
    const maxOrder = await Order.findOne({ organizationId: orgId })
      .sort({ orderNo: -1 })
      .select("orderNo")
      .lean();
    
    console.log(`Max orderNo in DB:`, maxOrder?.orderNo || "none");
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkCounter();

