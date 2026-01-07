import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    organizationId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Organization", 
      required: true,
      index: true 
    },
    
    email: { 
      type: String, 
      required: true,
      lowercase: true,
      trim: true 
    },
    password: { type: String, required: true },
    
    role: { 
      type: String, 
      enum: ["admin", "driver", "customer"], 
      required: true 
    },
    
    // Customer-specific profile
    customerProfile: {
      name: { type: String },
      phone: { type: String },
      address: { type: String },
      postcode: { type: String },
      city: { type: String },
      geo: {
        lat: { type: Number },
        lng: { type: Number },
      },
      balance: { type: Number, default: 0 }, // Cüzdan bakiyesi
    },
    
    // Driver-specific profile
    driverProfile: {
      name: { type: String },
      phone: { type: String },
      vehicleInfo: { type: String },
    },
    
    isActive: { type: Boolean, default: true },
    isApproved: { type: Boolean, default: false }, // Admin onayı (customer ve driver için)
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes - email unique per organization
userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ organizationId: 1, role: 1 });
userSchema.index({ organizationId: 1, isActive: 1 });

// Password hashing before save
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export const User = mongoose.model("User", userSchema);

