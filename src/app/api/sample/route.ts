import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { BoundedTtlCache } from "@/lib/bounded-ttl-cache";

// Allowed synthetic fixture samples
const SAMPLE_FILES: Record<string, { filename: string; mimeType: string }> = {
  "mutual-nda": {
    filename: "mutual-nda.txt",
    mimeType: "text/plain",
  },
  "services-agreement-v1": {
    filename: "services-agreement-v1.txt",
    mimeType: "text/plain",
  },
  "services-agreement-v2": {
    filename: "services-agreement-v2.txt",
    mimeType: "text/plain",
  },
  "residential-lease": {
    filename: "residential-lease.pdf",
    mimeType: "application/pdf",
  },
};

type CachedSample = { buffer: Buffer; etag: string };

// Public synthetic fixtures only. User uploads and analysis results never use
// this cache and remain covered by the no-persistence contract.
const sampleCache = new BoundedTtlCache<string, CachedSample>(
  Object.keys(SAMPLE_FILES).length,
  60 * 60 * 1000,
);

const PUBLIC_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sampleKey = searchParams.get("id");

  if (!sampleKey || !SAMPLE_FILES[sampleKey]) {
    return NextResponse.json(
      { error: "Sample not found." },
      {
        status: 404,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  const sampleMeta = SAMPLE_FILES[sampleKey];
  const filePath = path.resolve(process.cwd(), "tests", "fixtures", sampleMeta.filename);

  try {
    let cached = sampleCache.get(sampleKey);
    if (!cached) {
      const buffer = await fs.readFile(filePath);
      cached = {
        buffer,
        etag: `"${createHash("sha256").update(buffer).digest("base64url")}"`,
      };
      sampleCache.set(sampleKey, cached);
    }

    const responseHeaders = {
      "Content-Type": sampleMeta.mimeType,
      "Content-Disposition": `attachment; filename="${sampleMeta.filename}"`,
      "Cache-Control": PUBLIC_CACHE_CONTROL,
      ETag: cached.etag,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    };

    if (req.headers.get("if-none-match") === cached.etag) {
      return new NextResponse(null, { status: 304, headers: responseHeaders });
    }

    return new NextResponse(new Uint8Array(cached.buffer), {
      headers: {
        ...responseHeaders,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "The requested sample could not be loaded." },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }
}
