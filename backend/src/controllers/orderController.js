// src/controllers/orderController.js
import { Order } from "../models/Order.js";
import { Customer } from "../models/Customer.js";
import { Product } from "../models/Product.js";
import { User } from "../models/User.js";
import { geocodeUK } from "../utils/geocode.js";

/* ---------------------------------------------------------
 * Helpers
 * --------------------------------------------------------- */
function normalizeGeo(geo) {
  const lat = Number(geo?.lat);
  const lng = Number(geo?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

/**
 * Update product stock when order items are added/updated
 * @param {Array} items - Order items array
 * @param {Array} oldItems - Previous order items (for updates, null for new orders)
 * @param {String} organizationId - Tenant ID
 */
async function updateProductStock(items, oldItems = null, organizationId) {
  if (!Array.isArray(items) || items.length === 0) return;

  // Calculate stock changes
  const stockChanges = {}; // { productId: quantityChange }

  // For new orders: subtract quantities
  if (!oldItems) {
    items.forEach((item) => {
      if (item.productId) {
        const qty = Number(item.quantity) || 0;
        if (qty > 0) {
          stockChanges[item.productId] = (stockChanges[item.productId] || 0) - qty;
        }
      }
    });
  } else {
    // For updates: calculate difference
    const oldMap = {};
    oldItems.forEach((item) => {
      if (item.productId) {
        oldMap[item.productId] = (oldMap[item.productId] || 0) + (Number(item.quantity) || 0);
      }
    });

    const newMap = {};
    items.forEach((item) => {
      if (item.productId) {
        newMap[item.productId] = (newMap[item.productId] || 0) + (Number(item.quantity) || 0);
      }
    });

    // Calculate changes
    const allProductIds = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);
    allProductIds.forEach((productId) => {
      const oldQty = oldMap[productId] || 0;
      const newQty = newMap[productId] || 0;
      const diff = newQty - oldQty;
      if (diff !== 0) {
        stockChanges[productId] = diff;
      }
    });
  }

  // Apply stock changes
  for (const [productId, quantityChange] of Object.entries(stockChanges)) {
    try {
      const query = { _id: productId };
      if (organizationId) {
        query.organizationId = organizationId;
      }

      const product = await Product.findOne(query);
      if (!product) continue;

      // Only update if stock tracking is enabled
      if (!product.stock?.trackStock) continue;

      const currentStock = product.stock.quantity || 0;
      const newStock = currentStock + quantityChange; // quantityChange is negative for additions

      // Check if stock is sufficient (only for negative changes, i.e., when subtracting)
      if (quantityChange < 0 && newStock < 0) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${currentStock}, Requested: ${Math.abs(quantityChange)}`
        );
      }

      // Update stock
      product.stock.quantity = Math.max(0, newStock);
      await product.save();
    } catch (err) {
      // If it's a stock error, throw it up
      if (err.message.includes("Insufficient stock")) {
        throw err;
      }
      // Otherwise, log and continue
      console.error(`Failed to update stock for product ${productId}:`, err.message);
    }
  }
}

/* ---------------------------------------------------------
 * GET /api/orders
 * Query:
 *   status=pending|in_progress|delivered|cancelled
 *   date=today|yesterday|range
 *   from=YYYY-MM-DD
 *   to=YYYY-MM-DD
 *   q=free text
 *   withGeo=1           <-- yeni: sadece geo'su sayısal olan kayıtlar
 *   page=1&pageSize=20
 *   sort=-orderDate (allowed: orderDate,-orderDate,createdAt,-createdAt,status,-status)
 * --------------------------------------------------------- */
export const getOrders = async (req, res) => {
  try {
    const {
      status,
      date, // today | yesterday | range
      from,
      to,
      q,
      page = 1,
      pageSize = 20,
      sort = "-orderDate",
      withGeo, // <-- eklendi
    } = req.query;

    const p = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 20));

    // güvenli sort
    const allowedSort = new Set([
      "orderNo",
      "-orderNo",
      "orderDate",
      "-orderDate",
      "createdAt",
      "-createdAt",
      "status",
      "-status",
      "paymentMethod",
      "-paymentMethod",
      "totalAmount",
      "-totalAmount",
      "shopName",
      "-shopName",
      "customerName",
      "-customerName",
    ]);
    const sortKey = allowedSort.has(sort) ? sort : "-orderDate";
    const sortObj = sortKey.startsWith("-")
      ? { [sortKey.slice(1)]: -1 }
      : { [sortKey]: 1 };
    
    console.log("[Orders API] Sort params:", { 
      requested: sort, 
      allowed: allowedSort.has(sort), 
      sortKey, 
      sortObj 
    });

    // temel filtre
    const match = {};
    if (status) match.status = status;

    // q: serbest arama (regex; index opsiyonel)
    if (q && q.trim()) {
      const searchTerm = q.trim();
      const rgx = new RegExp(searchTerm, "i");
      const searchConditions = [
        { shopName: rgx },
        { customerName: rgx },
        { "customer.name": rgx },
        { notes: rgx },
      ];
      
      // orderNo is a Number field, so we need to handle it differently
      // Only search by orderNo if the search term is a valid number
      const orderNoNum = parseInt(searchTerm, 10);
      // Check if search term is a pure number (no letters, just digits)
      const isPureNumber = /^\d+$/.test(searchTerm);
      
      if (isPureNumber && !isNaN(orderNoNum) && orderNoNum > 0) {
        // Search by orderNo as number (exact match)
        // e.g., "300" matches orderNo 300
        searchConditions.push({ orderNo: orderNoNum });
      }
      
      match.$or = searchConditions;
    }

    // withGeo: rota ile bire bir aynı—lat/lng number olmalı
    if (withGeo) {
      match["geo.lat"] = { $type: "number" };
      match["geo.lng"] = { $type: "number" };
    }

    // --- UK günü (timezone) için Mongo tarafında $expr + $dateToString ---
    // orderDate → "YYYY-MM-DD" (Europe/London)
    const ukFmt = {
      $dateToString: {
        date: "$orderDate",
        format: "%Y-%m-%d",
        timezone: "Europe/London",
      },
    };

    if (date === "today") {
      match.$expr = {
        $eq: [
          ukFmt,
          {
            $dateToString: {
              date: "$$NOW",
              format: "%Y-%m-%d",
              timezone: "Europe/London",
            },
          },
        ],
      };
    } else if (date === "yesterday") {
      match.$expr = {
        $eq: [
          ukFmt,
          {
            $dateToString: {
              date: {
                $dateSubtract: { startDate: "$$NOW", unit: "day", amount: 1 },
              },
              format: "%Y-%m-%d",
              timezone: "Europe/London",
            },
          },
        ],
      };
    } else {
      // from/to: "YYYY-MM-DD" string karşılaştırması (lexicographic uyumlu)
      const fromStr = (from || "").slice(0, 10);
      const toStr = (to || "").slice(0, 10);
      const expr = [];
      if (fromStr) expr.push({ $gte: [ukFmt, fromStr] });
      if (toStr) expr.push({ $lte: [ukFmt, toStr] });
      if (expr.length === 1) match.$expr = expr[0];
      else if (expr.length > 0) match.$expr = { $and: expr };
    }

    // Tenant filter: organizationId ekle (varsa)
    if (req.organizationId) {
      match.organizationId = req.organizationId;
    }

    // Customer filter: If user is a customer, only show their orders
    if (req.user && req.user.role === "customer" && req.user.customerProfile) {
      const customerName = req.user.customerProfile.name;
      if (customerName) {
        match.customerName = customerName;
      }
    }

    const skip = (p - 1) * ps;

    const [items, total] = await Promise.all([
      Order.find(match).sort(sortObj).skip(skip).limit(ps),
      Order.countDocuments(match),
    ]);

    res.json({
      items,
      total,
      page: p,
      pageSize: ps,
      pages: Math.ceil(total / ps),
      sort: sortKey,
      filters: {
        status: status || null,
        date: date || null,
        from: from || null,
        to: to || null,
        q: q || null,
        withGeo: !!withGeo,
        tz: "Europe/London",
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ---------------------------------------------------------
 * POST /api/orders
 * --------------------------------------------------------- */
export const createOrder = async (req, res) => {
  try {
    const b = req.body || {};

    // Prepare items array (always include, even if empty)
    const items = Array.isArray(b.items) && b.items.length > 0
      ? b.items.map((item) => ({
          productId: item.productId || null,
          productName: item.productName || "",
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          subtotal: Number(item.subtotal || item.quantity * item.price) || 0,
        }))
      : [];

    // Validate payment breakdown
    const paymentBreakdown = b.paymentBreakdown || {};
    const balanceAmount = Number(paymentBreakdown.balanceAmount || 0);
    const cashAmount = Number(paymentBreakdown.cashAmount || 0);
    const cardAmount = Number(paymentBreakdown.cardAmount || 0);
    const bankAmount = Number(paymentBreakdown.bankAmount || 0);
    const totalPaid = balanceAmount + cashAmount + cardAmount + bankAmount;
    const totalAmount = Number(b.totalAmount);

    // Validate payment breakdown sums to total
    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      return res.status(400).json({ 
        error: `Payment breakdown (${totalPaid.toFixed(2)}) does not match total amount (${totalAmount.toFixed(2)})` 
      });
    }

    // If balance is used, check and update customer balance
    if (balanceAmount > 0) {
      // Find customer user by customer ID or customerName
      let customerUser = null;
      if (b.customer) {
        // b.customer is ObjectId or string
        customerUser = await User.findOne({ 
          _id: b.customer,
          role: "customer",
          organizationId: req.organizationId 
        });
      } else if (b.customerName) {
        // Try to find by customerProfile.name
        customerUser = await User.findOne({
          "customerProfile.name": b.customerName,
          role: "customer",
          organizationId: req.organizationId
        });
      }

      if (!customerUser) {
        return res.status(400).json({ error: "Customer not found" });
      }

      const currentBalance = Number(customerUser.customerProfile?.balance || 0);
      if (currentBalance < balanceAmount) {
        return res.status(400).json({ 
          error: `Insufficient balance. Available: £${currentBalance.toFixed(2)}, Required: £${balanceAmount.toFixed(2)}` 
        });
      }

      // Deduct balance
      customerUser.customerProfile.balance = currentBalance - balanceAmount;
      await customerUser.save();
    }

    // Handle expectedOrderNo - set orderNo directly and update counter
    const orderData = {
      ...b,
      organizationId: req.organizationId || b.organizationId, // Tenant support
      totalAmount: totalAmount,
      orderDate: b.orderDate ? new Date(b.orderDate) : new Date(),
      items: items, // Always include items array
      // Ensure paymentBreakdown is always set (override any from b)
      paymentBreakdown: {
        balanceAmount,
        cashAmount,
        cardAmount,
        bankAmount,
      },
    };
    
    // Debug log
    console.log("[Order Create] paymentBreakdown:", orderData.paymentBreakdown);
    
    if (b.expectedOrderNo) {
      const expectedNo = Number(b.expectedOrderNo);
      // Set orderNo directly - this will prevent pre-save hook from running
      orderData.orderNo = expectedNo;
      
      // Update counter to match expectedOrderNo (for next order)
      const orgId = req.organizationId || b.organizationId;
      const orgIdStr = orgId ? String(orgId) : null;
      const counterKey = orgIdStr ? `orders:${orgIdStr}` : "orders:global";
      
      const { default: mongoose } = await import("mongoose");
      const counterSchema = new mongoose.Schema(
        { _id: String, seq: { type: Number, default: 0 } },
        { collection: "counters", versionKey: false }
      );
      const Counter = mongoose.models.__Counter || mongoose.model("__Counter", counterSchema);
      
      // Set counter to expectedOrderNo (will be used for next order)
      await Counter.findOneAndUpdate(
        { _id: counterKey },
        { $set: { seq: expectedNo } },
        { upsert: true }
      );
      
      console.log(`[Order] Setting orderNo to ${expectedNo} (expectedOrderNo provided), counter set to ${expectedNo}`);
    }

    const order = new Order(orderData);
    
    // Debug log
    if (b.expectedOrderNo) {
      console.log(`[Order Create] Order object created with orderNo: ${order.orderNo}, expectedOrderNo: ${b.expectedOrderNo}`);
    }

    // 1) Customer'dan geo kopyala (varsa)
    let geo = null;
    if (b.shopName) {
      const c = await Customer.findOne({ shopName: b.shopName }).lean();
      if (c?.geo) geo = normalizeGeo(c.geo);
    }

    // 2) Customer'da yoksa postcode/adres ile geocode
    if (!geo && (b.customerPostcode || b.customerAddress)) {
      const raw = await geocodeUK({
        postcode: b.customerPostcode,
        address: b.customerAddress,
      });
      geo = normalizeGeo(raw);
    }

    if (geo) order.geo = geo;

    // Debug log before save
    console.log(`[Order Create] Before save - orderNo: ${order.orderNo}, isNew: ${order.isNew}, expectedOrderNo: ${b.expectedOrderNo || 'none'}`);
    
    const saved = await order.save();
    
    // Debug log after save
    console.log(`[Order Create] After save - saved orderNo: ${saved.orderNo}`);
    
    // Update product stock
    if (saved.items && saved.items.length > 0) {
      try {
        await updateProductStock(saved.items, null, saved.organizationId || req.organizationId);
      } catch (stockErr) {
        // If stock update fails, we should ideally rollback the order
        // For now, we'll just log the error and return success
        // In production, you might want to delete the order or handle this differently
        console.error("Stock update failed after order creation:", stockErr.message);
        // Optionally: await Order.findByIdAndDelete(saved._id);
        // return res.status(400).json({ message: stockErr.message });
      }
    }
    
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ---------------------------------------------------------
 * POST /api/orders/:id/deliver
 * --------------------------------------------------------- */
export const deliverOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      paymentMethod = "Not Set",
      paymentBreakdown = null,
      notes = null,
      proofUrl = null,
    } = req.body || {};

    // Tenant filter: organizationId kontrolü
    const query = { _id: id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const order = await Order.findOne(query);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = "delivered";
    order.paymentMethod = paymentMethod;
    
    // Update payment breakdown if provided
    if (paymentBreakdown && typeof paymentBreakdown === 'object') {
      order.paymentBreakdown = {
        balanceAmount: Number(paymentBreakdown.balanceAmount || 0),
        cashAmount: Number(paymentBreakdown.cashAmount || 0),
        cardAmount: Number(paymentBreakdown.cardAmount || 0),
        bankAmount: Number(paymentBreakdown.bankAmount || 0),
      };
    }
    
    if (notes !== undefined) order.deliveryNotes = notes;
    if (proofUrl) order.proofUrl = proofUrl;
    order.deliveredAt = new Date();

    await order.save();
    res.json({
      ok: true,
      order: {
        _id: order._id,
        status: order.status,
        paymentMethod: order.paymentMethod,
        paymentBreakdown: order.paymentBreakdown,
        deliveredAt: order.deliveredAt,
        proofUrl: order.proofUrl,
      },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

/* ---------------------------------------------------------
 * PATCH /api/orders/:id/status
 * --------------------------------------------------------- */
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentMethod } = req.body;

    const update = {};
    if (status) {
      update.status = status;
      if (status === "delivered") update.deliveredAt = new Date();
    }
    if (paymentMethod) update.paymentMethod = paymentMethod;

    // Tenant filter
    const query = { _id: id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const order = await Order.findOneAndUpdate(query, update, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ---------------------------------------------------------
 * PATCH /api/orders/:id
 *  - Adres / Postcode değiştiğinde geo yeniden hesaplanır
 * --------------------------------------------------------- */
export const updateOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};

    // Tenant filter
    const query = { _id: id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const existing = await Order.findOne(query);
    if (!existing) return res.status(404).json({ message: "Order not found" });

    const update = {};
    if (b.shopName != null) update.shopName = b.shopName;
    if (b.customerName != null) update.customerName = b.customerName;
    if (b.customerPhone != null) update.customerPhone = b.customerPhone;
    if (b.customerAddress != null) update.customerAddress = b.customerAddress;
    if (b.customerPostcode != null) update.customerPostcode = b.customerPostcode;
    if (b.totalAmount != null) update.totalAmount = Number(b.totalAmount);
    if (b.paymentMethod != null) update.paymentMethod = b.paymentMethod;
    if (b.paymentBreakdown != null) {
      update.paymentBreakdown = {
        balanceAmount: Number(b.paymentBreakdown.balanceAmount || 0),
        cashAmount: Number(b.paymentBreakdown.cashAmount || 0),
        cardAmount: Number(b.paymentBreakdown.cardAmount || 0),
        bankAmount: Number(b.paymentBreakdown.bankAmount || 0),
      };
      
      // Handle balance changes - if balance amount changed, update customer balance
      const oldBalanceAmount = Number(existing.paymentBreakdown?.balanceAmount || 0);
      const newBalanceAmount = Number(b.paymentBreakdown.balanceAmount || 0);
      
      if (oldBalanceAmount !== newBalanceAmount) {
        // Find customer user
        let customerUser = null;
        if (b.customer) {
          customerUser = await User.findOne({ 
            _id: b.customer,
            role: "customer",
            organizationId: req.organizationId 
          });
        } else if (b.customerName || existing.customerName) {
          customerUser = await User.findOne({
            "customerProfile.name": b.customerName || existing.customerName,
            role: "customer",
            organizationId: req.organizationId
          });
        }
        
        if (customerUser) {
          const currentBalance = Number(customerUser.customerProfile?.balance || 0);
          // Refund old balance, deduct new balance
          const balanceDiff = newBalanceAmount - oldBalanceAmount;
          customerUser.customerProfile.balance = currentBalance - balanceDiff;
          
          // Validate balance is not negative
          if (customerUser.customerProfile.balance < 0) {
            return res.status(400).json({ 
              error: `Insufficient balance. Available: £${currentBalance.toFixed(2)}, Required: £${newBalanceAmount.toFixed(2)}` 
            });
          }
          
          await customerUser.save();
        }
      }
    }
    if (b.orderDate != null) update.orderDate = new Date(b.orderDate);
    
    // Items (opsiyonel - backward compatible)
    const oldItems = existing.items || [];
    if (Array.isArray(b.items)) {
      update.items = b.items.length > 0
        ? b.items.map((item) => ({
            productId: item.productId || null,
            productName: item.productName || "",
            quantity: Number(item.quantity) || 1,
            price: Number(item.price) || 0,
            subtotal: Number(item.subtotal || item.quantity * item.price) || 0,
          }))
        : [];
    }

    // address / postcode değiştiyse geocode yap
    const pcChanged =
      b.customerPostcode != null &&
      b.customerPostcode !== existing.customerPostcode;
    const addrChanged =
      b.customerAddress != null &&
      b.customerAddress !== existing.customerAddress;

    if (pcChanged || addrChanged) {
      const postcode = b.customerPostcode ?? existing.customerPostcode ?? "";
      const address = b.customerAddress ?? existing.customerAddress ?? "";
      if (postcode || address) {
        const raw = await geocodeUK({ postcode, address });
        const g = normalizeGeo(raw);
        if (g) update.geo = g;
      }
    }

    const saved = await Order.findOneAndUpdate(query, update, { new: true });
    
    // Update product stock if items changed
    if (Array.isArray(update.items)) {
      try {
        await updateProductStock(update.items, oldItems, saved.organizationId || req.organizationId);
      } catch (stockErr) {
        console.error("Stock update failed after order update:", stockErr.message);
        // Optionally revert the update or return error
        // For now, we'll just log it
      }
    }
    
    res.json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

/* ---------------------------------------------------------
 * GET /api/orders/:id
 * --------------------------------------------------------- */
export async function getOrderById(req, res) {
  try {
    // Tenant filter
    const query = { _id: req.params.id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const o = await Order.findOne(query).lean();
    if (!o) return res.status(404).json({ message: "Order not found" });
    
    // Ensure paymentBreakdown exists with defaults for old orders
    if (!o.paymentBreakdown || typeof o.paymentBreakdown !== 'object') {
      o.paymentBreakdown = {
        balanceAmount: 0,
        cashAmount: 0,
        cardAmount: 0,
        bankAmount: 0,
      };
    } else {
      // Ensure all fields exist
      o.paymentBreakdown = {
        balanceAmount: Number(o.paymentBreakdown.balanceAmount || 0),
        cashAmount: Number(o.paymentBreakdown.cashAmount || 0),
        cardAmount: Number(o.paymentBreakdown.cardAmount || 0),
        bankAmount: Number(o.paymentBreakdown.bankAmount || 0),
      };
    }
    
    // Populate imageUrl for items if productId exists
    if (o.items && Array.isArray(o.items) && o.items.length > 0) {
      const { Product } = await import("../models/Product.js");
      for (const item of o.items) {
        if (item.productId) {
          const product = await Product.findById(item.productId).lean();
          if (product) {
            item.imageUrl = product.imageUrl || null;
          }
        }
      }
    }
    
    res.json(o);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}


export async function deleteOrder(req, res) {
  const { id } = req.params;
  
  // Tenant filter
  const query = { _id: id };
  if (req.organizationId) {
    query.organizationId = req.organizationId;
  }

  const doc = await Order.findOne(query);
  if (!doc) return res.status(404).json({ message: "Order not found" });
  
  // Restore product stock before deleting
  if (doc.items && doc.items.length > 0) {
    try {
      // Reverse stock changes (add back the quantities)
      // We'll manually restore stock instead of using updateProductStock
      for (const item of doc.items) {
        if (item.productId) {
          const productQuery = { _id: item.productId };
          if (doc.organizationId) {
            productQuery.organizationId = doc.organizationId;
          }
          
          const product = await Product.findOne(productQuery);
          if (product && product.stock?.trackStock) {
            const qtyToRestore = Number(item.quantity) || 0;
            product.stock.quantity = (product.stock.quantity || 0) + qtyToRestore;
            await product.save();
          }
        }
      }
    } catch (stockErr) {
      console.error("Failed to restore stock when deleting order:", stockErr.message);
      // Continue with deletion even if stock restore fails
    }
  }
  
  await Order.findOneAndDelete(query);

  // Eğer “proofUrl” dosyası tutuyorsan ve local ortamdaysan temizle
  if (doc.proofUrl && doc.proofUrl.startsWith("/uploads/proofs/") && !process.env.VERCEL) {
    try {
      fs.unlinkSync(path.join(process.cwd(), doc.proofUrl));
    } catch (_) {}
  }

  // Aktif rota kaydında bu order varsa çıkar (modelin varsa)
  try {
    await ActiveRoute.updateMany({}, { $pull: { orderIds: doc._id } });
  } catch (_) {}

  res.json({ ok: true });
}
