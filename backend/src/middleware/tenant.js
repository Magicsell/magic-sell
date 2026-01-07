/**
 * Tenant Middleware
 * Tüm query'lere otomatik olarak organizationId filtresi ekler
 * 
 * Kullanım: app.use(tenantMiddleware) - tüm route'lardan önce
 */

export function tenantMiddleware(req, res, next) {
  // Eğer user authenticate olmuşsa, organizationId'yi req'e ekle
  if (req.user && req.user.organizationId) {
    req.organizationId = req.user.organizationId;
  }
  
  // Eğer query'de organizationId varsa, onu kullan (admin override için)
  // Ama güvenlik için sadece admin role'ü başka org'ları görebilir
  if (req.query.organizationId && req.user?.role === "admin") {
    req.organizationId = req.query.organizationId;
  }
  
  next();
}

/**
 * Query helper: Tüm query'lere organizationId ekle
 */
export function addTenantFilter(query, organizationId) {
  if (!organizationId) return query;
  
  return {
    ...query,
    organizationId: organizationId,
  };
}

