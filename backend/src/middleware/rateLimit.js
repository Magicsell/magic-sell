/**
 * Rate Limiting Middleware
 * Brute force saldırılarına karşı koruma
 */

// Basit in-memory rate limiter (production'da Redis kullanılabilir)
const attempts = new Map();

// Her IP için deneme sayısı
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 dakika

export function rateLimitLogin(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  const now = Date.now();
  
  // Eski kayıtları temizle
  const userAttempts = attempts.get(ip) || [];
  const recentAttempts = userAttempts.filter(
    (timestamp) => now - timestamp < WINDOW_MS
  );
  
  // Çok fazla deneme varsa reddet
  if (recentAttempts.length >= MAX_ATTEMPTS) {
    return res.status(429).json({
      error: "Too many login attempts. Please try again later.",
      retryAfter: Math.ceil((WINDOW_MS - (now - recentAttempts[0])) / 1000),
    });
  }
  
  // Deneme sayısını kaydet (login başarısız olursa)
  req.rateLimitRecord = () => {
    recentAttempts.push(now);
    attempts.set(ip, recentAttempts);
  };
  
  // Başarılı login'de temizle
  req.rateLimitClear = () => {
    attempts.delete(ip);
  };
  
  next();
}

