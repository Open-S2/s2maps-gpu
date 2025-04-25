/**
 * Check if two objects are equal, with a tolerance for floating point numbers
 * @param a - The first object
 * @param b - The second object
 * @param tolerance - The tolerance for floating point numbers
 * @returns true if the objects are equal
 */
export function deepEqualWithTolerance(a: unknown, b: unknown, tolerance = 1e-6): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) <= tolerance;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqualWithTolerance(v, b[i], tolerance));
  }

  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    return aKeys.every((key) =>
      deepEqualWithTolerance(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        tolerance,
      ),
    );
  }

  return a === b;
}
