// src/controllers/orderController.js
import { Order } from "../models/Order.js";
import { Customer } from "../models/Customer.js";
import { geocodeUK } from "../utils/geocode.js";

/* ---------------------------------------------------------
 * Helpers
 * --------------------------------------------------------- */
function normalizeGeo(geo) {
  const lat = Number(geo?.lat);
  const lng = Number(geo?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
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
      "orderDate",
      "-orderDate",
      "createdAt",
      "-createdAt",
      "status",
      "-status",
    ]);
    const sortKey = allowedSort.has(sort) ? sort : "-orderDate";
    const sortObj = sortKey.startsWith("-")
      ? { [sortKey.slice(1)]: -1 }
      : { [sortKey]: 1 };

    // temel filtre
    const match = {};
    if (status) match.status = status;

    // q: serbest arama (regex; index opsiyonel)
    if (q && q.trim()) {
      const rgx = new RegExp(q.trim(), "i");
      match.$or = [
        { orderNo: rgx },
        { shopName: rgx },
        { customerName: rgx },
        { "customer.name": rgx },
        { notes: rgx },
      ];
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

    const order = new Order({
      ...b,
      totalAmount: Number(b.totalAmount),
      orderDate: b.orderDate ? new Date(b.orderDate) : new Date(),
    });

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

    const saved = await order.save();
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
      notes = null,
      proofUrl = null,
    } = req.body || {};

    const order = await Order.findById(id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    order.status = "delivered";
    order.paymentMethod = paymentMethod;
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

    const order = await Order.findByIdAndUpdate(id, update, { new: true });
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

    const existing = await Order.findById(id);
    if (!existing) return res.status(404).json({ message: "Order not found" });

    const update = {};
    if (b.shopName != null) update.shopName = b.shopName;
    if (b.customerName != null) update.customerName = b.customerName;
    if (b.customerPhone != null) update.customerPhone = b.customerPhone;
    if (b.customerAddress != null) update.customerAddress = b.customerAddress;
    if (b.customerPostcode != null) update.customerPostcode = b.customerPostcode;
    if (b.totalAmount != null) update.totalAmount = Number(b.totalAmount);
    if (b.paymentMethod != null) update.paymentMethod = b.paymentMethod;
    if (b.orderDate != null) update.orderDate = new Date(b.orderDate);

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

    const saved = await Order.findByIdAndUpdate(id, update, { new: true });
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
    const o = await Order.findById(req.params.id).lean();
    if (!o) return res.status(404).json({ message: "Order not found" });
    res.json(o);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
}


export async function deleteOrder(req, res) {
  const { id } = req.params;
  const doc = await Order.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ message: "Order not found" });

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
