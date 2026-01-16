# Mobil Test Rehberi

## 🧪 Mobil Test Yöntemleri

### 1. Chrome DevTools (En Hızlı)
1. Chrome'da uygulamayı açın
2. `F12` veya `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac) ile DevTools'u açın
3. `Ctrl+Shift+M` (Windows) / `Cmd+Shift+M` (Mac) ile Device Toolbar'ı açın
4. Üstten cihaz seçin (iPhone, iPad, Android, vb.)
5. Responsive modu test edin

**Özellikler:**
- ✅ Farklı cihaz boyutları
- ✅ Touch simulation
- ✅ Network throttling
- ✅ Hızlı test

### 2. Gerçek Mobil Cihaz (En Doğru)
1. **Local Network Test:**
   - Bilgisayarınız ve telefon aynı WiFi'de olmalı
   - Bilgisayarınızın IP adresini bulun:
     - Windows: `ipconfig` → IPv4 Address
     - Mac/Linux: `ifconfig` veya `ip addr`
   - Telefonda tarayıcıda açın: `http://[IP_ADRESI]:5173`
   - Örnek: `http://192.168.1.100:5173`

2. **Deploy Edilmiş Ortam:**
   - Vercel'de deploy edilmiş URL'i telefonunuzda açın
   - Örnek: `https://your-app.vercel.app`

### 3. ngrok (Local'i Dışarı Açma)
1. ngrok kurun: `npm install -g ngrok`
2. Frontend'i başlatın: `cd frontend && npm run dev`
3. ngrok'u başlatın: `ngrok http 5173`
4. ngrok'un verdiği URL'i telefonunuzda açın
5. ✅ HTTPS desteği (fotoğraf çekme için gerekli)

### 4. Vercel Preview (Deploy Sonrası)
1. Git'e push yapın
2. Vercel otomatik preview URL oluşturur
3. Preview URL'i telefonunuzda açın
4. ✅ Gerçek production ortamı gibi test

## 📱 Test Edilmesi Gerekenler

### Modal Scroll Testi
- [ ] Modal açıldığında içerik scroll edilebiliyor mu?
- [ ] Alttaki butonlara erişilebiliyor mu?
- [ ] Modal ortalanmış mı?
- [ ] Uzun içerikte scroll çalışıyor mu?

### Fotoğraf Yükleme Testi
- [ ] "Upload photo" butonuna tıklanabiliyor mu?
- [ ] Kamera açılıyor mu?
- [ ] Fotoğraf seçildikten sonra preview görünüyor mu?
- [ ] Fotoğraf boyutu ve adı gösteriliyor mu?

### Responsive Test
- [ ] iPhone (375px, 390px, 414px)
- [ ] Android (360px, 412px)
- [ ] Tablet (768px, 1024px)

## 🔧 Sorun Giderme

### Modal Scroll Çalışmıyorsa
1. Tarayıcı cache'ini temizleyin
2. Hard refresh: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
3. Vercel'de yeni deploy yapın (cache sorunları için)

### Fotoğraf Yüklenmiyorsa
1. HTTPS kullanıldığından emin olun (kamera için gerekli)
2. Tarayıcı izinlerini kontrol edin
3. Farklı tarayıcı deneyin (Chrome, Safari, Firefox)

### Deploy Sonrası Değişiklikler Görünmüyorsa
1. Vercel'de build log'ları kontrol edin
2. Browser cache'ini temizleyin
3. Service Worker'ı güncelleyin (PWA için)

## 🚀 Hızlı Test Komutları

```bash
# Local development
cd frontend
npm run dev

# Build test
npm run build
npm run preview

# ngrok ile dışarı açma
ngrok http 5173
```
