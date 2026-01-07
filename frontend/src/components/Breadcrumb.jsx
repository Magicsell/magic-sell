import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export default function Breadcrumb({ items, actionButton }) {
  const location = useLocation();
  
  // Default items: Home > Current page
  const defaultItems = [
    { label: "Dashboard", path: "/admin" },
  ];

  const allItems = defaultItems.concat(items || []);

  return (
    <nav className="flex items-center justify-between mb-6 px-4 h-12 rounded-xl bg-slate-900/60 backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm">
        {allItems.map((item, index) => {
          const isLast = index === allItems.length - 1;
          
          return (
            <div key={index} className="flex items-center gap-2">
              {index === 0 ? (
                <Link
                  to={item.path}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Home className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                  {isLast ? (
                    <span className="text-slate-200 font-medium">{item.label}</span>
                  ) : (
                    <Link
                      to={item.path}
                      className="text-slate-400 hover:text-slate-200 transition-colors"
                    >
                      {item.label}
                    </Link>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      {actionButton && (
        <div className="flex items-center gap-2">
          {actionButton}
        </div>
      )}
    </nav>
  );
}

