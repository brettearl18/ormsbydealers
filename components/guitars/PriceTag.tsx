interface Props {
  price: number | null;
  currency: string;
  note?: string | null;
}

export function PriceTag({ price, currency, note }: Props) {
  if (price == null) {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-neutral-500">
          Pricing unavailable
        </p>
        {note && (
          <p className="text-[11px] text-neutral-500/80">{note}</p>
        )}
      </div>
    );
  }

  const formatted = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);

  return (
    <div className="space-y-1">
      <p className="text-lg font-semibold text-white">{formatted}</p>
      {note && (
        <p className="text-[11px] text-neutral-500/80">{note}</p>
      )}
    </div>
  );
}


