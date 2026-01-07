import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // "ABC Market"
    slug: { 
      type: String, 
      required: true, 
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug can only contain lowercase letters, numbers, and hyphens"]
    },
    
    subscriptionPlan: { 
      type: String, 
      enum: ["free", "basic", "pro", "enterprise"], 
      default: "free" 
    },
    subscriptionStatus: { 
      type: String, 
      enum: ["active", "suspended", "cancelled"], 
      default: "active" 
    },
    
    // Stripe entegrasyonu için
    stripeCustomerId: { type: String },
    
    // Settings
    settings: {
      timezone: { type: String, default: "Europe/London" },
      currency: { type: String, default: "GBP" },
      depotLocation: {
        lat: { type: Number },
        lng: { type: Number },
        address: { type: String },
        postcode: { type: String },
      },
      deliveryRadius: { type: Number, default: 50 }, // km
    },
    
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes
// slug için unique: true zaten index oluşturuyor, duplicate olmasın diye burada tanımlamıyoruz
organizationSchema.index({ isActive: 1 });

export const Organization = mongoose.model("Organization", organizationSchema);

