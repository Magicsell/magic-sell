import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // kişi adı
    shopName: { type: String, required: true }, // işletme adı
    phone: { type: String },
    address: { type: String },
    postcode: { type: String },
    city: { type: String },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
  },
  { timestamps: true }
);

customerSchema.index({ shopName: 1, name: 1 });

export const Customer = mongoose.model("Customer", customerSchema);
