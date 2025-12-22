import Link from "next/link";
import {
  ShoppingBagIcon,
  CurrencyDollarIcon,
  DocumentCheckIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

export default function LandingPage() {
  const features = [
    {
      icon: ShoppingBagIcon,
      title: "Live Inventory",
      description: "Real-time access to available guitars and stock levels",
    },
    {
      icon: CurrencyDollarIcon,
      title: "Tiered Pricing",
      description: "Automatic pricing based on your account tier and promotions",
    },
    {
      icon: DocumentCheckIcon,
      title: "Easy Ordering",
      description: "Streamlined purchase order submission and tracking",
    },
    {
      icon: LockClosedIcon,
      title: "Secure Access",
      description: "Private portal with role-based access and data protection",
    },
  ];

  return (
    <main className="flex flex-1 flex-col">
      {/* Hero Section - Clean Minimal Design */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-32">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-background" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background to-background" />
        
        {/* Minimal grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <div className="relative z-10 mx-auto w-full max-w-4xl space-y-12 text-center">
          {/* Minimal badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
              <LockClosedIcon className="h-3 w-3 text-neutral-400" />
              <span className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                Private Portal
              </span>
            </div>
          </div>

          {/* Clean headline */}
          <div className="space-y-6">
            <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl md:text-7xl lg:text-8xl">
              Ormsby Guitars
              <br />
              <span className="text-accent font-semibold">Dealer Portal</span>
            </h1>
            <p className="mx-auto max-w-xl text-base leading-relaxed text-neutral-400 sm:text-lg">
              Access live inventory, exclusive pricing, and streamlined ordering
              for authorized dealers and distributors.
            </p>
          </div>

          {/* Clean CTA buttons */}
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3 text-sm font-medium text-black transition hover:bg-accent-soft"
            >
              Log in to portal
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center rounded-lg border border-white/10 bg-white/5 px-8 py-3 text-sm font-medium text-white backdrop-blur-sm transition hover:border-white/20 hover:bg-white/10"
            >
              Learn more
            </Link>
          </div>

          {/* Minimal trust indicator */}
          <p className="text-xs text-neutral-500">
            Authorized dealers only
          </p>
        </div>
      </section>

      {/* Features Section - Clean Minimal */}
      <section
        id="features"
        className="relative border-t border-white/5 bg-background px-6 py-32"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mb-20 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
              Everything you need
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-neutral-400">
              A comprehensive portal designed for professional dealers and distributors
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group space-y-4 rounded-lg border border-white/5 bg-white/5 p-6 transition hover:border-white/10 hover:bg-white/10"
                >
                  <div className="inline-flex rounded-lg bg-accent/10 p-3 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-medium text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="border-t border-white/5 bg-background px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="text-center sm:text-left">
              <p className="text-sm font-medium text-white">Ormsby Guitars</p>
              <p className="mt-1 text-xs text-neutral-500">
                © {new Date().getFullYear()} All rights reserved.
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-neutral-500">
              <a
                href="mailto:dealers@ormsbyguitars.com"
                className="transition hover:text-neutral-400"
              >
                Contact
              </a>
              <span>•</span>
              <span>Private Access Only</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}



