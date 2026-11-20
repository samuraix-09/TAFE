import { useEffect, useRef, useState } from "react";
import { db } from "./db";
import { checked, Feedback, signed } from "./platform";

export const ieltsSkills = ["Listening", "Reading", "Writing", "Speaking"];
export const ieltsFormId = "fe816150-8c12-4b3a-b04a-000000000041";

export function IeltsAudio({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void db.storage
      .from("tafe-ielts-audio")
      .createSignedUrl(path, 7200)
      .then((result) => {
        const data = checked(result);
        if (active && data) setUrl(data.signedUrl);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, retry]);
  return (
    <section className="ielts-media">
      <h2>Listening audio</h2>
      <Feedback error={error} loading={!url && !error} />
      {url && (
        <audio
          controls
          preload="metadata"
          src={url}
          onError={() => {
            setUrl("");
            setError("Audio ochilmadi.");
          }}
        />
      )}
      {error && (
        <button
          onClick={() => {
            setError("");
            setRetry(retry + 1);
          }}
        >
          Qayta yuklash
        </button>
      )}
    </section>
  );
}

export function IeltsRecorder({
  attempt,
  question,
  part,
  disabled,
  value,
  onSave,
  onBusy,
}: {
  attempt: string;
  question: string;
  part: number;
  disabled: boolean;
  value?: string;
  onSave: (path: string) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [url, setUrl] = useState("");
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [preparing, setPreparing] = useState(false);
  const active = useRef(true);
  const recorder = useRef<MediaRecorder | null>(null);
  const pending = useRef<Blob | null>(null);
  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      if (recorder.current) {
        recorder.current.onstop = null;
        stop();
        recorder.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);
  useEffect(() => {
    onBusy(status !== "idle");
    return () => onBusy(false);
  }, [status, onBusy]);
  useEffect(() => {
    if (value) {
      let current = true;
      void signed("tafe-ielts-recordings", value)
        .then((src) => {
          if (current && src) setUrl(src);
        })
        .catch((e) => {
          if (current) setError(e.message);
        });
      return () => {
        current = false;
      };
    }
  }, [value]);
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [deadline]);
  useEffect(() => {
    if (deadline && now >= deadline) {
      if (preparing) setPreparing(false);
      else stop();
      setDeadline(0);
    }
  }, [deadline, now, preparing]);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  async function upload(blob: Blob) {
    setStatus("upload");
    setError("");
    try {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) throw Error("Hisobingizga qayta kiring.");
      const ext = blob.type.includes("mp4")
        ? "m4a"
        : blob.type.includes("ogg")
          ? "ogg"
          : "webm";
      const path =
        user.id +
        "/" +
        attempt +
        "/" +
        question +
        "-" +
        crypto.randomUUID() +
        "." +
        ext;
      checked(
        await db.storage
          .from("tafe-ielts-recordings")
          .upload(path, blob, { contentType: blob.type.split(";")[0] }),
      );
      pending.current = null;
      if (active.current) onSave(path);
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "Yozuv saqlanmadi.");
    } finally {
      if (active.current) setStatus("idle");
    }
  }
  async function record() {
    setError("");
    setStatus("permission");
    let stream: MediaStream | undefined;
    try {
      if (
        !navigator.mediaDevices?.getUserMedia ||
        typeof MediaRecorder === "undefined"
      )
        throw Error("Bu brauzer ovoz yozishni qo‘llamaydi.");
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!active.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const session = new MediaRecorder(stream);
      recorder.current = session;
      const pieces: Blob[] = [];
      session.ondataavailable = (e) => {
        if (e.data.size) pieces.push(e.data);
      };
      session.onstop = () => {
        session.stream.getTracks().forEach((track) => track.stop());
        if (!active.current) return;
        setDeadline(0);
        const blob = new Blob(pieces, {
          type: session.mimeType || "audio/webm",
        });
        if (!blob.size) {
          setStatus("idle");
          setError("Yozuv bo‘sh.");
          return;
        }
        pending.current = blob;
        void upload(blob);
      };
      session.start();
      setPreparing(false);
      setNow(Date.now());
      setDeadline(Date.now() + (part === 1 ? 120 : 240) * 1000);
      setStatus("record");
    } catch (e) {
      stream?.getTracks().forEach((track) => track.stop());
      if (active.current) {
        setStatus("idle");
        setError(e instanceof Error ? e.message : "Mikrofonni ochib bo‘lmadi.");
      }
    }
  }
  return (
    <section className="ielts-media">
      <p>
        {
          [
            "Part 1 · Introduction and Interview",
            "Part 2 · Long Turn",
            "Part 3 · Discussion",
          ][part]
        }
      </p>
      {part === 1 && status === "idle" && (
        <button
          disabled={disabled || preparing}
          onClick={() => {
            setPreparing(true);
            setNow(Date.now());
            setDeadline(Date.now() + 60000);
          }}
        >
          1 daqiqa tayyorgarlik
        </button>
      )}
      {deadline > now && (
        <p>
          {preparing ? "Tayyorgarlik" : "Yozuv uchun qolgan vaqt"} ·{" "}
          {Math.ceil((deadline - now) / 1000)} s
        </p>
      )}
      {status === "record" ? (
        <button onClick={stop}>Yozuvni to‘xtatish</button>
      ) : (
        <button
          disabled={disabled || status !== "idle"}
          onClick={() => void record()}
        >
          Ovoz yozishni boshlash
        </button>
      )}
      {pending.current && error && (
        <button
          disabled={disabled}
          onClick={() => void upload(pending.current!)}
        >
          Qayta saqlash
        </button>
      )}
      {url && <audio controls src={url} />}
      <Feedback
        error={error}
        loading={status === "upload" || status === "permission"}
      />
    </section>
  );
}
