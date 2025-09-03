import mongoose from "mongoose";

export const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing in .env");

  // Güvenli log (şifreyi gizle)
  const redacted = uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:<redacted>@");
  console.log("⏳ Connecting to MongoDB with URI:", redacted);

  console.log("⏳ Connecting to MongoDB...");

  // Önemli: dbName burada net veriliyor
  const conn = await mongoose.connect(uri, {
    dbName: "magicsell",
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 20000,
    family: 4,   // <<< IPv4'e zorla
    tls: true
  });

  console.log(
    `✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`
  );
  return conn;
};

// Hızlı sağlık bilgisi için
export const dbState = () => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return {
    readyState: mongoose.connection.readyState,
    state: states[mongoose.connection.readyState] || "unknown",
    name: mongoose.connection.name,
    host: mongoose.connection.host,
  };
};
