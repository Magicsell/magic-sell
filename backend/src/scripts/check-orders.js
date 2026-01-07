// Quick script to check existing orders
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Order } from "../models/Order.js";

dotenv.config();

async function checkOrders() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    const totalOrders = await Order.countDocuments();
    console.log(`Total orders: ${totalOrders}`);

    const ordersWithOrg = await Order.countDocuments({ organizationId: { $exists: true, $ne: null } });
    const ordersWithoutOrg = await Order.countDocuments({ organizationId: { $exists: false } });
    console.log(`Orders with organizationId: ${ordersWithOrg}`);
    console.log(`Orders without organizationId: ${ordersWithoutOrg}\n`);

    // Check orderNo distribution
    const orderNoStats = await Order.aggregate([
      {
        $group: {
          _id: null,
          max: { $max: "$orderNo" },
          min: { $min: "$orderNo" },
          count: { $sum: 1 },
          withOrderNo: {
            $sum: { $cond: [{ $ne: ["$orderNo", null] }, 1, 0] }
          }
        }
      }
    ]);

    console.log("OrderNo Statistics:");
    console.log(JSON.stringify(orderNoStats, null, 2));

    // Sample orders
    const sampleOrders = await Order.find().limit(5).select("orderNo organizationId shopName createdAt").lean();
    console.log("\nSample orders:");
    sampleOrders.forEach((o, i) => {
      console.log(`${i + 1}. OrderNo: ${o.orderNo}, OrgId: ${o.organizationId || "none"}, Shop: ${o.shopName}`);
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkOrders();

