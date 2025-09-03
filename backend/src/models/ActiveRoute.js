import mongoose from "mongoose";

const StopSchema = new mongoose.Schema({
  orderId: String,
  name: String,
  address: String,
  lat: Number,
  lng: Number,
  amount: Number,
  etaMinutes: Number,
  distanceFromPrevKm: Number,
  driveMinutesFromPrev: Number,
  cumulativeDistanceKm: Number,
}, { _id: false });

const ActiveRouteSchema = new mongoose.Schema({
  driver: { type: String, default: "driver", index: true },
  start: { lat: Number, lng: Number },
  method: String,
  totalDistanceKm: Number,
  totalDriveMinutes: Number,
  totalServiceMinutes: Number,
  stops: [StopSchema],
}, { timestamps: true });

export const ActiveRoute = mongoose.model("ActiveRoute", ActiveRouteSchema);
