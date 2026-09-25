/** Compare every position, including sparse positions, without allocating copies. */
export function arraysEqual<T>(
  left: readonly T[], right: readonly T[], equal: (left: T, right: T) => boolean
): boolean {
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!equal(left[index], right[index])) return false;
  }
  return true;
}

export function scalarArraysEqual<T extends string | number>(left: readonly T[], right: readonly T[]): boolean {
  return arraysEqual(left, right, (a, b) => a === b);
}
