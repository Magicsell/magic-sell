import mongoose from "mongoose";

let cached = global.__ms_mongoose;
if (!cached) cached = global.__ms_mongoose = { conn: null, promise: null };

export async function connectDB() {
  if (cached.conn) return cached.conn;

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    // Promise reject dönsün, init’te crash etmesin
    throw new Error("DB URI missing: set MONGODB_URI (or MONGO_URI) in env");
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      // Atlas SRV kullanıyorsan bunlar default; extra ayar gereksiz.
      // dbName gerekiyorsa ENV ile ver: process.env.MONGO_DB
      // serverSelectionTimeoutMS: 10000,
    }).then((m) => m.connection);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export function dbState() {
  const states = ["disconnected","connected","connecting","disconnecting","unauthorized"];
  return {
    state: states[mongoose.connection.readyState] ?? mongoose.connection.readyState,
    hasUri: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI),
  };
}
