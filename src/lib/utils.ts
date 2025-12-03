import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extracts error message from various error types
 * Handles: Error objects, Supabase errors, strings, and plain objects
 */
export function getErrorMessage(error: unknown): string {
  // Handle null or undefined
  if (!error) return "Erro desconhecido";

  // Handle Error instances
  if (error instanceof Error) {
    return error.message;
  }

  // Handle Supabase error format: { message: string, code?: string, details?: string }
  if (typeof error === "object") {
    const errorObj = error as Record<string, any>;

    // Try common error message properties
    if (errorObj.message && typeof errorObj.message === "string") {
      return errorObj.message;
    }

    // Supabase error might have it nested
    if (errorObj.error && typeof errorObj.error === "object") {
      const nestedError = errorObj.error as Record<string, any>;
      if (nestedError.message && typeof nestedError.message === "string") {
        return nestedError.message;
      }
    }

    // Fallback: try to stringify
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  // Handle string errors
  if (typeof error === "string") {
    return error;
  }

  // Fallback for any other type
  return String(error);
}
