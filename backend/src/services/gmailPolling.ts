import axios from "axios";
import { getAccessToken } from "../utils/googleAuth";
import { addCommentToTask } from "./commentService";

/** =========================
 *  Estado / utilidades
 *  ========================= */
let lastHistoryId: string | null = process.env.GMAIL_LAST_HISTORY_ID || null;

function adviseUpdateEnv(newId: string, reason: string) {
  console.log(
    `ℹ️ ${reason}. Copia este valor en Render → Environment:\n` +
    `GMAIL_LAST_HISTORY_ID=${newId}`
  );
}

function headerValue(headers: any[] | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const h = headers.find((x) => x?.name?.toLowerCase() === name.toLowerCase());
  return h?.value;
}

function normalizeSubject(s: string): string {
  return (s || "")
    .replace(/^\s*(re|rv|fw|fwd)\s*:\s*/i, "")
    .trim();
}

function gmailThreadWebUrl(threadId: string, accountIndex = 0) {
  return `https://mail.google.com/mail/u/${accountIndex}/#inbox/${threadId}`;
}

/** =========================
 *  Helpers de cuerpo/fecha Gmail
 *  ========================= */

// Gmail codifica el cuerpo en base64url
function decodeBody(data?: string): string {
  if (!data) return "";
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b64, "base64").toString("utf-8");
}

// Extrae texto plano del payload
function extractPlainTextFromPayload(payload: any): string {
  if (!payload) return "";

  const mime = (payload.mimeType || "").toLowerCase();
  const bodyData = payload.body?.data;

  if (mime === "text/plain") {
    return decodeBody(bodyData);
  }

  if (mime === "text/html") {
    const html = decodeBody(bodyData);
    return stripHtml(html);
  }

  const parts = payload.parts || [];
  if (Array.isArray(parts) && parts.length) {
    for (const p of parts) {
      if (String(p.mimeType).toLowerCase() === "text/plain") {
        return decodeBody(p.body?.data);
      }
    }
    for (const p of parts) {
      if (String(p.mimeType).toLowerCase() === "text/html") {
        return stripHtml(decodeBody(p.body?.data));
      }
    }
    for (const p of parts) {
      const v = extractPlainTextFromPayload(p);
      if (v) return v;
    }
  }

  return "";
}

function stripHtml(html: string): string {
  let text = html.replace(/<style[\s\S]*?<\/style>/gi, "")
                 .replace(/<script[\s\S]*?<\/script>/gi, "")
                 .replace(/<[^>]+>/g, " ");
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
  };
  for (const [k, v] of Object.entries(entities)) {
    text = text.split(k).join(v);
  }
  return text.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

// Quita texto citado típico y líneas con “>”
function removeQuotedText(text: string): string {
  if (!text) return text;
  let t = text.replace(/\r/g, "");

  // Cortamos en marcadores de cita
  const markers = [
    /\nOn .+ wrote:\n/i,
    /\nEl .+ escribi[oó]:\n/i,
    /\n-+ ?Mensaje original ?-+\n/i,
    /\n-+ ?Original Message ?-+\n/i,
    /\n-+ ?Forwarded message ?-+\n/i,
  ];

  let cutIndex = -1;
  for (const rx of markers) {
    const m = rx.exec(t);
    if (m && (cutIndex === -1 || m.index < cutIndex)) cutIndex = m.index;
  }
  if (cutIndex !== -1) t = t.slice(0, cutIndex);

  // Quita firmas
  const sigIdx = t.indexOf("\n-- ");
  if (sigIdx !== -1) t = t.slice(0, sigIdx);

  // Quita líneas que empiezan con ">"
  t = t.split("\n").filter(line => !line.trim().startsWith(">")).join("\n");

  return t.trim();
}

// Formatea fecha en español
function formatDateEsMadrid(msEpoch: number): string {
  const dtf = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  let s = dtf.format(new Date(msEpoch));
  s = s.replace(/, /, " a las ");
  s = "El " + s.replace(/\./g, "");
  return s;
}

function extractEmail(addr?: string): string {
  if (!addr) return "";
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim();
}

