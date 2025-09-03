import mongoose from "mongoose";

const globalWithMongoose = globalThis;

export const connectDB = async () => {
  if (globalWithMongoose._mongooseReady) return mongoose;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is missing");

  try {
    const conn = await mongoose.connect(uri, {
      dbName: "magicsell",
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 20000,
      family: 4,
      tls: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    globalWithMongoose._mongooseReady = true;
    return mongoose;
  } catch (err) {
    console.error("❌ Mongo connect error:", err?.message);
    throw err;
  }
};

export const dbState = () => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return {
    readyState: mongoose.connection.readyState,
    state: states[mongoose.connection.readyState] || "unknown",
    name: mongoose.connection.name,
    host: mongoose.connection.host,
  };
};
