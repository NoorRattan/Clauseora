import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "./components/SmoothScroll";

const SITE_URL = "https://clauseora.vercel.app";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Clauseora — Evidence-First Legal Document & Contract Analysis",
  description:
    "AI-powered legal document and contract analysis in plain language, with source-linked evidence for every explanation.",
  keywords: [
    "legal document",
    "contract review",
    "clause analysis",
    "legal AI",
    "evidence verification",
    "document navigator",
  ],
  openGraph: {
    title: "Clauseora — Evidence-First Legal Document & Contract Analysis",
    description:
      "Understand the words. Verify the evidence. AI-powered contract analysis with source-linked explanations.",
    url: SITE_URL,
    type: "website",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetBrainsMono.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </head>
      <body className="bg-obsidian-950 text-slate-100 antialiased selection:bg-amber-500/30 selection:text-amber-200 min-h-screen relative font-sans overflow-x-hidden">
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
