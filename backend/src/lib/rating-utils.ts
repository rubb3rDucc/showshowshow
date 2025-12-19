/**
 * Normalize rating to just the code (e.g., "PG", "TV-MA", "TV-14", "R")
 * Strips any extra text or formatting
 * Handles formats like:
 * - "PG-13 – TEENS 13 OR OLDER" -> "PG-13"
 * - "R – 17+ (VIOLENCE & PROFANITY)" -> "R"
 * - "TV-14" -> "TV-14"
 */
export function normalizeRating(rating: string | null | undefined): string | null {
  if (!rating) return null;
  
  // Remove any extra whitespace
  const trimmed = rating.trim();
  
  // First, try to match at the start of the string (most common case)
  // Match patterns like: "PG-13", "R", "TV-14", "NC-17", etc.
  const startMatch = trimmed.match(/^(TV-)?(Y7?|G|PG|PG-13|14|MA|R|NC-17)(?:\s|–|-|$)/i);
  if (startMatch) {
    const tvPrefix = startMatch[1] || '';
    const code = startMatch[2] || '';
    if (tvPrefix) {
      return `TV-${code.toUpperCase()}`;
    } else {
      return code.toUpperCase();
    }
  }
  
  // If no match at start, try to find the rating code anywhere in the string
  const anywhereMatch = trimmed.match(/(TV-)?(Y7?|G|PG|PG-13|14|MA|R|NC-17)/i);
  if (anywhereMatch) {
    const tvPrefix = anywhereMatch[1] || '';
    const code = anywhereMatch[2] || '';
    if (tvPrefix) {
      return `TV-${code.toUpperCase()}`;
    } else {
      return code.toUpperCase();
    }
  }
  
  // If we can't parse it, return null (don't show invalid ratings)
  return null;
}

