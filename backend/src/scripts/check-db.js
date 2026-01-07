// Check database and collections
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    
    console.log("Collections in database:");
    collections.forEach(col => {
      console.log(`  - ${col.name}`);
    });

    // Check orders collection directly
    const ordersCollection = db.collection("orders");
    const orderCount = await ordersCollection.countDocuments();
    console.log(`\nTotal documents in 'orders' collection: ${orderCount}`);

    if (orderCount > 0) {
      const sampleOrder = await ordersCollection.findOne({});
      console.log("\nSample order structure:");
      console.log(JSON.stringify(sampleOrder, null, 2));
      
      // Check orderNo distribution
      const orderNos = await ordersCollection.find({}, { projection: { orderNo: 1, organizationId: 1 } })
        .sort({ orderNo: -1 })
        .limit(5)
        .toArray();
      
      console.log("\nTop 5 orderNos:");
      orderNos.forEach(o => {
        console.log(`  OrderNo: ${o.orderNo}, OrgId: ${o.organizationId || "none"}`);
      });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

checkDB();

