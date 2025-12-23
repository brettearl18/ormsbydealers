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
      <main className="flex flex-1 flex-col gap-6 px-4 md:px-0">
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

        {/* Guitars Grid */}
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
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {guitars.map((guitar) => (
              <div
                key={guitar.id}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-accent/30 hover:bg-white/10 hover:shadow-xl"
              >
                {/* Image */}
                <div className="relative aspect-[9/16] w-full overflow-hidden bg-neutral-900 sm:aspect-[4/3]">
                  {guitar.images && guitar.images.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={guitar.images[0]}
                      alt={guitar.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-600">
                      No image
                    </div>
                  )}
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 left-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm ${
                        guitar.status === "ACTIVE"
                          ? "bg-green-500/90 text-white"
                          : "bg-neutral-500/90 text-white"
                      }`}
                    >
                      {guitar.status}
                    </span>
                  </div>

                  {/* Action Buttons Overlay */}
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <Link
                      href={`/admin/guitars/${guitar.id}/preview`}
                      className="rounded-lg border border-white/20 bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
                      title="Preview"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EyeIcon className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/admin/guitars/${guitar.id}/edit`}
                      className="rounded-lg border border-white/20 bg-black/50 p-2 text-white backdrop-blur-sm transition hover:bg-black/70"
                      title="Edit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(guitar.id);
                      }}
                      disabled={deleting === guitar.id}
                      className="rounded-lg border border-red-500/50 bg-red-500/50 p-2 text-white backdrop-blur-sm transition hover:bg-red-500/70 disabled:opacity-50"
                      title="Delete"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Guitar Info */}
                <div className="p-4">
                  <div className="mb-1">
                    <h3 className="font-semibold text-white group-hover:text-accent transition-colors">
                      {guitar.name}
                    </h3>
                    <p className="mt-1 text-xs text-neutral-400">{guitar.series}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                    <p className="text-xs font-mono text-neutral-500">{guitar.sku}</p>
                    <Link
                      href={`/admin/guitars/${guitar.id}/edit`}
                      className="text-xs text-accent hover:text-accent-soft"
                    >
                      Edit →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </AdminGuard>
  );
}

