import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    
    type: {
      type: String,
      enum: ["user_pending_approval", "order_created", "order_delivered", "low_stock", "system"],
      required: true,
    },
    
    title: { type: String, required: true },
    message: { type: String, required: true },
    
    // Related entity IDs (optional)
    relatedId: { type: mongoose.Schema.Types.ObjectId },
    relatedType: { type: String }, // "user", "order", "product", etc.
    
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes
notificationSchema.index({ organizationId: 1, userId: 1, isRead: 1 });
notificationSchema.index({ organizationId: 1, userId: 1, createdAt: -1 });

export const Notification = mongoose.model("Notification", notificationSchema);
