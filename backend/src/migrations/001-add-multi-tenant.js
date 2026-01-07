/**
 * Migration: Add Multi-Tenant Support
 * 
 * Bu migration script'i:
 * 1. Default organization oluşturur
 * 2. Mevcut tüm Orders'a organizationId ekler
 * 3. Mevcut tüm Customers'a organizationId ekler
 * 4. Mevcut tüm ActiveRoutes'a organizationId ekler
 * 5. Admin ve driver user'ları oluşturur (hardcoded credentials)
 * 
 * GÜVENLİK: Bu script mevcut verileri SİLMEZ, sadece organizationId ekler
 * 
 * Kullanım: npm run migrate
 */

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import { Organization } from "../models/Organization.js";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { Customer } from "../models/Customer.js";
import { ActiveRoute } from "../models/ActiveRoute.js";

const DEFAULT_ORG_SLUG = "default-org";
const DEFAULT_ORG_NAME = "Default Organization";

async function migrate() {
  try {
    console.log("🔄 Starting migration: Add Multi-Tenant Support...");
    
    // DB bağlantısı
    await connectDB();
    console.log("✅ Database connected");
    
    // 1. Default organization oluştur (varsa kullan)
    let defaultOrg = await Organization.findOne({ slug: DEFAULT_ORG_SLUG });
    
    if (!defaultOrg) {
      console.log("📦 Creating default organization...");
      defaultOrg = await Organization.create({
        name: DEFAULT_ORG_NAME,
        slug: DEFAULT_ORG_SLUG,
        subscriptionPlan: "free",
        subscriptionStatus: "active",
        settings: {
          timezone: "Europe/London",
          currency: "GBP",
          depotLocation: {
            lat: 50.707088,
            lng: -1.922318,
            postcode: "BH13 7EX",
          },
          deliveryRadius: 50,
        },
      });
      console.log(`✅ Created organization: ${defaultOrg._id}`);
    } else {
      console.log(`✅ Using existing organization: ${defaultOrg._id}`);
    }
    
    const orgId = defaultOrg._id;
    
    // 2. Mevcut Orders'a organizationId ekle
    console.log("📦 Migrating Orders...");
    const ordersResult = await Order.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${ordersResult.modifiedCount} orders`);
    
    // 3. Mevcut Customers'a organizationId ekle
    console.log("📦 Migrating Customers...");
    const customersResult = await Customer.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${customersResult.modifiedCount} customers`);
    
    // 4. Mevcut ActiveRoutes'a organizationId ekle
    console.log("📦 Migrating ActiveRoutes...");
    const routesResult = await ActiveRoute.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: orgId } }
    );
    console.log(`✅ Updated ${routesResult.modifiedCount} active routes`);
    
    // 5. Admin ve driver user'ları oluştur (varsa oluşturma)
    console.log("📦 Creating admin and driver users...");
    
    // Admin user
    const adminEmail = "admin@magicsell.com";
    let adminUser = await User.findOne({ 
      organizationId: orgId, 
      email: adminEmail 
    });
    
    if (!adminUser) {
      adminUser = await User.create({
        organizationId: orgId,
        email: adminEmail,
        password: "admin123", // bcrypt ile hash'lenecek
        role: "admin",
        isActive: true,
      });
      console.log(`✅ Created admin user: ${adminEmail}`);
    } else {
      console.log(`✅ Admin user already exists: ${adminEmail}`);
    }
    
    // Driver user
    const driverEmail = "driver@magicsell.com";
    let driverUser = await User.findOne({ 
      organizationId: orgId, 
      email: driverEmail 
    });
    
    if (!driverUser) {
      driverUser = await User.create({
        organizationId: orgId,
        email: driverEmail,
        password: "driver123", // bcrypt ile hash'lenecek
        role: "driver",
        isActive: true,
        driverProfile: {
          name: "Driver",
          phone: "",
        },
      });
      console.log(`✅ Created driver user: ${driverEmail}`);
    } else {
      console.log(`✅ Driver user already exists: ${driverEmail}`);
    }
    
    console.log("\n✅ Migration completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   - Organization: ${defaultOrg.name} (${defaultOrg.slug})`);
    console.log(`   - Orders migrated: ${ordersResult.modifiedCount}`);
    console.log(`   - Customers migrated: ${customersResult.modifiedCount}`);
    console.log(`   - ActiveRoutes migrated: ${routesResult.modifiedCount}`);
    console.log(`   - Admin user: ${adminEmail} / admin123`);
    console.log(`   - Driver user: ${driverEmail} / driver123`);
    console.log("\n⚠️  NOTE: Update your frontend auth to use these new credentials!");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

// Script'i çalıştır
migrate();

