import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "./components/SmoothScroll";

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
  title: "Clauseora — Evidence-First Legal Intelligence",
  description:
    "Understand contracts in plain language with source-linked evidence. Clauseora connects every AI explanation to the exact passage in your document.",
  keywords: [
    "legal document",
    "contract review",
    "clause analysis",
    "legal AI",
    "evidence verification",
    "document navigator",
  ],
  openGraph: {
    title: "Clauseora — Evidence-First Legal Intelligence",
    description:
      "Understand the words. Verify the evidence. AI-powered contract analysis with source-linked explanations.",
    type: "website",
  },
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
