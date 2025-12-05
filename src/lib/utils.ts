import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extracts error message from various error types
 * Handles: Error objects, Supabase errors, strings, and plain objects
 * IMPORTANT: Avoids accessing Response objects or triggering body stream reads
 */
export function getErrorMessage(error: unknown): string {
  try {
    // Handle null or undefined
    if (!error) return "Erro desconhecido";

    // Handle Error instances
    if (error instanceof Error) {
      return error.message || "Erro desconhecido";
    }

    // Handle string errors
    if (typeof error === "string") {
      return error;
    }

    // Handle Supabase error format: { message: string, code?: string, details?: string }
    if (typeof error === "object") {
      const errorObj = error as Record<string, any>;

      // Check constructor name without accessing Response properties
      try {
        const constructorName = errorObj?.constructor?.name || "";
        if (constructorName === "Response") {
          return "Erro na comunicação com o servidor";
        }
      } catch {
        // Ignore any errors accessing constructor
      }

      // Try message property first (most common)
      try {
        if (errorObj.message && typeof errorObj.message === "string") {
          return errorObj.message;
        }
      } catch {
        // Ignore access errors
      }

      // Try nested error.error.message (Supabase format)
      try {
        if (
          errorObj.error &&
          typeof errorObj.error === "object" &&
          errorObj.error.message &&
          typeof errorObj.error.message === "string"
        ) {
          return errorObj.error.message;
        }
      } catch {
        // Ignore access errors
      }

      // Try details property (Supabase specific)
      try {
        if (errorObj.details && typeof errorObj.details === "string") {
          return errorObj.details;
        }
      } catch {
        // Ignore access errors
      }

      // Try hint property (PostgreSQL specific)
      try {
        if (errorObj.hint && typeof errorObj.hint === "string") {
          return errorObj.hint;
        }
      } catch {
        // Ignore access errors
      }

      // Try code property (error code)
      try {
        if (errorObj.code && typeof errorObj.code === "string") {
          return errorObj.code;
        }
      } catch {
        // Ignore access errors
      }

      // Try status property
      try {
        if (errorObj.status && typeof errorObj.status === "string") {
          return errorObj.status;
        }
      } catch {
        // Ignore access errors
      }

      // Last resort: return a generic error with object type info
      try {
        const type = typeof errorObj;
        return `Erro do sistema (tipo: ${type})`;
      } catch {
        return "Erro desconhecido";
      }
    }

    // Fallback for any other type
    return "Erro desconhecido";
  } catch {
    // Ultimate fallback if anything goes wrong
    return "Erro desconhecido";
  }
}
