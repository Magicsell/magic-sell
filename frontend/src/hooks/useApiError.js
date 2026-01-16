import { useCallback } from "react";
import { useToast } from "../components/Toast";

/**
 * Reusable hook for handling API errors and showing toast notifications
 * 
 * @returns {Function} handleApiError - Function to handle API errors
 * 
 * @example
 * const handleApiError = useApiError();
 * 
 * try {
 *   await apiPost('/api/orders', data);
 * } catch (error) {
 *   handleApiError(error);
 * }
 */
export function useApiError() {
  const { showToast } = useToast();

  const handleApiError = useCallback((error, customMessage = null) => {
    console.error("[API Error]:", error);

    let errorMessage = customMessage;

    // If custom message provided, use it
    if (customMessage) {
      showToast(errorMessage, "error");
      return;
    }

    // Try to extract error message from error object
    if (error?.data) {
      // Backend error response
      if (error.data.error) {
        errorMessage = error.data.error;
      } else if (error.data.message) {
        errorMessage = error.data.message;
      } else if (error.data.details && Array.isArray(error.data.details)) {
        errorMessage = error.data.details.join(", ");
      } else if (typeof error.data === "string") {
        errorMessage = error.data;
      }
    } else if (error?.message) {
      // Error object with message
      errorMessage = error.message;
    } else if (typeof error === "string") {
      // Plain string error
      errorMessage = error;
    }

    // Fallback to generic error message
    if (!errorMessage) {
      errorMessage = "An unexpected error occurred. Please try again.";
    }

    // Show toast notification
    showToast(errorMessage, "error", 6000); // 6 seconds for errors
  }, [showToast]);

  return handleApiError;
}
