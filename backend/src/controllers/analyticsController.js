// src/controllers/analyticsController.js
import { Order } from "../models/Order.js";
import { Customer } from "../models/Customer.js";

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

export const getSummary = async (req, res) => {
  try {
    const tz = req.query.tz || TZ_DEFAULT;
    const todayStr = todayYMD(tz); // e.g. "2025-09-01"

    // Aggregation helper
    const dayStr = {
      $dateToString: { date: "$orderDate", format: "%Y-%m-%d", timezone: tz },
    };

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
    ] = await Promise.all([
      Order.aggregate([
        { $match: { status: "delivered" } },
        {
          $group: {
            _id: null,
            revenue: { $sum: { $ifNull: ["$totalAmount", 0] } },
            deliveredOrders: { $sum: 1 },
          },
        },
      ]),

      Order.countDocuments(),

      Order.aggregate([
        { $match: { $expr: { $eq: [dayStr, todayStr] } } }, // today (all)
        { $count: "orders" },
      ]),

      Order.aggregate([
        {
          $match: {
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
        { $match: { status: "delivered" } },
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
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, status: "$_id", count: 1 } },
      ]),

      // weekly delivered – gün bazında
      Order.aggregate([
        { $match: { status: "delivered" } },
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
        { $match: { status: "delivered" } },
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
        { $match: { status: "delivered" } },
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

      Order.find().sort({ orderDate: -1 }).limit(10).lean(),

      Customer.countDocuments(),
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

    // ---- Weekly → son 7 günü 0'larla doldur (grafiğin boş kalmaması için)
    const mapWeekly = new Map(
      (weeklyAggAll || []).map(r => [r._id, { r: Number(r.revenue || 0), o: Number(r.orders || 0) }])
    );
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return ymdOf(d, tz);
    });
    const weeklyFilled = last7.map(ds => {
      const item = mapWeekly.get(ds);
      return {
        date: ds,
        revenue: item ? item.r : 0,
        orders: item ? item.o : 0,
      };
    });

    // Prediction confidence (çok basit sinyal)
    const statusMap = Object.fromEntries((statusAgg || []).map(s => [s.status, s.count]));
    const deliveredCountAllTime = statusMap["delivered"] || 0;
    const deliveryRate = totalOrdersCount ? deliveredCountAllTime / totalOrdersCount : 0;
    const predictionConfidence = Math.round((0.6 + 0.4 * deliveryRate) * 100);

    res.json({
      meta: { tz, todayStr },
      totals: {
        orders: totalOrdersCount, // tüm sipariş sayısı
        deliveredOrders: deliveredTotals.deliveredOrders, // toplam delivered
        revenue: Number(deliveredTotals.revenue || 0), // sadece delivered geliri
        avgOrderValue:
          deliveredTotals.deliveredOrders > 0
            ? Number(deliveredTotals.revenue) / deliveredTotals.deliveredOrders
            : 0,
        totalCustomers,
      },
      today: {
        orders: todayAll, // bugün (tüm statüler)
        revenue: Number(todayDelivered.revenue || 0), // bugün delivered geliri
        deliveredOrders: todayDelivered.deliveredOrders || 0,
      },
      weekly: weeklyFilled,           // <- doldurulmuş 7 günlük dizi
      payments: paymentAgg,           // delivered
      status: statusAgg,              // all statuses
      topShop: topShopAgg[0] || null, // delivered (revenue alanıyla)
      topCustomers: topCustomersAgg,  // aslında top SHOPS – customerName=shopName
      recentOrders,                   // mixed
      predictionConfidence,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
