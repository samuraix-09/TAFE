import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

const source = process.argv[2] || "desktop-release";
const root = "dist/downloads/windows";
const chunkSize = 16 * 1024 * 1024;
const files = {};

for (const [kind, suffix] of [
  ["setup", "Setup"],
  ["portable", "Portable"],
]) {
  const filename = `TAFE-Windows-x64-${suffix}.exe`;
  const data = await readFile(join(source, filename));
  if (data.length < chunkSize || data.toString("ascii", 0, 2) !== "MZ") {
    throw new Error(`Invalid Windows executable: ${filename}`);
  }
  const sha256 = createHash("sha256").update(data).digest("hex");
  const folder = `${kind}-${sha256.slice(0, 16)}`;
  await mkdir(join(root, folder), { recursive: true });
  let parts = 0;
  for (let offset = 0; offset < data.length; offset += chunkSize) {
    await writeFile(
      join(root, folder, `${parts++}.bin`),
      data.subarray(offset, offset + chunkSize),
    );
  }
  files[kind] = { filename, folder, parts, bytes: data.length, sha256 };
}
await writeFile(join(root, "manifest.json"), JSON.stringify(files));
