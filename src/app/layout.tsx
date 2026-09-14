import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clauseora — Evidence-First Legal Document Navigator",
  description:
    "Understand contracts in plain language with source-linked evidence. Clauseora connects every AI explanation to the exact passage in your document.",
  keywords: [
    "legal document",
    "contract review",
    "clause analysis",
    "legal AI",
    "document navigator",
  ],
  openGraph: {
    title: "Clauseora — Evidence-First Legal Document Navigator",
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
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
      </head>
      <body>{children}</body>
    </html>
  );
}
