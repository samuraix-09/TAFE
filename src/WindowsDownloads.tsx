import { useEffect, useState } from "react";
import { Download, Monitor } from "lucide-react";
import { t } from "./i18n";

type Package = {
  filename: string;
  folder: string;
  parts: number;
  bytes: number;
  sha256: string;
};
const root = "/downloads/windows/";

export function WindowsDownloads() {
  const [entry, setEntry] = useState<Package | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const request = new AbortController();
    async function loadSetup() {
      try {
        const result = await fetch(root + "manifest.json", {
          signal: request.signal,
        });
        if (!result.ok) return;
        const { setup } = await result.json();
        if (
          setup?.filename === "TAFE-Windows-x64-Setup.exe" &&
          /^setup-[a-f0-9]{16}$/.test(setup.folder) &&
          Number.isInteger(setup.parts) &&
          setup.parts >= 1 &&
          setup.parts <= 20 &&
          Number.isInteger(setup.bytes) &&
          setup.bytes >= 1 &&
          setup.bytes <= 250_000_000 &&
          /^[a-f0-9]{64}$/.test(setup.sha256) &&
          !request.signal.aborted
        )
          setEntry(setup);
      } catch {
        // The installer can be published independently of the web build.
      } finally {
        if (!request.signal.aborted) setLoaded(true);
      }
    }
    void loadSetup();
    return () => request.abort();
  }, []);

  async function download() {
    if (busy || !entry) return;
    setBusy(true);
    setProgress(0);
    setFailed(false);
    try {
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
      setBusy(false);
    }
  }

  return (
    <section className="windows-downloads" id="windows">
      <span className="windows-download-mark">
        <Monitor size={24} aria-hidden="true" />
      </span>
      <div>
        <h2>{t("TAFE Windows uchun")}</h2>
        {entry ? (
          <div className="windows-download-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={() => void download()}
            >
              <Download size={16} aria-hidden="true" /> Setup (.exe)
            </button>
          </div>
        ) : (
          <p className="muted" role="status">
            {loaded
              ? t("Windows o‘rnatish fayli hozir saytda mavjud emas.")
              : t("Yuklanmoqda…")}
          </p>
        )}
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
