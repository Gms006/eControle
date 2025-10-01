import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn - combina classes utilitárias com merge inteligente de Tailwind
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}