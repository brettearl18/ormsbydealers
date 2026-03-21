import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { GuitarDoc } from "@/lib/types";

/**
 * Loads ACTIVE guitars for inline pickers (e.g. add-to-order on order detail).
 *
 * Uses only `where + limit` — no `orderBy` — so no composite Firestore index is required.
 * (A query like `where(status==ACTIVE).orderBy(name)` needs a composite index and fails until deployed.)
 */
export async function fetchActiveGuitarDocsForPicker(
  maxDocs = 120,
): Promise<Array<GuitarDoc & { id: string }>> {
  const snap = await getDocs(
    query(
      collection(db, "guitars"),
      where("status", "==", "ACTIVE"),
      limit(maxDocs),
    ),
  );
  const rows = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as GuitarDoc),
  }));
  rows.sort((a, b) =>
    (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }),
  );
  return rows;
}
