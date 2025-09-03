import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";

export default function MobileAccess() {
  const [showQR, setShowQR] = useState(true);
  const [installEvent, setInstallEvent] = useState(null);

  const baseUrl = useMemo(() => window.location.origin, []);
  const driverUrl = `${baseUrl}/driver`;      // sürücü ana ekranı
  const iphoneUrl = driverUrl;                // iOS için de https link

  // PWA install prompt (Android/Chrome)
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function share(url) {
    try {
      if (navigator.share) await navigator.share({ title: "MagicSell Driver", url });
      else await navigator.clipboard.writeText(url);
      alert("Link ready to share / copied ✅");
    } catch {}
  }

  async function copy(url) {
    try { await navigator.clipboard.writeText(url); alert("Copied ✅"); } catch {}
  }

  async function install() {
    try {
      if (installEvent) {
        installEvent.prompt();
        setInstallEvent(null);
      } else {
        alert("On iPhone: Share → Add to Home Screen\nOn Android: Chrome menu → Install app");
      }
    } catch {}
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-semibold">Driver Delivery App</h1>
      <p className="text-slate-400">Mobile-optimized interface for drivers to track and deliver orders</p>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="text-lg font-medium mb-3">📱 Quick Mobile Access</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowQR((v) => !v)} className="rounded-md bg-sky-600 px-3 py-1.5 text-sm hover:bg-sky-500">Show QR Code</button>
          <button onClick={() => share(driverUrl)} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Share link</button>
          <button onClick={() => copy(iphoneUrl)} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Copy iPhone URL</button>
          <button onClick={() => copy(baseUrl)} className="rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800">Copy base URL</button>
          <button onClick={install} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm hover:bg-emerald-500">
            {installEvent ? "Install app" : "Install instructions"}
          </button>
        </div>

        {showQR && (
          <div className="mt-4 grid place-items-center">
            <div className="bg-white p-3 rounded-xl">
              <QRCode value={driverUrl} size={180} />
            </div>
            <div className="text-xs text-slate-400 mt-2">{driverUrl}</div>
          </div>
        )}
      </div>

      <div className="text-sm text-slate-400">
        <b>iPhone:</b> QR’ı Safari’de aç → Paylaş → <i>Add to Home Screen</i> <br/>
        <b>Android (Chrome):</b> QR’ı aç → Menü → <i>Install app</i>
      </div>
    </div>
  );
}
