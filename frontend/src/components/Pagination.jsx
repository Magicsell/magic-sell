export default function Pagination({
  page,
  pages,
  pageSize,
  total,
  itemsCount,
  itemLabel = "items",
  onPageChange,
  onPageSizeChange,
  className = "",
}) {
  const startIndex = itemsCount > 0 ? (page - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(page * pageSize, total);

  return (
    <div className={`flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-800/40 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="text-xs text-slate-400">
          Showing {startIndex} - {endIndex} of {total} {itemLabel}
          {pages > 1 && ` • Page ${page} / ${pages}`}
        </div>
        
        {/* Page Size Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Show:</label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1.5 rounded-lg text-sm bg-slate-800/50 text-slate-100 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-transparent"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
          title="First page"
        >
          &laquo;
        </button>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
        >
          Next
        </button>
        <button
          onClick={() => onPageChange(pages)}
          disabled={page >= pages}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
          title="Last page"
        >
          &raquo;
        </button>
      </div>
    </div>
  );
}
