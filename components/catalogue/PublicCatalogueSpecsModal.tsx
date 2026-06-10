"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { SpecTable } from "@/components/guitars/SpecTable";
import type { GuitarSpecs } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  specs: Partial<GuitarSpecs>;
}

export function hasCatalogueSpecs(specs: Partial<GuitarSpecs> | undefined): boolean {
  if (!specs) return false;
  return Object.values(specs).some((value) => {
    if (value == null || value === "") return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
}

export function PublicCatalogueSpecsModal({ open, onClose, title, specs }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" aria-hidden />
      <div className="fixed inset-0 flex items-end justify-center sm:items-center sm:p-4">
        <DialogPanel className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-neutral-900 shadow-2xl sm:rounded-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <DialogTitle className="pr-4 text-lg font-semibold text-white">
              {title}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1 text-neutral-400 transition hover:text-white"
              aria-label="Close"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <SpecTable specs={specs} grouped />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
