export function GuitarCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface/80 shadow-soft">
      <div className="aspect-[4/3] w-full animate-pulse bg-neutral-900" />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="h-3 w-16 animate-pulse rounded bg-neutral-800" />
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-800" />
        <div className="h-3 w-20 animate-pulse rounded bg-neutral-800" />
        <div className="mt-auto flex items-end justify-between gap-3">
          <div className="h-5 w-24 animate-pulse rounded bg-neutral-800" />
          <div className="h-8 w-24 animate-pulse rounded-full bg-neutral-800" />
        </div>
      </div>
    </div>
  );
}

export function CartItemSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl bg-surface/80 p-4 shadow-soft">
      <div className="h-24 w-24 flex-shrink-0 animate-pulse rounded-lg bg-neutral-900" />
      <div className="flex flex-1 flex-col gap-3">
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-800" />
        <div className="h-3 w-20 animate-pulse rounded bg-neutral-800" />
        <div className="flex items-center justify-between">
          <div className="h-8 w-24 animate-pulse rounded bg-neutral-800" />
          <div className="h-4 w-16 animate-pulse rounded bg-neutral-800" />
        </div>
      </div>
    </div>
  );
}


