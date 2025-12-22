"use client";

import { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { AvailabilityBadge } from "./AvailabilityBadge";
import { PriceTag } from "./PriceTag";
import { useCart } from "@/lib/cart-context";
import Link from "next/link";
import { DealerGuitar } from "@/lib/dealer-guitars";

interface Props {
  guitar: DealerGuitar | null;
  currency: string;
  tierId: string | null;
  priceNote: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function QuickViewModal({
  guitar,
  currency,
  tierId,
  priceNote,
  isOpen,
  onClose,
}: Props) {
  const { addItem } = useCart();

  if (!guitar) return null;

  const onAddToCart = () => {
    if (guitar.price.value == null) return;
    addItem(
      {
        guitarId: guitar.id,
        sku: guitar.sku,
        name: guitar.name,
        imageUrl: guitar.heroImage ?? null,
        unitPrice: guitar.price.value,
        priceSource: guitar.price.source,
      },
      1,
    );
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="relative w-full max-w-4xl transform overflow-hidden rounded-2xl bg-surface/95 p-6 shadow-soft backdrop-blur-xl transition-all">
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 rounded-full p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
                  aria-label="Close"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="aspect-square overflow-hidden rounded-xl bg-neutral-900">
                    {guitar.heroImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={guitar.heroImage}
                        alt={guitar.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-neutral-600">
                        No image
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
                        {guitar.series}
                      </p>
                      <Dialog.Title className="mt-1 text-2xl font-semibold">
                        {guitar.name}
                      </Dialog.Title>
                      <p className="mt-1 text-sm text-neutral-400">
                        SKU: {guitar.sku}
                      </p>
                    </div>

                    <AvailabilityBadge
                      state={guitar.availability.state}
                      etaDate={guitar.availability.etaDate}
                      batchName={guitar.availability.batchName}
                    />

                    <PriceTag
                      price={guitar.price.value}
                      currency={currency}
                      note={priceNote}
                    />

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onAddToCart}
                        disabled={guitar.price.value == null}
                        className="flex-1 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-black shadow-soft transition hover:scale-105 hover:bg-accent-soft disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-400"
                      >
                        Add to cart
                      </button>
                      <Link
                        href={`/dealer/guitars/${guitar.id}`}
                        onClick={onClose}
                        className="rounded-full border border-neutral-800 px-6 py-3 text-sm font-medium text-white transition hover:border-accent hover:text-accent-soft"
                      >
                        View details
                      </Link>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

