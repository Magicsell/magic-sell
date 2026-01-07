import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    // Multi-tenant support (opsiyonel başlatıyoruz)
    organizationId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Organization",
      index: true 
    },
    
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
// Multi-tenant index
customerSchema.index({ organizationId: 1, shopName: 1 });

export const Customer = mongoose.model("Customer", customerSchema);
