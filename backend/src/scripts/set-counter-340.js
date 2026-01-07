// Directly set counter to 340 for the organization
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: "counters", versionKey: false }
);
const Counter = mongoose.models.__Counter || mongoose.model("__Counter", counterSchema);

async function setCounter() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB\n");

    const orgId = "6952e1204fe9c92a18708bb0";
    const maxOrderNo = 340; // Based on user's data
    
    const counterKey = `orders:${orgId}`;
    const result = await Counter.findOneAndUpdate(
      { _id: counterKey },
      { $set: { seq: maxOrderNo } },
      { upsert: true, new: true }
    );
    
    console.log(`✓ Set ${counterKey} counter to ${maxOrderNo}`);
    console.log(`✓ Next order number will be: ${maxOrderNo + 1}\n`);
    
    // Verify
    const verify = await Counter.findOne({ _id: counterKey });
    console.log("Verification:", verify);

    await mongoose.disconnect();
    console.log("\n✅ Done!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    await mongoose.disconnect();
    process.exit(1);
  }
}

setCounter();

