// Script to initialize order counter based on existing orders
// Run: node src/scripts/init-order-counter.js

import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "../models/Order.js";

dotenv.config();

const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: "counters", versionKey: false }
);
const Counter = mongoose.models.__Counter || mongoose.model("__Counter", counterSchema);

async function initOrderCounter() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Find max orderNo for orders without organizationId (legacy orders)
    const maxGlobalOrderNo = await Order.aggregate([
      { $match: { organizationId: { $exists: false } } },
      { $group: { _id: null, max: { $max: "$orderNo" } } },
    ]);

    const maxGlobal = maxGlobalOrderNo[0]?.max || 0;
    console.log(`Max orderNo (global/legacy): ${maxGlobal}`);

    // Initialize or update global counter (only if there are legacy orders)
    if (maxGlobal > 0) {
      await Counter.findOneAndUpdate(
        { _id: "orders:global" },
        { $set: { seq: maxGlobal } },
        { upsert: true, new: true }
      );
      console.log(`✓ Set orders:global counter to ${maxGlobal}`);
    } else {
      console.log(`✓ No legacy orders found, skipping global counter`);
    }

    // Find all unique organizationIds
    const orgIds = await Order.distinct("organizationId", {
      organizationId: { $exists: true, $ne: null },
    });

    console.log(`Found ${orgIds.length} organizations with orders`);

    // Initialize counter for each organization
    for (const orgId of orgIds) {
      const maxOrgOrderNo = await Order.aggregate([
        { $match: { organizationId: orgId } },
        { $group: { _id: null, max: { $max: "$orderNo" } } },
      ]);

      const maxOrg = maxOrgOrderNo[0]?.max || 0;
      const counterKey = `orders:${orgId}`;

      await Counter.findOneAndUpdate(
        { _id: counterKey },
        { $set: { seq: maxOrg } },
        { upsert: true, new: true }
      );
      console.log(`✓ Set ${counterKey} counter to ${maxOrg}`);
    }

    console.log("\n✅ Order counter initialization complete!");
    console.log("\nNext order numbers will be:");
    console.log(`  - Global/legacy orders: ${maxGlobal + 1}`);
    for (const orgId of orgIds) {
      const counter = await Counter.findOne({ _id: `orders:${orgId}` });
      console.log(`  - Organization ${orgId}: ${(counter?.seq || 0) + 1}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

initOrderCounter();

