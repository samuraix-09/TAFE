import { useEffect, useState } from "react";
import { db } from "./db";
import { t } from "./i18n";
import { checked, Feedback, useAction } from "./platform";

const bucket = () => db.storage.from("tafe-backgrounds");
const path = (userId: string) => userId + "/background";

export async function signedCoinBackground(userId: string) {
  const result = await bucket().createSignedUrl(path(userId), 3600);
  return result.data?.signedUrl ?? null;
}

export function CoinBackground({
  userId,
  current,
  onChange,
}: {
  userId: string;
  current: string | null;
  onChange: (value: string | null) => void;
}) {
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const action = useAction();

  useEffect(() => {
    if (!file) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const displayed = preview || current;
  return (
    <section className="coin-background-editor">
      {displayed && <img src={displayed} alt={t("Fon rasmi")} />}
      <label>
        {t("Fon rasmini tanlash")}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={action.busy}
          onChange={(event) => {
            const next = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            action.clear();
            setFile(next);
          }}
        />
      </label>
      <p className="muted">JPG, PNG, WebP · 3 MB</p>
      <Feedback error={action.error} notice={action.notice} />
      <div className="button-row">
        <button
          className="primary"
          disabled={!file || action.busy}
          onClick={() =>
            void action.run(async () => {
              if (!file) return;
              if (
                !["image/jpeg", "image/png", "image/webp"].includes(
                  file.type,
                ) ||
                file.size > 3 * 1024 * 1024
              )
                throw Error(
                  t("JPG, PNG yoki WebP faylini tanlang. Maksimal hajm 3 MB."),
                );
              checked(
                await bucket().upload(path(userId), file, {
                  upsert: true,
                  contentType: file.type,
                  cacheControl: "60",
                }),
              );
              const url = await signedCoinBackground(userId);
              if (!url) throw Error(t("Fon rasmini ochib bo‘lmadi."));
              onChange(url);
              setFile(undefined);
            })
          }
        >
          {t("Fon rasmini saqlash")}
        </button>
        {current && (
          <button
            disabled={action.busy}
            onClick={() =>
              void action.run(async () => {
                checked(await bucket().remove([path(userId)]));
                onChange(null);
                setFile(undefined);
              })
            }
          >
            {t("Fon rasmini olib tashlash")}
          </button>
        )}
      </div>
    </section>
  );
}
