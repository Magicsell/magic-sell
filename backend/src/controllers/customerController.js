import { Customer } from "../models/Customer.js";
import { geocodeUK } from "../utils/geocode.js";

export const getCustomers = async (req, res) => {
  try {
    // Tenant filter
    const query = {};
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const rows = await Customer.find(query).sort({ createdAt: -1 });
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

async function safeGeocode({ postcode, address }) {
  try {
    let mod;
    try { mod = await import("../utils/geocode.js"); }  // varsa buradan
    catch { mod = await import("../geocode.js"); }      // yoksa buradan
    const { geocodeUK } = mod;
    const geo = await geocodeUK({ postcode, address });
    if (geo && typeof geo.lat === "number" && typeof geo.lng === "number") return geo;
  } catch {}
  return null;
}

// POST /api/customers
export const createCustomer = async (req, res) => {
  try {
    const b = req.body || {};               // <-- HATA: b tanımlı değildi, tanımladık

    if (!b.shopName || !b.shopName.trim()) {
      return res.status(400).json({ message: "shopName required" });
    }

    const doc = {
      organizationId: req.organizationId || b.organizationId, // Tenant support
      shopName: b.shopName.trim(),
      name: b.name ?? b.customerName ?? null,
      phone: b.phone ?? null,
      address: b.address ?? null,
      postcode: b.postcode ?? null,
    };

    // Postcode/adres varsa geo hesapla (sessiz başarısız olabilir)
    if (doc.postcode || doc.address) {
      const geo = await safeGeocode({ postcode: doc.postcode, address: doc.address });
      if (geo) doc.geo = geo;
    }

    const saved = await Customer.create(doc);
    return res.status(201).json(saved);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
};
export const getCustomerById = async (req, res) => {
  try {
    // Tenant filter
    const query = { _id: req.params.id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const row = await Customer.findOne(query);
    if (!row) return res.status(404).json({ message: "Customer not found" });
    res.json(row);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const b = req.body || {};               // <-- burada da b tanımlı olmalı

    const update = {};
    if (b.shopName != null) update.shopName = b.shopName;
    if (b.name != null) update.name = b.name;
    if (b.customerName != null) update.name = b.customerName; // frontend bazen böyle gönderiyor
    if (b.phone != null) update.phone = b.phone;
    if (b.address != null) update.address = b.address;
    if (b.postcode != null) update.postcode = b.postcode;

    // adres/postcode değiştiyse geo'yu güncelle
    if (b.postcode != null || b.address != null) {
      const geo = await safeGeocode({ postcode: b.postcode, address: b.address });
      if (geo) update.geo = geo;
    }

    // Tenant filter
    const query = { _id: id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const saved = await Customer.findOneAndUpdate(query, update, { new: true });
    if (!saved) return res.status(404).json({ message: "Customer not found" });
    return res.json(saved);
  } catch (e) {
    return res.status(400).json({ message: e.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    // Tenant filter
    const query = { _id: req.params.id };
    if (req.organizationId) {
      query.organizationId = req.organizationId;
    }

    const row = await Customer.findOneAndDelete(query);
    if (!row) return res.status(404).json({ message: "Customer not found" });
    res.status(204).send(); // no content
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};
