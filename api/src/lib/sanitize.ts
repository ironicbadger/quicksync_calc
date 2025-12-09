/**
 * Validation utilities for user-provided input
 */

/**
 * Validate submitter ID to prevent HTML/XSS injection
 * Rejects input containing HTML-related characters
 *
 * @returns null if valid, error message if invalid
 */
export function validateSubmitterId(input: string | null | undefined): string | null {
  if (!input) return null; // Optional field, null is allowed

  const trimmed = input.trim();

  // Check for empty after trim
  if (!trimmed) return null;

  // Check length (max 50 characters)
  if (trimmed.length > 50) {
    return 'Submitter ID must be 50 characters or less.';
  }

  // Reject HTML-related characters
  if (/[<>"'`]/.test(trimmed)) {
    return 'Submitter ID cannot contain HTML characters (<, >, ", \', `). If you need these characters, please open an issue at https://github.com/ironicbadger/quicksync_calc/issues';
  }

  // Reject other control characters and problematic chars
  if (/[\x00-\x1F\x7F]/.test(trimmed)) {
    return 'Submitter ID contains invalid control characters.';
  }

  return null; // Valid
}

/**
 * Normalize submitter ID (trim whitespace, collapse spaces)
 * Call this AFTER validation passes
 */
export function normalizeSubmitterId(input: string | null | undefined): string | null {
  if (!input) return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // Collapse multiple spaces into single space
  return trimmed.replace(/\s+/g, ' ');
}
