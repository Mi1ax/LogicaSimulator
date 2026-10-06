/**
 * Generates a collision-resistant unique id, e.g. `node-3f2b...`.
 *
 * The previous `Date.now()-random(0..999)` scheme could collide when several
 * entities were created in the same millisecond (e.g. splitting a wire).
 */
export const generateId = (prefix: string): string => {
  const uuid =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      // Fallback for non-secure contexts (plain-HTTP LAN access) where randomUUID is unavailable.
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
};
