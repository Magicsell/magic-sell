export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      {/* overlay */}
      <div className="absolute inset-0 bg-black/35 dark:bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-2xl rounded-2xl
                        bg-white text-zinc-900 border border-zinc-200 shadow-2xl
                        dark:bg-slate-900/80 dark:text-slate-100 dark:border-white/10 dark:backdrop-blur">
          <div className="flex items-center justify-between px-5 py-4
                          border-b border-zinc-200 dark:border-white/10
                          bg-gradient-to-r from-indigo-500/10 to-emerald-500/10">
            <h3 className="text-lg font-semibold">{title}</h3>
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-800 dark:text-slate-300 dark:hover:text-white">✕</button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
