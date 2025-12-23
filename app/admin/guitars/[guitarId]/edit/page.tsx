"use client";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { GuitarOptionsManager } from "@/components/admin/GuitarOptionsManager";
import { FormEvent, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GuitarDoc } from "@/lib/types";
import Link from "next/link";
import { ArrowLeftIcon, EyeIcon } from "@heroicons/react/24/outline";

export default function EditGuitarPage({
  params,
}: {
  params: Promise<{ guitarId: string }>;
}) {
  const router = useRouter();
  const { guitarId } = use(params);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [formData, setFormData] = useState<Partial<GuitarDoc>>({
    sku: "",
    name: "",
    series: "",
    run: "",
    etaDelivery: "",
    images: [],
    specs: {
      body: "",
      neck: "",
      neckShape: "",
      fretboard: "",
      fretboardRadius: "",
      fretwire: "",
      inlay: "",
      sideDots: "",
      hardwareColour: "",
      bridgeMachineheads: "",
      electronics: "",
      pickups: "",
      finish: "",
      scale: "",
      other: "",
    },
    status: "ACTIVE",
  });

  useEffect(() => {
    fetchGuitar();
  }, [guitarId]);

  async function fetchGuitar() {
    setLoading(true);
    try {
      const guitarRef = doc(db, "guitars", guitarId);
      const guitarSnap = await getDoc(guitarRef);

      if (!guitarSnap.exists()) {
        setError("Guitar not found");
        setLoading(false);
        return;
      }

      const data = guitarSnap.data() as GuitarDoc;
      // Convert legacy pickups field to bridgePickup/neckPickup if needed
      const specs = data.specs || {};
      if (specs.pickups && !specs.bridgePickup && !specs.neckPickup) {
        specs.bridgePickup = specs.pickups;
      }
      // Convert legacy stringCount number to array if needed
      if (typeof specs.stringCount === "number") {
        specs.stringCount = [specs.stringCount];
      }
      setFormData({ ...data, specs });
    } catch (err) {
      console.error("Error fetching guitar:", err);
      setError("Failed to load guitar");
    } finally {
      setLoading(false);
    }
  }

  async function saveGuitar(redirect: boolean = false) {
    setSubmitting(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Validate required fields
      if (!formData.sku || !formData.name || !formData.series) {
        setError("SKU, Name, and Series are required");
        setSubmitting(false);
        return;
      }

      const guitarData: Omit<GuitarDoc, "createdAt" | "updatedAt"> = {
        sku: formData.sku!,
        name: formData.name!,
        series: formData.series!,
        run: formData.run || undefined,
        etaDelivery: formData.etaDelivery || undefined,
        images: formData.images || [],
        specs: {
          body: formData.specs?.body || "",
          neck: formData.specs?.neck || "",
          neckShape: formData.specs?.neckShape || "",
          fretboard: formData.specs?.fretboard || "",
          fretboardRadius: formData.specs?.fretboardRadius || "",
          fretwire: formData.specs?.fretwire || "",
          inlay: formData.specs?.inlay || "",
          sideDots: formData.specs?.sideDots || "",
          hardwareColour: formData.specs?.hardwareColour || "",
          bridgeMachineheads: formData.specs?.bridgeMachineheads || "",
          electronics: formData.specs?.electronics || "",
          pickups: formData.specs?.pickups || "",
          finish: formData.specs?.finish || "",
          scale: formData.specs?.scale || "",
          other: formData.specs?.other || "",
        },
        options: formData.options || [],
        status: formData.status || "ACTIVE",
      };

      await updateDoc(doc(db, "guitars", guitarId), {
        ...guitarData,
        updatedAt: serverTimestamp(),
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      if (redirect) {
        router.push("/admin/guitars");
      } else {
        setSubmitting(false);
      }
    } catch (err) {
      console.error("Error updating guitar:", err);
      setError("Failed to update guitar");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await saveGuitar(true);
  }

  if (loading) {
    return (
      <AdminGuard>
        <main className="flex flex-1 items-center justify-center">
          <p className="text-sm text-neutral-400">Loading guitar...</p>
        </main>
      </AdminGuard>
    );
  }

  return (
    <AdminGuard>
      <main className="flex flex-1 flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/admin/guitars"
              className="rounded-lg border border-white/10 p-2 text-neutral-400 transition hover:border-white/20 hover:text-white"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Edit Guitar
              </h1>
              <p className="mt-2 text-sm text-neutral-400">
                Update guitar information
              </p>
            </div>
          </div>
          <Link
            href={`/admin/guitars/${guitarId}/preview`}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-white/20 hover:bg-white/10 sm:w-auto w-full"
          >
            <EyeIcon className="h-4 w-4" />
            Preview
          </Link>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="glass-strong rounded-3xl p-4 shadow-xl sm:p-8"
        >
          {error && (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          {saveSuccess && (
            <div className="mb-6 rounded-lg border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm text-green-400">✓ Changes saved successfully!</p>
            </div>
          )}

          <div className="space-y-6">
            {/* Basic Info */}
            <div>
              <h2 className="mb-4 text-base font-semibold text-white sm:text-lg">
                Basic Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    SKU *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="gtr_demo_hype"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Status *
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as "ACTIVE" | "INACTIVE",
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-accent/50 focus:bg-white/10"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Hype GTR 7"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Series *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.series}
                    onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Hype Series"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    Run
                  </label>
                  <input
                    type="text"
                    value={formData.run || ""}
                    onChange={(e) => setFormData({ ...formData, run: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Run information"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    ETA Delivery
                  </label>
                  <input
                    type="text"
                    value={formData.etaDelivery || ""}
                    onChange={(e) => setFormData({ ...formData, etaDelivery: e.target.value })}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="ETA Delivery information"
                  />
                </div>
              </div>
            </div>

            {/* Images */}
            <div>
              <h2 className="mb-4 text-base font-semibold text-white sm:text-lg">
                Images
              </h2>
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-300">
                  Image URLs (one per line)
                </label>
                <textarea
                  value={formData.images?.join("\n") || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      images: e.target.value.split("\n").filter((url) => url.trim()),
                    })
                  }
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                  placeholder="https://example.com/image1.jpg&#10;https://example.com/image2.jpg"
                />
              </div>
            </div>

            {/* Specifications */}
            <div>
              <h2 className="mb-4 text-base font-semibold text-white sm:text-lg">
                Specifications
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    BODY
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.body || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, body: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Body material and construction"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    NECK
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.neck || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, neck: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Neck material"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    NECK SHAPE
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.neckShape || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, neckShape: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Neck shape profile"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    FRETBOARD
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.fretboard || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, fretboard: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Fretboard material"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    FRETBOARD RADIUS
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.fretboardRadius || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, fretboardRadius: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Fretboard radius"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    FRETWIRE
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.fretwire || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, fretwire: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Fretwire type"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    INLAY
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.inlay || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, inlay: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Inlay type"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    SIDE DOTS
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.sideDots || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, sideDots: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Side dot material/color"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    HARDWARE COLOUR
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.hardwareColour || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, hardwareColour: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Hardware color"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    BRIDGE + MACHINEHEADS
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.bridgeMachineheads || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, bridgeMachineheads: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Bridge and machine heads"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    ELECTRONICS
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.electronics || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, electronics: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Electronics configuration"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    PICKUPS
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.pickups || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, pickups: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Pickup configuration"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    FINISH
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.finish || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, finish: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Finish type"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    SCALE
                  </label>
                  <input
                    type="text"
                    value={formData.specs?.scale || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, scale: e.target.value },
                      })
                    }
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Six string: 25.5 - 27.5&quot;, Seven string: 25.5 - 27.8&quot;, Eight string: 25.5 - 28.2&quot;"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-neutral-300">
                    OTHER
                  </label>
                  <textarea
                    value={formData.specs?.other || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specs: { ...formData.specs!, other: e.target.value },
                      })
                    }
                    rows={3}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-accent/50 focus:bg-white/10"
                    placeholder="Additional specifications..."
                  />
                </div>
              </div>
            </div>

            {/* Options */}
            <div>
              <GuitarOptionsManager
                options={formData.options || []}
                onChange={(options) => setFormData({ ...formData, options })}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col-reverse items-stretch gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
              <Link
                href="/admin/guitars"
                className="rounded-lg border border-white/10 px-6 py-3 text-center text-sm font-semibold text-white transition hover:border-white/20"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => saveGuitar(false)}
                disabled={submitting}
                className="rounded-lg border border-accent/50 bg-accent/10 px-6 py-3 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent/20 disabled:opacity-50 sm:min-w-[150px]"
              >
                {submitting ? "Saving..." : "Save & Continue"}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-soft disabled:opacity-50 sm:min-w-[150px]"
              >
                {submitting ? "Saving..." : "Save & Exit"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </AdminGuard>
  );
}

