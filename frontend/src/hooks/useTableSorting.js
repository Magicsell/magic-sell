import { useState, useCallback } from "react";

/**
 * Custom hook for managing table sorting state and generating sort parameters for API calls
 * 
 * @param {Object} options - Configuration options
 * @param {Array} options.defaultSort - Default sorting configuration [{ id: "field", desc: true }]
 * @param {Function} options.onSortChange - Callback function called when sorting changes (for refetching data)
 * @returns {Object} - { sorting, setSorting, getSortParam, handleSortChange }
 * 
 * @example
 * const { sorting, setSorting, getSortParam } = useTableSorting({
 *   defaultSort: [{ id: "orderDate", desc: true }],
 *   onSortChange: (newSorting) => fetchData(newSorting)
 * });
 * 
 * // In fetch function:
 * const params = new URLSearchParams();
 * params.set("sort", getSortParam());
 * 
 * // In table config:
 * const table = useReactTable({
 *   ...
 *   state: { sorting },
 *   onSortingChange: setSorting,
 * });
 */
export function useTableSorting({ defaultSort = [{ id: "createdAt", desc: true }], onSortChange } = {}) {
  const [sorting, setSorting] = useState(defaultSort);

  /**
   * Generate sort parameter string for API calls
   * @param {Array} customSorting - Optional custom sorting array, defaults to current sorting state
   * @returns {string} - Sort parameter string (e.g., "-orderDate" or "orderDate")
   */
  const getSortParam = useCallback((customSorting = null) => {
    const currentSorting = customSorting || sorting;
    
    if (currentSorting && currentSorting.length > 0) {
      const sortField = currentSorting[0].id;
      const sortDir = currentSorting[0].desc ? "-" : "";
      return `${sortDir}${sortField}`;
    }
    
    // Fallback to default sort
    if (defaultSort && defaultSort.length > 0) {
      const defaultField = defaultSort[0].id;
      const defaultDir = defaultSort[0].desc ? "-" : "";
      return `${defaultDir}${defaultField}`;
    }
    
    return "";
  }, [sorting, defaultSort]);

  /**
   * Handle sorting change - updates state and triggers callback
   * @param {Function|Array} updater - React state updater function or new sorting array
   */
  const handleSortChange = useCallback((updater) => {
    setSorting((prevSorting) => {
      const newSorting = typeof updater === "function" ? updater(prevSorting) : updater;
      
      // Trigger callback if provided
      if (onSortChange) {
        // Use setTimeout to ensure state is updated before callback
        setTimeout(() => {
          onSortChange(newSorting);
        }, 0);
      }
      
      return newSorting;
    });
  }, [onSortChange]);

  return {
    sorting,
    setSorting: handleSortChange,
    getSortParam,
  };
}
