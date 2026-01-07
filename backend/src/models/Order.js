import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    // Multi-tenant support (opsiyonel başlatıyoruz, migration sonrası required yapacağız)
    organizationId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Organization",
      index: true 
    },
    
    shopName: { type: String, required: true },
    customerName: { type: String },
    customerPhone: { type: String },
    customerAddress: { type: String },
    customerPostcode: { type: String },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, default: "Not Set" }, // Cash | Card | Bank | Balance | Split
    // Payment breakdown for split payments
    paymentBreakdown: {
      balanceAmount: { type: Number, default: 0, min: 0 }, // Amount paid from balance
      cashAmount: { type: Number, default: 0, min: 0 }, // Amount paid in cash
      cardAmount: { type: Number, default: 0, min: 0 }, // Amount paid by card
      bankAmount: { type: Number, default: 0, min: 0 }, // Amount paid by bank transfer
    },
    status: {
      type: String,
      default: "pending",
      enum: ["pending", "delivered"],
    },
    
    // Order items (opsiyonel - backward compatible)
    items: [{
      productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
      productName: { type: String }, // Snapshot - product silinse bile görünsün
      quantity: { type: Number, required: true, min: 1 },
      price: { type: Number, required: true, min: 0 }, // Unit price at time of order
      subtotal: { type: Number, required: true, min: 0 }, // quantity * price
    }],

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
// Multi-tenant index (organizationId + orderDate)
orderSchema.index({ organizationId: 1, orderDate: -1 });

// ---- Global sayaç modeli (aynı DB'de "counters" koleksiyonu) ----
const counterSchema = new mongoose.Schema(
  { _id: String, seq: { type: Number, default: 0 } },
  { collection: "counters", versionKey: false }
);
// Tekrar tanımlamayı önlemek için farklı bir model adı kullandık
const Counter =
  mongoose.models.__Counter || mongoose.model("__Counter", counterSchema);

// orderNo yoksa kaydetmeden önce atomik olarak arttır
// Multi-tenant: Her organization için ayrı sayaç
orderSchema.pre("save", async function (next) {
  // Skip if orderNo is already set (including 0, but not null/undefined)
  if (!this.isNew || (this.orderNo != null && this.orderNo !== undefined)) {
    console.log(`[Order Pre-save] Skipping counter - orderNo already set: ${this.orderNo}`);
    return next();
  }
  try {
    // Counter key: organizationId varsa "orders:orgId", yoksa "orders:global" (backward compatibility)
    // Ensure organizationId is converted to string if it's an ObjectId
    const orgIdStr = this.organizationId 
      ? String(this.organizationId)
      : null;
    const counterKey = orgIdStr 
      ? `orders:${orgIdStr}` 
      : "orders:global";
    
    // Check if counter exists and is lower than max orderNo - if so, initialize it
    const existingCounter = await Counter.findOne({ _id: counterKey });
    if (!existingCounter || existingCounter.seq === 0) {
      // Find max orderNo for this organization/global using collection directly
      const matchQuery = orgIdStr ? { organizationId: this.organizationId } : { organizationId: { $exists: false } };
      const ordersCollection = mongoose.connection.db.collection("orders");
      const maxOrder = await ordersCollection
        .findOne(matchQuery, { sort: { orderNo: -1 }, projection: { orderNo: 1 } });
      
      if (maxOrder && maxOrder.orderNo) {
        // Initialize counter to max orderNo
        await Counter.findOneAndUpdate(
          { _id: counterKey },
          { $set: { seq: maxOrder.orderNo } },
          { upsert: true }
        );
      }
    }
    
    const doc = await Counter.findOneAndUpdate(
      { _id: counterKey },
      { $inc: { seq: 1 } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    this.orderNo = doc.seq; // 1,2,3...
    console.log(`[Order Pre-save] Generated orderNo: ${this.orderNo} from counter: ${counterKey} (seq: ${doc.seq})`);
    next();
  } catch (err) {
    next(err);
  }
});

export const Order = mongoose.model("Order", orderSchema);
