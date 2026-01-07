import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

// JWT_SECRET environment variable'dan alınmalı
// Production'da mutlaka güçlü bir secret kullanın!
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET environment variable is required in production!");
}
const DEFAULT_SECRET = "dev-secret-change-in-production"; // Sadece development için

/**
 * JWT token oluştur
 */
export function generateToken(user) {
  return jwt.sign(
    {
      userId: user._id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET || DEFAULT_SECRET,
    { expiresIn: "7d" }
  );
}

/**
 * JWT token'ı verify et ve user bilgisini req.user'a ekle
 */
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const decoded = jwt.verify(token, JWT_SECRET || DEFAULT_SECRET);
    
    // User'ı database'den çek (güncel bilgiler için)
    const user = await User.findById(decoded.userId)
      .select("-password")
      .lean();
    
    if (!user || !user.isActive) {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    // req.user'a ekle (customerProfile dahil)
    req.user = {
      _id: user._id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role,
      customerProfile: user.customerProfile || null,
    };

    next();
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expired" });
    }
    return res.status(500).json({ error: "Authentication error" });
  }
}

/**
 * Role-based access control
 * Kullanım: requireRole("admin") veya requireRole(["admin", "driver"])
 */
export function requireRole(allowedRoles) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    
    next();
  };
}

