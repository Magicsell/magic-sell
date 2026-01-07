// src/controllers/analyticsController.js
import { Order } from "../models/Order.js";
import { Customer } from "../models/Customer.js";
import { Product } from "../models/Product.js";

const TZ_DEFAULT = "Europe/London";

// "YYYY-MM-DD" (given timezone) – generic formatter
function ymdOf(date, tz = TZ_DEFAULT) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find(p => p.type === "year").value;
  const m = parts.find(p => p.type === "month").value;
  const d = parts.find(p => p.type === "day").value;
  return `${y}-${m}-${d}`;
}
function todayYMD(tz = TZ_DEFAULT) {
  return ymdOf(new Date(), tz);
}

// Get ISO week number
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

export const getSummary = async (req, res) => {
  try {
    const tz = req.query.tz || TZ_DEFAULT;
    const period = req.query.period || "7d"; // 7d, 14d, 3m, 6m
    const todayStr = todayYMD(tz); // e.g. "2025-09-01"

    // Period configuration
    let days, groupBy, dateFormat, labelFormat;
    if (period === "7d" || period === "14d") {
      days = period === "7d" ? 7 : 14;
      groupBy = "day";
      dateFormat = "%Y-%m-%d";
      labelFormat = "%d/%m";
    } else {
      // Monthly periods - use weekly aggregation
      const monthMap = { "3m": 3, "6m": 6 };
      days = (monthMap[period] || 3) * 30;
      groupBy = "week";
      dateFormat = "%Y-W%V"; // ISO week format
      labelFormat = "W%V"; // Week number
    }

    // Aggregation helper
    const dayStr = {
      $dateToString: { date: "$orderDate", format: dateFormat, timezone: tz },
    };

    // Tenant filter - base match
    const baseMatch = {};
    if (req.organizationId) {
      baseMatch.organizationId = req.organizationId;
    }

    const [
      // delivered totals (revenue + delivered sayısı)
      deliveredTotalsAgg,
      // toplam sipariş sayısı (tüm statüler)
      totalOrdersCount,
      // bugün: tüm sipariş sayısı
      todayAllAgg,
      // bugün: delivered gelir & delivered sayısı
      todayDeliveredAgg,
      // payment breakdown (delivered)
      paymentAgg,
      // status breakdown (tüm statüler)
      statusAgg,
      // weekly (delivered; gün bazında)
      weeklyAggAll,
      // top shop (delivered) – revenue ile
      topShopAgg,
      // top "customers" (aslında shop listesi; frontend adına dokunmamak için customerName alanına shop adı koyacağız)
      topCustomersAgg,
      // recent orders (son 10, statü fark etmeksizin)
      recentOrders,
      // total customers
      totalCustomers,
      // product statistics
      totalProducts,
      activeProducts,
      lowStockProducts,
      totalCategories,
      // top products by quantity sold
      topProductsByQuantity,
      // top categories by revenue
      topCategoriesByRevenue,
      // recent products
      recentProducts,
    ] = await Promise.all([
      Order.aggregate([
        { $match: { ...baseMatch, status: "delivered" } },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            deliveredOrders: { $sum: 1 },
          },
        },
      ]),

      Order.countDocuments(baseMatch),

      Order.aggregate([
        { $match: { ...baseMatch, $expr: { $eq: [dayStr, todayStr] } } }, // today (all)
        { $count: "orders" },
      ]),

      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            status: "delivered",
            $expr: { $eq: [dayStr, todayStr] }, // today delivered
          },
        },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            deliveredOrders: { $sum: 1 },
          },
        },
      ]),

      Order.aggregate([
        { $match: { ...baseMatch, status: "delivered" } },
        {
          $group: {
            _id: "$paymentMethod",
            amount: { $sum: { $ifNull: ["$totalAmount", 0] } },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, method: "$_id", amount: 1, count: 1 } },
        { $sort: { amount: -1 } },
      ]),

      Order.aggregate([
        { $match: baseMatch },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]),

      // weekly delivered – gün bazında (son N gün)
      Order.aggregate([
        {
          $match: {
            ...baseMatch,
            status: "delivered",
            orderDate: {
              $gte: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)), // Son N gün
            },
          },
        },
        {
          $group: {
            _id: dayStr,
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // top shop – revenue alanıyla
      Order.aggregate([
        { $match: { ...baseMatch, status: "delivered" } },
        {
          $group: {
            _id: "$shopName",
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            orders: { $sum: 1 },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 1 },
        { $project: { _id: 0, shopName: "$_id", revenue: 1, orders: 1 } },
      ]),

      // top shops – frontend bozulmasın diye `customerName` alanına shop adını yazıyoruz
      Order.aggregate([
        { $match: { ...baseMatch, status: "delivered" } },
        {
          $group: {
            _id: "$shopName",
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            orders: { $sum: 1 },
          },
        },
        { $project: { _id: 0, customerName: "$_id", revenue: 1, orders: 1 } },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]),

      Order.find(baseMatch).sort({ orderDate: -1 }).limit(10).lean(),

      Customer.countDocuments(baseMatch),

      // Product statistics
      Product.countDocuments(baseMatch),
      Product.countDocuments({ ...baseMatch, isActive: true }),
      Product.countDocuments({
        ...baseMatch,
        "stock.trackStock": true,
        $expr: {
          $and: [
            { $lte: ["$stock.quantity", "$stock.lowStockThreshold"] },
            { $gte: ["$stock.quantity", 0] },
          ],
        },
      }),
      Product.distinct("category", baseMatch).then((cats) => cats.filter(Boolean).length),

      // Top products by quantity sold (from order items)
      Order.aggregate([
        { $match: { ...baseMatch, status: "delivered" } },
        // Only process orders that have items array with at least one item
        { $match: { items: { $exists: true, $ne: [], $type: "array" } } },
        { $unwind: "$items" },
        // Filter out items without productId
        { $match: { "items.productId": { $exists: true, $ne: null } } },
        {
          $group: {
            _id: "$items.productId",
            productName: { $first: "$items.productName" },
            totalQuantity: { $sum: { $ifNull: ["$items.quantity", 0] } },
            totalRevenue: { $sum: { $ifNull: ["$items.subtotal", 0] } },
            orderCount: { $sum: 1 },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            productId: "$_id",
            productName: 1,
            totalQuantity: 1,
            totalRevenue: 1,
            orderCount: 1,
          },
        },
      ]),

      // Top categories by revenue
      Order.aggregate([
        { $match: { ...baseMatch, status: "delivered" } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$product.category",
            totalRevenue: { $sum: "$items.subtotal" },
            orderCount: { $sum: 1 },
          },
        },
        { $match: { _id: { $ne: null } } },
        { $sort: { totalRevenue: -1 } },
        { $limit: 5 },
        {
          $project: {
            _id: 0,
            category: "$_id",
            totalRevenue: 1,
            orderCount: 1,
          },
        },
      ]),

      // Recent products
      Product.find(baseMatch)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name imageUrl price category createdAt")
        .lean(),
    ]);

    const deliveredTotals = deliveredTotalsAgg[0] || {
      revenue: 0,
      deliveredOrders: 0,
    };
    const todayAll = todayAllAgg[0]?.orders || 0;
    const todayDelivered = todayDeliveredAgg[0] || {
      revenue: 0,
      deliveredOrders: 0,
    };

    // Debug: Product statistics
    console.log("[Analytics] Period filter:", period, "Days:", days, "GroupBy:", groupBy);
    console.log("[Analytics] OrganizationId:", req.organizationId);
    console.log("[Analytics] BaseMatch for products:", JSON.stringify(baseMatch));
    console.log("[Analytics] Product counts (raw):", {
      totalProducts,
      activeProducts,
      lowStockProducts,
      totalCategories,
    });
    console.log("[Analytics] Product counts (with defaults):", {
      totalProducts: totalProducts || 0,
      activeProducts: activeProducts || 0,
      lowStockProducts: lowStockProducts || 0,
      totalCategories: totalCategories || 0,
    });

    // ---- Weekly → son N günü/haftayı 0'larla doldur (grafiğin boş kalmaması için)
    const mapWeekly = new Map(
      (weeklyAggAll || []).map(r => [r._id, { r: Number(r.revenue || 0), o: Number(r.orders || 0) }])
    );
    
    let weeklyFilled;
    if (groupBy === "day") {
      // Daily view
      const lastNDays = Array.from({ length: days }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1 - i));
        return ymdOf(d, tz);
      });
      weeklyFilled = lastNDays.map(ds => {
        const item = mapWeekly.get(ds);
        const [y, m, d] = ds.split("-");
        return {
          date: ds,
          label: `${d}/${m}`,
          revenue: item ? item.r : 0,
          orders: item ? item.o : 0,
        };
      });
    } else {
      // Weekly view
      const weeks = Math.ceil(days / 7);
      const lastNWeeks = Array.from({ length: weeks }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - ((weeks - 1 - i) * 7));
        const year = d.getFullYear();
        const week = getISOWeek(d);
        return `${year}-W${String(week).padStart(2, "0")}`;
      });
      weeklyFilled = lastNWeeks.map(weekKey => {
        const item = mapWeekly.get(weekKey);
        return {
          date: weekKey,
          label: `W${weekKey.split("-W")[1]}`,
          revenue: item ? item.r : 0,
          orders: item ? item.o : 0,
        };
      });
    }

    // Prediction confidence (çok basit sinyal)
    const statusMap = Object.fromEntries((statusAgg || []).map(s => [s.status, s.count]));
    const deliveredCountAllTime = statusMap["delivered"] || 0;
    const deliveryRate = totalOrdersCount ? deliveredCountAllTime / totalOrdersCount : 0;
    const predictionConfidence = Math.round((0.6 + 0.4 * deliveryRate) * 100);

    const response = {
      meta: { tz, todayStr, period, groupBy },
      totals: {
        orders: totalOrdersCount, // tüm sipariş sayısı
        deliveredOrders: deliveredTotals.deliveredOrders, // toplam delivered
        revenue: Number(deliveredTotals.revenue || 0), // sadece delivered geliri
        avgOrderValue:
          deliveredTotals.deliveredOrders > 0
            ? Number(deliveredTotals.revenue) / deliveredTotals.deliveredOrders
            : 0,
        totalCustomers: totalCustomers || 0,
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        lowStockProducts: lowStockProducts || 0,
        totalCategories: totalCategories || 0,
      },
      today: {
        orders: todayAll, // bugün (tüm statüler)
        revenue: Number(todayDelivered.revenue || 0), // bugün delivered geliri
        deliveredOrders: todayDelivered.deliveredOrders || 0,
      },
      weekly: weeklyFilled,           // <- doldurulmuş N günlük dizi
      payments: paymentAgg,           // delivered
      status: statusAgg,              // all statuses
      topShop: topShopAgg[0] || null, // delivered (revenue alanıyla)
      topCustomers: topCustomersAgg,  // aslında top SHOPS – customerName=shopName
      recentOrders,                   // mixed
      topProducts: topProductsByQuantity || [],
      topCategories: topCategoriesByRevenue || [],
      recentProducts: recentProducts || [],
      predictionConfidence,
    };

    console.log("[Analytics] Response totals:", JSON.stringify(response.totals, null, 2));
    console.log("[Analytics] Weekly array length:", response.weekly.length);

    res.json(response);
  } catch (e) {
    console.error("[Analytics] Error:", e);
    res.status(500).json({ message: e.message });
  }
};
