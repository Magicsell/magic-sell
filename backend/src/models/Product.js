import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    
    // Image URL
    imageUrl: { type: String, default: null },
    
    // Berber malzemesi için ekstra alanlar
    brand: { type: String, default: null, trim: true }, // Marka (örn: L'Oreal, Pantene)
    size: { type: String, default: null, trim: true }, // Boyut (örn: 250ml, 500ml, Small, Medium, Large)
    unit: { type: String, default: "piece", enum: ["piece", "pack", "bottle", "box", "set"], trim: true }, // Birim
    barcode: { type: String, default: null, trim: true }, // Barkod
    supplier: { type: String, default: null, trim: true }, // Tedarikçi
    
    // Stock management
    stock: {
      quantity: { type: Number, default: 0, min: 0 },
      lowStockThreshold: { type: Number, default: 10 }, // Low stock uyarısı için
      trackStock: { type: Boolean, default: false }, // Stock takibi aktif mi?
    },
    
    // Category
    category: { type: String, default: null },
    
    // Active/Inactive
    isActive: { type: Boolean, default: true },
    
    // SKU (Stock Keeping Unit)
    sku: { type: String, default: null },
  },
  { timestamps: true }
);

// Indexes
productSchema.index({ organizationId: 1, isActive: 1 });
productSchema.index({ organizationId: 1, name: 1 }); // Arama için
productSchema.index({ organizationId: 1, category: 1 }); // Kategori filtreleme için
productSchema.index({ organizationId: 1, brand: 1 }); // Marka filtreleme için
productSchema.index({ organizationId: 1, sku: 1 }); // SKU arama için
productSchema.index({ organizationId: 1, barcode: 1 }); // Barcode arama için

export const Product = mongoose.model("Product", productSchema);

