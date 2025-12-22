import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ReactNode } from "react";
import { AppProviders } from "./providers";
import { Navigation } from "@/components/Navigation";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Ormsby Dealer Portal",
  description: "Private distributor/dealer portal for Ormsby Guitars",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans text-white antialiased">
        <AppProviders>
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
            <Navigation />
            <div className="flex-1">{children}</div>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}



