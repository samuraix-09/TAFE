import { t, getLocale } from "./i18n";
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { db } from "./db";
import {
  checked,
  rpc,
  Empty,
  Feedback,
  useAction,
  useData,
  type Row,
} from "./platform";
export function ChatPage({
  userId,
  initialPrompt = "",
}: {
  userId: string;
  initialPrompt?: string;
}) {
  const conversations = useData(
    async () =>
      checked(
        await db
          .from("ai_conversations")
          .select("*")
          .order("created_at", { ascending: false }),
      ),
    [userId],
  );
  const usage = useData(
    async () => checked(await db.rpc("my_entitlements")),
    [userId],
  );
  const [current, setCurrent] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [draft, setDraft] = useState(initialPrompt),
    [mode, setMode] = useState("ask"),
    [consent, setConsent] = useState(false),
    [context, setContext] = useState(false),
    [menu, setMenu] = useState(false),
    [lastFailed, setLastFailed] = useState("");
  const action = useAction();
  const messages = useData(
    async () =>
      current
        ? checked(
            await db
              .from("ai_messages")
              .select("*")
              .eq("conversation_id", current)
              .order("created_at"),
          )
        : [],
    [current],
  );
  const bottom = useRef<HTMLDivElement>(null),
    input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "nearest",
    });
  }, [messages.data, action.busy]);
  useEffect(() => {
    if (input.current) {
      input.current.style.height = "auto";
      input.current.style.height =
        Math.min(input.current.scrollHeight, 180) + "px";
    }
  }, [draft]);
  async function send(message: string) {
    if (!consent)
      throw Error("Savolni Gemini’ga yuborishga rozilik belgilang.");
    if (!message.trim()) return;
    let conversationId = current;
    if (!conversationId) {
      const c = checked(
        await db
          .from("ai_conversations")
          .insert({ user_id: userId, title: message.slice(0, 100) })
          .select()
          .single(),
      );
      conversationId = c.id;
      setCurrent(c.id);
      conversations.reload();
    }
    setLastFailed(message);
    setDraft("");
    try {
      const response = await db.functions.invoke("tafe-ai", {
        body: {
          locale: getLocale(),
          conversationId,
          requestId: crypto.randomUUID(),
          mode,
          message,
          sendToGemini: true,
          sendLearningContext: context,
        },
      });
      if (response.error) {
        let detail;
        try {
          detail = await response.error.context?.json();
        } catch {}
        throw Error(detail?.error || "AI bilan ulanish xatosi.");
      }
      setLastFailed("");
    } finally {
      messages.reload();
      usage.reload();
      conversations.reload();
    }
  }
  return (
    <div className="chat-layout">
      <div className={menu ? "conversation-panel open" : "conversation-panel"}>
        <button
          className="primary"
          onClick={() => {
            setCurrent(null);
            setMenu(false);
            setDraft("");
            action.clear();
          }}
        >
          <Plus size={16} />
          {t("Yangi suhbat")}
        </button>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label={t("Suhbatlarni qidirish")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("Suhbat qidirish")}
          />
        </label>
        <Feedback error={conversations.error} />
        <div className="conversation-list">
          {conversations.data
            ?.filter((c) =>
              c.title.toLowerCase().includes(search.toLowerCase()),
            )
            .map((c) => (
              <div
                className={
                  current === c.id
                    ? "conversation-item active"
                    : "conversation-item"
                }
                key={c.id}
              >
                <button
                  onClick={() => {
                    setCurrent(c.id);
                    setMenu(false);
                    action.clear();
                    setLastFailed("");
                  }}
                >
                  <MessageSquare size={14} />
                  <span>{c.title}</span>
                </button>
                <button
                  aria-label={t("Suhbat nomini o‘zgartirish")}
                  onClick={() => {
                    const title = prompt(t("Suhbat nomi"), c.title);
                    if (title?.trim())
                      void action.run(async () => {
                        checked(
                          await db
                            .from("ai_conversations")
                            .update({ title: title.trim().slice(0, 160) })
                            .eq("id", c.id),
                        );
                        conversations.reload();
                      }, "");
                  }}
                >
                  <MoreHorizontal size={14} />
                </button>
                <button
                  aria-label={t("Suhbatni o‘chirish")}
                  disabled={action.busy}
                  onClick={() => {
                    if (confirm(t("Suhbat va xabarlarni o‘chirasizmi?")))
                      void action.run(async () => {
                        await rpc("delete_conversation", {
                          conversation: c.id,
                        });
                        if (current === c.id) setCurrent(null);
                        conversations.reload();
                      }, "");
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
        </div>
      </div>
      <div className="chat-main">
        <div className="chat-header">
          <button
            className="conversation-menu"
            aria-label={t("Suhbatlar menyusi")}
            onClick={() => setMenu(!menu)}
          >
            <Menu size={18} />
          </button>
          <Sparkles size={20} />
          <strong>TAFE AI</strong>
          <span className="badge">
            {usage.data?.plan?.name || t("Shaxsiy yordamchi")}
          </span>
        </div>
        <div className="chat-messages">
          <Feedback error={messages.error} loading={messages.loading} />
          {!messages.data?.length && !action.busy && (
            <div className="chat-welcome">
              <span className="ai-mark">
                <Sparkles size={34} />
              </span>
              <h2>{t("Bugun nimani o‘rganamiz?")}</h2>
              <p>
                {t(
                  "Mavzuni tushuning, mashq qiling va tayyorgarligingizni rejalashtiring.",
                )}
              </p>
              <div className="suggestion-grid">
                {[
                  ["explain", "Reading savollaridagi xatolarni tushuntirish"],
                  ["plan", "Bir haftalik tayyorgarlik rejasini tuzish"],
                  ["practice", "Mavzu bo‘yicha yangi mashqlar"],
                  ["analysis", "Natijalarimni tahlil qilish"],
                ].map(([m, t]) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setDraft(t);
                      input.current?.focus();
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.data?.map((m) => (
            <Message key={m.id} message={m} />
          ))}
          {action.busy && (
            <div className="chat-typing">
              <Sparkles size={17} />
              <span>{t("TAFE AI o‘ylamoqda…")}</span>
              <i />
              <i />
              <i />
            </div>
          )}
          <div ref={bottom} />
        </div>
        <div className="chat-composer">
          <Feedback error={action.error || usage.error} />
          {lastFailed && action.error && (
            <button
              className="retry-link"
              disabled={action.busy}
              onClick={() => void action.run(() => send(lastFailed), "")}
            >
              {t("So‘rovni qayta yuborish")}
            </button>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action.run(() => send(draft), "");
            }}
          >
            <div className="composer-top">
              <select
                aria-label={t("AI imkoniyati")}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="ask">{t("Savol berish")}</option>
                <option value="explain">{t("Xatoni tushuntirish")}</option>
                <option value="practice">{t("Mashq yaratish")}</option>
                <option value="plan">{t("O‘quv reja")}</option>
                <option value="analysis">{t("Tahlil")}</option>
              </select>
              <small>
                {usage.data?.daily_ai ?? 0} /{" "}
                {usage.data?.plan?.ai_daily ?? "—"}
                {t(" kunlik so‘rov")}
              </small>
            </div>
            <div className="composer-input">
              <textarea
                ref={input}
                aria-label={t("TAFE AI uchun savol")}
                value={draft}
                maxLength={4000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    if (!action.busy) void action.run(() => send(draft), "");
                  }
                }}
                placeholder={t(
                  "TAFE AI’dan so‘rang… Shift + Enter — yangi qator",
                )}
                disabled={action.busy}
              />
              <button
                className="primary"
                disabled={action.busy || !draft.trim() || !consent}
                aria-label={t("Savolni yuborish")}
              >
                <Send size={18} />
              </button>
            </div>
            <div className="chat-consent">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                {t(
                  "Savolim va shu suhbat tarixini Google Gemini’ga yuborishga roziman.",
                )}
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={context}
                  onChange={(e) => setContext(e.target.checked)}
                />
                {t(
                  "Maqsadlarim, darajam, tarifim va oxirgi test natijalarimdan foydalanilsin.",
                )}
              </label>
            </div>
          </form>
          <small className="chat-disclaimer">
            {t(
              "AI javoblarini o‘quv manbalari bilan tekshiring. Rasmiy test ballari serverda hisoblanadi.",
            )}
          </small>
        </div>
      </div>
    </div>
  );
}
function Message({ message }: { message: Row }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={"chat-message " + message.role}>
      <span className="message-avatar">
        {message.role === "assistant" ? <Sparkles size={16} /> : "S"}
      </span>
      <div className="message-body">
        <small>{message.role === "assistant" ? "TAFE AI" : t("Siz")}</small>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            // Keep generated Markdown from loading tracking pixels or other remote images.
            img: () => null,
            a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
          }}
        >
          {message.content}
        </ReactMarkdown>
        {message.role === "assistant" && (
          <button
            className="copy-answer"
            aria-label={t("Javobni nusxalash")}
            onClick={() => {
              void navigator.clipboard.writeText(message.content).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              });
            }}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
            {copied ? t("Nusxalandi") : t("Nusxalash")}
          </button>
        )}
      </div>
    </div>
  );
}
