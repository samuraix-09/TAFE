import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { t } from "./i18n";

function ReadingFallback({ url }: { url: string }) {
  return (
    <div className="reader-file-fallback">
      <p>{t("Hujjatni ochib bo‘lmadi.")}</p>
      <a className="button-link" href={url} target="_blank" rel="noreferrer">
        {t("Alohida oynada ochish / yuklab olish ↗")}
      </a>
    </div>
  );
}

export default function LibraryDocument(props: {
  url: string;
  path: string;
  title: string;
}) {
  if (/\.pdf$/i.test(props.path)) return <PdfDocument {...props} />;
  if (/\.docx$/i.test(props.path)) return <WordDocument url={props.url} />;
  return <ReadingFallback url={props.url} />;
}

function WordDocument({ url }: { url: string }) {
  const [content, setContent] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      import("mammoth"),
      fetch(url, { signal: controller.signal }),
    ])
      .then(async ([mammoth, response]) => {
        if (!response.ok) throw Error("Could not load the document");
        const result = await mammoth.extractRawText({
          arrayBuffer: await response.arrayBuffer(),
        });
        if (!controller.signal.aborted) {
          if (result.value.trim()) setContent(result.value);
          else setFailed(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [url]);
  if (failed) return <ReadingFallback url={url} />;
  return (
    <div className="reader-file-scroll">
      {content ? (
        <article className="reader-word-sheet">{content}</article>
      ) : (
        <p role="status">{t("TAFE yuklanmoqda…")}</p>
      )}
    </div>
  );
}

function PdfDocument({ url, title }: { url: string; title: string }) {
  const [pdf, setPdf] = useState<import("pdfjs-dist").PDFDocumentProxy>();
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = scroll.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.max(0, Math.floor(entry.contentRect.width))),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
    void Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ])
      .then(async ([api, worker]) => {
        if (!active) return;
        api.GlobalWorkerOptions.workerSrc = worker.default;
        task = api.getDocument({ url, isEvalSupported: false });
        const document = await task.promise;
        if (active) setPdf(document);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      void task?.destroy().catch(() => {});
    };
  }, [url]);

  useEffect(() => {
    if (!pdf || !width) return;
    let active = true;
    let render: import("pdfjs-dist").RenderTask | undefined;
    void pdf
      .getPage(page)
      .then(async (sheet) => {
        const element = canvas.current;
        if (!active || !element) return;
        const original = sheet.getViewport({ scale: 1 });
        const scale =
          Math.min(1.45, Math.max(1, width - 32) / original.width) * zoom;
        const viewport = sheet.getViewport({ scale });
        const ratio = Math.min(
          window.devicePixelRatio || 1,
          2,
          4096 / Math.max(viewport.width, viewport.height),
        );
        element.width = Math.max(1, Math.floor(viewport.width * ratio));
        element.height = Math.max(1, Math.floor(viewport.height * ratio));
        element.style.width = `${viewport.width}px`;
        element.style.height = `${viewport.height}px`;
        render = sheet.render({
          canvas: element,
          viewport,
          transform: [ratio, 0, 0, ratio, 0, 0],
        });
        await render.promise;
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      render?.cancel();
    };
  }, [pdf, page, zoom, width]);

  if (failed) return <ReadingFallback url={url} />;
  return (
    <div className="reader-pdf">
      {pdf && (
        <div className="reader-pdf-tools">
          <button
            disabled={page <= 1}
            aria-label={t("← Oldingi")}
            onClick={() => {
              setPage(page - 1);
              scroll.current?.scrollTo(0, 0);
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <output aria-live="polite">
            {page} / {pdf.numPages}
          </output>
          <button
            disabled={page >= pdf.numPages}
            aria-label={t("Keyingi →")}
            onClick={() => {
              setPage(page + 1);
              scroll.current?.scrollTo(0, 0);
            }}
          >
            <ChevronRight size={18} />
          </button>
          <button
            disabled={zoom <= 0.75}
            aria-label={t("Kichraytirish")}
            onClick={() => setZoom(zoom - 0.25)}
          >
            <Minus size={18} />
          </button>
          <button
            disabled={zoom >= 2}
            aria-label={t("Kattalashtirish")}
            onClick={() => setZoom(zoom + 0.25)}
          >
            <Plus size={18} />
          </button>
        </div>
      )}
      <div className="reader-file-scroll" ref={scroll}>
        {!pdf && <p role="status">{t("TAFE yuklanmoqda…")}</p>}
        {pdf && (
          <canvas ref={canvas} role="img" aria-label={`${title} · ${page}`} />
        )}
      </div>
    </div>
  );
}
