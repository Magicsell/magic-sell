// Fix counter - handle ObjectId properly
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

    // Get all orders (with or without organizationId)
    const allOrders = await Order.find({})
      .select("organizationId orderNo")
      .lean();
    
    console.log(`Found ${allOrders.length} total orders\n`);
    
    // Separate orders with and without organizationId
    const orders = allOrders.filter(o => o.organizationId);
    const legacyOrders = allOrders.filter(o => !o.organizationId);
    
    console.log(`Orders with organizationId: ${orders.length}`);
    console.log(`Orders without organizationId: ${legacyOrders.length}\n`);

    // Group by organizationId and find max
    const orgMaxMap = {};
    orders.forEach(order => {
      const orgId = String(order.organizationId);
      if (!orgMaxMap[orgId]) {
        orgMaxMap[orgId] = 0;
      }
      if (order.orderNo && order.orderNo > orgMaxMap[orgId]) {
        orgMaxMap[orgId] = order.orderNo;
      }
    });

    // Set counters
    for (const [orgId, maxNo] of Object.entries(orgMaxMap)) {
      const counterKey = `orders:${orgId}`;
      await Counter.findOneAndUpdate(
        { _id: counterKey },
        { $set: { seq: maxNo } },
        { upsert: true, new: true }
      );
      console.log(`✓ Set ${counterKey} counter to ${maxNo}`);
      console.log(`  Next order number will be: ${maxNo + 1}\n`);
    }

    // Handle legacy orders (without organizationId)
    if (legacyOrders.length > 0) {
      const maxLegacy = Math.max(...legacyOrders.map(o => o.orderNo || 0));
      await Counter.findOneAndUpdate(
        { _id: "orders:global" },
        { $set: { seq: maxLegacy } },
        { upsert: true, new: true }
      );
      console.log(`✓ Set orders:global counter to ${maxLegacy}`);
      console.log(`  Next legacy order number will be: ${maxLegacy + 1}\n`);
    }

    console.log("✅ Counter initialization complete!");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

fixCounter();

