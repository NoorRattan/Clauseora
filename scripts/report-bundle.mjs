import { existsSync, readdirSync, readFileSync } from "node:fs";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { join, relative, resolve } from "node:path";

const chunksDirectory = resolve(process.cwd(), ".next", "static", "chunks");

if (!existsSync(chunksDirectory)) {
  console.error("No production bundle found. Run `npm run build` first.");
  process.exitCode = 1;
} else {
  const files = [];

  function collect(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) collect(entryPath);
      else if (entry.isFile() && entry.name.endsWith(".js")) files.push(entryPath);
    }
  }

  collect(chunksDirectory);

  const entries = files
    .map((filePath) => {
      const contents = readFileSync(filePath);
      return {
        file: relative(chunksDirectory, filePath),
        raw: contents.length,
        gzip: gzipSync(contents).length,
        brotli: brotliCompressSync(contents).length,
      };
    })
    .sort((a, b) => b.raw - a.raw);

  const totals = entries.reduce(
    (sum, entry) => ({
      raw: sum.raw + entry.raw,
      gzip: sum.gzip + entry.gzip,
      brotli: sum.brotli + entry.brotli,
    }),
    { raw: 0, gzip: 0, brotli: 0 },
  );

  const formatBytes = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

  console.log(`JavaScript chunks: ${entries.length}`);
  console.log(`Total raw: ${formatBytes(totals.raw)}`);
  console.log(`Total gzip estimate: ${formatBytes(totals.gzip)}`);
  console.log(`Total Brotli estimate: ${formatBytes(totals.brotli)}`);
  console.log("Largest chunks:");
  for (const entry of entries.slice(0, 10)) {
    console.log(
      `  ${entry.file} — raw ${formatBytes(entry.raw)}, gzip ${formatBytes(entry.gzip)}, Brotli ${formatBytes(entry.brotli)}`,
    );
  }
}
