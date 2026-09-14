import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sampleKey = searchParams.get("id");

  if (!sampleKey || !SAMPLE_FILES[sampleKey]) {
    return NextResponse.json(
      { error: "Sample not found. Valid options: mutual-nda, services-agreement-v1, services-agreement-v2, residential-lease" },
      { status: 404 }
    );
  }

  const sampleMeta = SAMPLE_FILES[sampleKey];
  const filePath = path.resolve(process.cwd(), "tests", "fixtures", sampleMeta.filename);

  try {
    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": sampleMeta.mimeType,
        "Content-Disposition": `attachment; filename="${sampleMeta.filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not load sample fixture: ${(err as Error).message}` },
      { status: 500 }
    );
  }
}
