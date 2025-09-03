import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true },
    customerName: { type: String },
    customerPhone: { type: String },
    customerAddress: { type: String },
    customerPostcode: { type: String },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: "Not Set" }, // Cash | Card | Bank | Balance
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "delivered"],
    },

    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },

    orderDate: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    deliveryNotes: { type: String, default: null },
    proofUrl: { type: String, default: null },

    // Artan sipariş numarası (1,2,3…)
    orderNo: { type: Number, index: true },
  },
  { timestamps: true }
);

// Sıralama için mevcut indeks
orderSchema.index({ orderDate: -1 });

// ---- Global sayaç modeli (aynı DB'de "counters" koleksiyonu) ----
const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: "counters", versionKey: false }
);
// Tekrar tanımlamayı önlemek için farklı bir model adı kullandık
const Counter =
  mongoose.models.__Counter || mongoose.model("__Counter", counterSchema);

// orderNo yoksa kaydetmeden önce atomik olarak arttır
orderSchema.pre("save", async function (next) {
  if (!this.isNew || this.orderNo != null) return next();
  try {
    const doc = await Counter.findOneAndUpdate(
      { _id: "orders:global" },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    this.orderNo = doc.seq; // 1,2,3...
    next();
  } catch (err) {
    next(err);
  }
});

export const Order = mongoose.model("Order", orderSchema);
