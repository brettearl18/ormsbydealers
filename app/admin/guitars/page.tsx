"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GuitarDoc } from "@/lib/types";
import Link from "next/link";
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";

export default function AdminGuitarsPage() {
  const [guitars, setGuitars] = useState<Array<GuitarDoc & { id: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchGuitars();
  }, []);

  async function fetchGuitars() {
    setLoading(true);
    try {
      const guitarsRef = collection(db, "guitars");
      const snapshot = await getDocs(guitarsRef);
      const guitarsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Array<GuitarDoc & { id: string }>;
      setGuitars(guitarsData);
    } catch (err) {
      console.error("Error fetching guitars:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(guitarId: string) {
    if (!confirm("Are you sure you want to delete this guitar?")) return;

    setDeleting(guitarId);
    try {
      await deleteDoc(doc(db, "guitars", guitarId));
      // Also delete availability and prices if they exist
      await Promise.all([
        deleteDoc(doc(db, "availability", guitarId)).catch(() => {}),
        deleteDoc(doc(db, "prices", guitarId)).catch(() => {}),
      ]);
      setGuitars(guitars.filter((g) => g.id !== guitarId));
    } catch (err) {
      console.error("Error deleting guitar:", err);
      alert("Failed to delete guitar");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">
              Manage Guitars
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Add, edit, or remove guitars from the catalog
            </p>
          </div>
          <Link
            href="/admin/guitars/new"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-black shadow-lg transition-all hover:scale-105 hover:bg-accent-soft hover:shadow-xl hover:shadow-accent/30"
          >
            <PlusIcon className="h-5 w-5" />
            Add Guitar
          </Link>
        </div>

        {/* Guitars Table */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-neutral-400">Loading guitars...</p>
          </div>
        ) : guitars.length === 0 ? (
          <div className="glass-strong rounded-3xl p-12 text-center">
            <p className="text-neutral-400">No guitars found</p>
            <Link
              href="/admin/guitars/new"
              className="mt-4 inline-block text-accent hover:text-accent-soft"
            >
              Add your first guitar →
            </Link>
          </div>
        ) : (
          <div className="glass-strong rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      SKU
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Name
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Series
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-neutral-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {guitars.map((guitar) => (
                    <tr
                      key={guitar.id}
                      className="transition hover:bg-white/5"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-white">
                        {guitar.sku}
                      </td>
                      <td className="px-6 py-4 text-sm text-white">
                        {guitar.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-neutral-400">
                        {guitar.series}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            guitar.status === "ACTIVE"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-neutral-500/20 text-neutral-400"
                          }`}
                        >
                          {guitar.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/guitars/${guitar.id}/preview`}
                            className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
                            title="Preview"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </Link>
                          <Link
                            href={`/admin/guitars/${guitar.id}/edit`}
                            className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
                            title="Edit"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(guitar.id)}
                            disabled={deleting === guitar.id}
                            className="rounded-lg border border-red-500/20 p-2 text-red-400 transition hover:border-red-500/40 hover:bg-red-500/10 disabled:opacity-50"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </AdminGuard>
  );
}

