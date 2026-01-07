# Migration Guide: Multi-Tenant Support

## ⚠️ ÖNEMLİ: Yedekleme

Migration'dan ÖNCE:
1. MongoDB Atlas'ta snapshot alın (zaten aldınız ✅)
2. Local'de çalışıyorsanız: `mongodump` ile yedek alın

## Migration Adımları

### 1. Paketleri Yükle
```bash
cd backend
npm install
```

### 2. Migration'ı Çalıştır
```bash
npm run migrate
```

Bu script:
- ✅ Mevcut verileri SİLMEZ
- ✅ Sadece `organizationId` ekler
- ✅ Default organization oluşturur
- ✅ Admin ve driver user'ları oluşturur

### 3. Migration Sonrası Kontrol

Migration başarılı olursa şunları göreceksiniz:
```
✅ Migration completed successfully!
📋 Summary:
   - Organization: Default Organization (default-org)
   - Orders migrated: X
   - Customers migrated: Y
   - ActiveRoutes migrated: Z
   - Admin user: admin@magicsell.com / admin123
   - Driver user: driver@magicsell.com / driver123
```

### 4. Test Et

Migration sonrası:
1. Backend'i başlat: `npm run start`
2. Frontend'den login olmayı dene (şimdilik eski sistem çalışır)
3. Database'de `organizationId` field'larının eklendiğini kontrol et

## Rollback (Geri Alma)

Eğer bir sorun olursa:
1. MongoDB Atlas'tan snapshot restore edin
2. Veya local backup'tan restore edin

## Sonraki Adımlar

Migration başarılı olduktan sonra:
1. ✅ Authentication sistemini JWT'ye geçir
2. ✅ Frontend'i yeni auth sistemine bağla
3. ✅ Tenant middleware ekle (tüm query'lere organizationId filtresi)

## Notlar

- `organizationId` şu an **opsiyonel** (backward compatibility için)
- Eski kod çalışmaya devam edecek
- Yeni kod yazarken `organizationId` kullanacağız
- İleride `organizationId`'yi **required** yapabiliriz

