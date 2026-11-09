import { useState } from "react";
import { Download, Monitor } from "lucide-react";
import { t } from "./i18n";

type Kind = "setup" | "portable";
type Package = {
  filename: string;
  folder: string;
  parts: number;
  bytes: number;
  sha256: string;
};
const root = "/downloads/windows/";

export function WindowsDownloads() {
  const [busy, setBusy] = useState<Kind | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  async function download(kind: Kind) {
    if (busy) return;
    setBusy(kind);
    setProgress(0);
    setFailed(false);
    try {
      const response = await fetch(root + "manifest.json");
      if (!response.ok) throw Error("Manifest unavailable");
      const entry: Package = (await response.json())[kind];
      const expectedName = `TAFE-Windows-x64-${kind === "setup" ? "Setup" : "Portable"}.exe`;
      if (
        !entry ||
        entry.filename !== expectedName ||
        !new RegExp(`^${kind}-[a-f0-9]{16}$`).test(entry.folder) ||
        !Number.isInteger(entry.parts) ||
        entry.parts < 1 ||
        entry.parts > 20 ||
        !Number.isInteger(entry.bytes) ||
        entry.bytes < 1 ||
        entry.bytes > 250_000_000 ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)
      )
        throw Error("Invalid package");
      const parts: ArrayBuffer[] = [];
      let bytes = 0;
      for (let index = 0; index < entry.parts; index++) {
        const part = await fetch(`${root}${entry.folder}/${index}.bin`);
        if (!part.ok) throw Error("Part unavailable");
        const data = await part.arrayBuffer();
        bytes += data.byteLength;
        if (bytes > entry.bytes) throw Error("Invalid size");
        parts.push(data);
        setProgress(Math.min(99, Math.floor((bytes * 100) / entry.bytes)));
      }
      if (bytes !== entry.bytes) throw Error("Incomplete package");
      const blob = new Blob(parts, { type: "application/octet-stream" });
      const hash = await crypto.subtle.digest(
        "SHA-256",
        await blob.arrayBuffer(),
      );
      const checksum = Array.from(new Uint8Array(hash), (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
      if (checksum !== entry.sha256) throw Error("Invalid checksum");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = entry.filename;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="windows-downloads" id="windows">
      <span className="windows-download-mark">
        <Monitor size={24} aria-hidden="true" />
      </span>
      <div>
        <h2>{t("TAFE Windows uchun")}</h2>
        <p>
          {t(
            "Windows x64 uchun o‘rnatiladigan yoki o‘rnatmasdan ishlaydigan versiyani tanlang.",
          )}
        </p>
        <div className="windows-download-actions">
          <button
            className="primary"
            disabled={!!busy}
            onClick={() => void download("setup")}
          >
            <Download size={16} aria-hidden="true" /> Setup (.exe)
          </button>
          <button disabled={!!busy} onClick={() => void download("portable")}>
            <Download size={16} aria-hidden="true" /> Portable (.exe)
          </button>
        </div>
        {busy && (
          <p role="status">
            {t("Yuklanmoqda…")} {progress}%
          </p>
        )}
        {failed && (
          <p role="alert">
            {t("Yuklab olishda xatolik. Qayta urinib ko‘ring.")}
          </p>
        )}
      </div>
    </section>
  );
}
