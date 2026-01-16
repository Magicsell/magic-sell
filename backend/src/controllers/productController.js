import { Product } from "../models/Product.js";

/**
 * GET /api/products
 * Query params:
 *   - q: search term (name, description, sku)
 *   - category: filter by category
 *   - isActive: true/false (default: true)
 *   - lowStock: true (sadece low stock olanları göster)
 *   - page, pageSize
 */
export const getProducts = async (req, res) => {
  try {
    const {
      q,
      category,
      isActive,
      lowStock,
      page = 1,
      pageSize = 20,
    } = req.query;

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    // Base query - tenant filter
    const match = {};
    if (req.organizationId) {
      match.organizationId = req.organizationId;
    }

    // isActive filter - sadece "true" veya "false" gönderildiğinde filter uygula
    // "all" veya undefined ise filter uygulama (hem active hem inactive gelsin)
    if (isActive === "true" || isActive === true) {
      match.isActive = true;
    } else if (isActive === "false" || isActive === false) {
      match.isActive = false;
    }
    // isActive undefined veya "all" ise hiçbir filter uygulanmaz - tüm product'lar gelir

    // Category filter
    if (category) {
      match.category = category;
    }

    // Search query
    if (q && q.trim()) {
      const rgx = new RegExp(q.trim(), "i");
      match.$or = [
        { name: rgx },
        { description: rgx },
        { sku: rgx },
      ];
    }

    // Low stock filter
    if (lowStock === "true") {
      match["stock.trackStock"] = true;
      match.$expr = {
        $lte: ["$stock.quantity", "$stock.lowStockThreshold"],
      };
    }

    const skip = (p - 1) * ps;

    // Debug: isActive filter kontrolü
    console.log("[Products] isActive query param:", isActive, "Type:", typeof isActive, "Match object:", JSON.stringify(match));

    // Debug: Tüm product'ları kontrol et (organizationId ile)
    if (req.organizationId) {
      const allProducts = await Product.find({ organizationId: req.organizationId }).lean();
      console.log("[Products] ALL products in DB for this org:", allProducts.map(p => ({ 
        name: p.name, 
        isActive: p.isActive,
        _id: p._id 
      })));
    }

    const [items, total] = await Promise.all([
      Product.find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(ps)
        .lean(),
      Product.countDocuments(match),
    ]);
    
    console.log("[Products] Found:", items.length, "items, total:", total);
    console.log("[Products] isActive values in results:", items.map(p => ({ name: p.name, isActive: p.isActive })));

    const response = {
      items,
      total,
      page: p,
      pageSize: ps,
      totalPages: Math.ceil(total / ps),
    };
    
    console.log("[Products] Sending response:", JSON.stringify({ 
      itemsCount: response.items.length, 
      total: response.total,
      items: response.items.map(p => ({ name: p.name, isActive: p.isActive }))
    }));

    res.json(response);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/products/:id
 */
export const getProductById = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const product = await Product.findOne(query).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/products
 */
export const createProduct = async (req, res) => {
  try {
    const b = req.body || {};

    if (!b.name || !b.name.trim()) {
      return res.status(400).json({ message: "Product name is required" });
    }

    if (b.price == null || Number(b.price) < 0) {
      return res.status(400).json({ message: "Valid price is required" });
    }

    const product = new Product({
      organizationId: req.organizationId,
      name: b.name.trim(),
      description: b.description?.trim() || "",
      price: Number(b.price),
      imageUrl: b.imageUrl || null,
      brand: b.brand?.trim() || null,
      size: b.size?.trim() || null,
      unit: b.unit || "piece",
      barcode: b.barcode?.trim() || null,
      supplier: b.supplier?.trim() || null,
      category: b.category || null,
      sku: b.sku?.trim() || null,
      stock: {
        quantity: Number(b.stock?.quantity || 0),
        lowStockThreshold: Number(b.stock?.lowStockThreshold || 10),
        trackStock: Boolean(b.stock?.trackStock || false),
      },
      isActive: b.isActive !== undefined ? Boolean(b.isActive) : true,
    });

    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * PATCH /api/products/:id
 */
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};

    const query = { _id: id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const update = {};
    if (b.name != null) update.name = b.name.trim();
    if (b.description != null) update.description = b.description.trim();
    if (b.price != null) update.price = Number(b.price);
    if (b.imageUrl !== undefined) update.imageUrl = b.imageUrl;
    if (b.brand != null) update.brand = b.brand.trim() || null;
    if (b.size != null) update.size = b.size.trim() || null;
    if (b.unit != null) update.unit = b.unit;
    if (b.barcode != null) update.barcode = b.barcode.trim() || null;
    if (b.supplier != null) update.supplier = b.supplier.trim() || null;
    if (b.category != null) update.category = b.category || null;
    if (b.sku != null) update.sku = b.sku.trim() || null;
    if (b.isActive !== undefined) update.isActive = Boolean(b.isActive);

    // Stock updates
    if (b.stock != null) {
      update.stock = {
        quantity: Number(b.stock.quantity ?? 0),
        lowStockThreshold: Number(b.stock.lowStockThreshold ?? 10),
        trackStock: Boolean(b.stock.trackStock ?? false),
      };
    }

    const product = await Product.findOneAndUpdate(query, update, {
      new: true,
    });

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * DELETE /api/products/:id
 */
export const deleteProduct = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const product = await Product.findOneAndDelete(query);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.status(204).send();
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/products/categories
 * Tüm kategorileri listele (tenant-scoped)
 */
export const getCategories = async (req, res) => {
  try {
    const match = {};
    if (req.organizationId) {
      match.organizationId = req.organizationId;
    }
    match.category = { $ne: null, $exists: true };

    const categories = await Product.distinct("category", match);
    res.json(categories.filter(Boolean).sort());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

