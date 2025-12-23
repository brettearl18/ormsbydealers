export function Footer() {
  return (
    <footer className="mt-8 border-t border-white/5 bg-background/80 px-6 py-6 text-xs text-neutral-500">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="font-medium text-white/90 text-[11px]">Ormsby Guitars</p>
          <p className="mt-0.5 text-[10px] text-neutral-500">
            © {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-neutral-500">
          <a
            href="mailto:dealers@ormsbyguitars.com"
            className="transition hover:text-neutral-300"
          >
            Contact
          </a>
          <span>•</span>
          <span>Authorized dealer access only</span>
        </div>
      </div>
    </footer>
  );
}



