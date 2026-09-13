/**
 * Mongoose populate replaces `patientId` with the populated object. The API contract keeps
 * `patientId` as a string id and exposes the populated object under a sibling key (`patient`).
 */
export function liftRefs<T extends Record<string, unknown>>(doc: T, map: Record<string, string>): T {
  const out: Record<string, unknown> = { ...doc };
  for (const [from, to] of Object.entries(map)) {
    const v = out[from] as { _id?: unknown } | null | undefined;
    if (v && typeof v === 'object' && v._id !== undefined) {
      out[to] = v;
      out[from] = String(v._id);
    } else if (v && typeof v === 'object' && !('_id' in v)) {
      // populated ref that no longer exists
      out[to] = null;
    }
  }
  return out as T;
}

export function liftAll<T extends Record<string, unknown>>(docs: T[], map: Record<string, string>): T[] {
  return docs.map((d) => liftRefs(d, map));
}