/** Formatea TODO el hilo como comentario limpio */
function formatThreadAsComment(messages: any[]): string {
  const sorted = [...messages].sort((a, b) => Number(a.internalDate) - Number(b.internalDate));

  const blocks: string[] = [];
  for (const msg of sorted) {
    const headers = msg.payload?.headers as any[] | undefined;
    const from = extractEmail(headerValue(headers, "From"));
    const to = extractEmail(headerValue(headers, "To"));
    const when = Number(msg.internalDate || 0);
    const whenTxt = formatDateEsMadrid(when);

    const rawBody = extractPlainTextFromPayload(msg.payload);
    const body = removeQuotedText(rawBody);

    const block = [
      whenTxt,
      `De: ${from}`,
      `A: ${to}`,
      body || "(sin contenido)",
    ].join("\n");

    blocks.push(block);
  }

  return blocks.join("\n--------------------------------------\n");
}

/** =========================
 *  ClickUp helpers
 *  ========================= */
// (idéntico a la versión anterior que ya tienes: findTaskByThreadId, findTaskBySubjectRecentInSpace, setTaskThreadField, createTaskForThread)

/** =========================
 *  Polling principal
 *  ========================= */
export async function pollGmail() {
  const accessToken = await getAccessToken();
  const clickupToken = process.env.CLICKUP_ACCESS_TOKEN!;
  const spaceId = process.env.CLICKUP_SPACE_ID!;
  const threadFieldId = process.env.CLICKUP_THREAD_FIELD_ID!;
  const defaultListId = process.env.CLICKUP_DEFAULT_LIST_ID || "";
  const autoCreate = (process.env.AUTO_CREATE_TASKS || "false").toLowerCase() === "true";

  if (!lastHistoryId) {
    const profileRes = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    lastHistoryId = profileRes.data.historyId;
    console.log("🔹 Inicializado historyId:", lastHistoryId);
    adviseUpdateEnv(lastHistoryId, "Inicialización del historyId");
    return;
  }

  try {
    const historyRes = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/history",
      {
        params: { startHistoryId: lastHistoryId, historyTypes: "messageAdded" },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const history = historyRes.data.history || [];
    if (!history.length) console.log("⏳ Sin cambios en Gmail");

    for (const h of history) {
      if (!h.messagesAdded) continue;

      for (const m of h.messagesAdded) {
        const msgId = m.message.id;

        const msgRes = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const threadId = msgRes.data.threadId as string;
        const headersMsg = msgRes.data.payload?.headers as any[] | undefined;
        const subjectRaw = headerValue(headersMsg, "Subject") || "(Sin asunto)";
        const subject = normalizeSubject(subjectRaw);
        const snippet = msgRes.data.snippet as string;

        let taskId = await findTaskByThreadId(threadId, spaceId, threadFieldId, clickupToken);

        if (!taskId) {
          taskId = await findTaskBySubjectRecentInSpace(subject, spaceId, clickupToken, 120);
          if (taskId) {
            await setTaskThreadField(taskId, threadFieldId, threadId, clickupToken);
          }
        }

        if (!taskId && autoCreate && defaultListId) {
          taskId = await createTaskForThread(
            defaultListId,
            threadId,
            subjectRaw,
            snippet,
            clickupToken,
            threadFieldId
          );
        }

        if (!taskId) {
          console.log(`⚠️ No se encontró/creó tarea para threadId ${threadId}`);
          continue;
        }

        const threadRes = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { format: "full" },
          }
        );
        const messages = threadRes.data?.messages ?? [];
        const formatted = formatThreadAsComment(messages);

        await addCommentToTask(taskId, formatted, clickupToken);
        console.log(`✅ Comentario limpio añadido en tarea ${taskId} (thread ${threadId})`);
      }
    }

    if (historyRes.data.historyId && historyRes.data.historyId !== lastHistoryId) {
      lastHistoryId = historyRes.data.historyId;
      adviseUpdateEnv(lastHistoryId, "Actualización de historyId tras procesar cambios");
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const message = err?.response?.data?.error?.message;
    if (status === 404) {
      const profileRes = await axios.get(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      lastHistoryId = profileRes.data.historyId;
      console.warn("⚠️ historyId inválido (404). Reseteado a:", lastHistoryId, "| msg:", message);
      adviseUpdateEnv(lastHistoryId, "Reset de historyId tras 404");
      return;
    }
    console.error("❌ Error en polling Gmail:", err.response?.data || err.message);
  }
}





