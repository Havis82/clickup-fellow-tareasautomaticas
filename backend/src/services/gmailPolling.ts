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

// Extrae texto plano del payload. Prioriza text/plain; si no hay, usa text/html (stripping).
function extractPlainTextFromPayload(payload: any): string {
  if (!payload) return "";

  const mime = (payload.mimeType || "").toLowerCase();
  const bodyData = payload.body?.data;

  // Caso simple: text/plain
  if (mime === "text/plain") {
    return decodeBody(bodyData);
  }

  // Caso HTML: convertir a texto
  if (mime === "text/html") {
    const html = decodeBody(bodyData);
    return stripHtml(html);
  }

  // Multipart: buscar primero text/plain, luego text/html
  const parts = payload.parts || [];
  if (Array.isArray(parts) && parts.length) {
    // 1) text/plain
    for (const p of parts) {
      if (String(p.mimeType).toLowerCase() === "text/plain") {
        return decodeBody(p.body?.data);
      }
    }
    // 2) text/html
    for (const p of parts) {
      if (String(p.mimeType).toLowerCase() === "text/html") {
        return stripHtml(decodeBody(p.body?.data));
      }
    }
    // 3) recursivo por si hay anidación
    for (const p of parts) {
      const v = extractPlainTextFromPayload(p);
      if (v) return v;
    }
  }

  return "";
}

function stripHtml(html: string): string {
  // Quita etiquetas básicas y decodifica entidades más comunes
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
  // Normaliza espacios
  return text.replace(/\s+\n/g, "\n").replace(/\n\s+/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

// Intenta quitar el texto citado típico de respuestas (“El … escribió:”, “On … wrote:” y firmas)
function removeQuotedText(text: string): string {
  if (!text) return text;
  let t = text.replace(/\r/g, "");

  const markers = [
    /\nOn .+ wrote:\n/i,                               // Inglés
    /\nEl .+ escribi[oó]:\n/i,                         // Español
    /\n-+ ?Mensaje original ?-+\n/i,                   // Español
    /\n-+ ?Original Message ?-+\n/i,                   // Inglés
    /\n-+ ?Forwarded message ?-+\n/i,                  // Reenviado
  ];

  let cutIndex = -1;
  for (const rx of markers) {
    const m = rx.exec(t);
    if (m && (cutIndex === -1 || m.index < cutIndex)) cutIndex = m.index;
  }
  if (cutIndex !== -1) t = t.slice(0, cutIndex);

  // Quita firmas estándar que empiezan con "-- "
  const sigIdx = t.indexOf("\n-- ");
  if (sigIdx !== -1) t = t.slice(0, sigIdx);

  return t.trim();
}

// Formatea fecha en español abreviado: "El mié, 17 sept 2025 a las 15:59"
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
  // p.ej. "mié, 17 sept 2025, 15:59"
  let s = dtf.format(new Date(msEpoch));
  s = s.replace(/, /, " a las "); // "mié, 17 sept 2025 a las 15:59"
  // Añade "El " delante y quita puntos en abrevs. ("sept." -> "sept")
  s = "El " + s.replace(/\./g, "");
  return s;
}

// Extrae solo el email de "Nombre <correo@dominio>"
function extractEmail(addr?: string): string {
  if (!addr) return "";
  const m = addr.match(/<([^>]+)>/);
  return (m ? m[1] : addr).trim();
}

/** Formatea TODO el hilo como texto para el comentario */
function formatThreadAsComment(messages: any[]): string {
  // Orden cronológico
  const sorted = [...messages].sort((a, b) => Number(a.internalDate) - Number(b.internalDate));

  const blocks: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const msg = sorted[i];
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

// Busca por threadId en todas las listas del Space
async function findTaskByThreadId(
  threadId: string,
  spaceId: string,
  threadFieldId: string,
  clickupToken: string
): Promise<string | null> {
  const headers = { Authorization: clickupToken };

  const listsRes = await axios.get(
    `https://api.clickup.com/api/v2/space/${spaceId}/list`,
    { headers, params: { archived: false } }
  );
  const lists = listsRes.data?.lists ?? [];

  for (const list of lists) {
    let page = 0;
    while (true) {
      const tasksRes = await axios.get(
        `https://api.clickup.com/api/v2/list/${list.id}/task`,
        {
          headers,
          params: { page, archived: false, include_closed: true },
        }
      );
      const tasks = tasksRes.data?.tasks ?? [];
      if (!tasks.length) break;

      for (const t of tasks) {
        const match = (t.custom_fields ?? []).find(
          (f: any) => f.id === threadFieldId && f.value === threadId
        );
        if (match) return t.id;
      }
      page++;
    }
  }
  return null;
}

// Busca por asunto en tareas recientes de TODO el Space
async function findTaskBySubjectRecentInSpace(
  subject: string,
  spaceId: string,
  clickupToken: string,
  minutesWindow = 120
): Promise<string | null> {
  const headers = { Authorization: clickupToken };
  const normalized = normalizeSubject(subject);
  const now = Date.now();
  const windowMs = minutesWindow * 60 * 1000;

  const listsRes = await axios.get(
    `https://api.clickup.com/api/v2/space/${spaceId}/list`,
    { headers, params: { archived: false } }
  );
  const lists = listsRes.data?.lists ?? [];

  for (const list of lists) {
    let page = 0;
    while (true) {
      const res = await axios.get(
        `https://api.clickup.com/api/v2/list/${list.id}/task`,
        {
          headers,
          params: { page, archived: false, include_closed: true },
        }
      );
      const tasks = res.data?.tasks ?? [];
      if (!tasks.length) break;

      for (const t of tasks) {
        const name = normalizeSubject(t.name || "");
        const created = Number(t.date_created || 0);
        const recent = isFinite(created) && (now - created) <= windowMs;

        if (recent && name === normalized) {
          return t.id;
        }
      }
      page++;
    }
  }
  return null;
}

// Vincula el campo HiloGMail
async function setTaskThreadField(
  taskId: string,
  threadFieldId: string,
  threadId: string,
  clickupToken: string
) {
  await axios.put(
    `https://api.clickup.com/api/v2/task/${taskId}`,
    { custom_fields: [{ id: threadFieldId, value: threadId }] },
    { headers: { Authorization: clickupToken } }
  );
  console.log(`🔗 Campo HiloGMail actualizado en tarea ${taskId} → ${threadId}`);
}

// Crea tarea si no existe
async function createTaskForThread(
  listId: string,
  threadId: string,
  subject: string,
  snippet: string,
  clickupToken: string,
  threadFieldId: string
): Promise<string> {
  const headers = { Authorization: clickupToken };
  const description = [
    `**Origen:** Gmail`,
    `**Hilo (threadId):** \`${threadId}\``,
    `[Abrir en Gmail](${gmailThreadWebUrl(threadId)})`,
    "",
    `**Último mensaje (snippet):**`,
    snippet || "(sin contenido)",
  ].join("\n");

  const body: any = {
    name: subject || "(Sin asunto)",
    description,
    custom_fields: [{ id: threadFieldId, value: threadId }],
  };

  if (process.env.CLICKUP_TASK_STATUS) {
    body.status = process.env.CLICKUP_TASK_STATUS;
  }

  const res = await axios.post(
    `https://api.clickup.com/api/v2/list/${listId}/task`,
    body,
    { headers }
  );
  const taskId = res.data?.id;
  if (!taskId) throw new Error("No se recibió taskId al crear la tarea");
  console.log(`🆕 Tarea creada automáticamente (${taskId}) para threadId ${threadId}`);
  return taskId;
}

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

  // 1) Inicialización segura
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
    // 2) Pedir cambios desde el último historyId
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

        // 3) Obtener mensaje (para extraer threadId, subject y snippet)
        const msgRes = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const threadId = msgRes.data.threadId as string;
        const headersMsg = msgRes.data.payload?.headers as any[] | undefined;
        const subjectRaw = headerValue(headersMsg, "Subject") || "(Sin asunto)";
        const subject = normalizeSubject(subjectRaw);
        const snippet = msgRes.data.snippet as string;

        // 4) Buscar tarea por threadId; si no existe, buscar por asunto reciente en todo el Space
        let taskId = await findTaskByThreadId(threadId, spaceId, threadFieldId, clickupToken);

        if (!taskId) {
          taskId = await findTaskBySubjectRecentInSpace(subject, spaceId, clickupToken, 120);
          if (taskId) {
            await setTaskThreadField(taskId, threadFieldId, threadId, clickupToken);
          }
        }

        // 5) Crear si no existe y está permitido
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

        // 6) 🚀 NUEVO: obtener TODO el hilo y formatearlo bonito
        const threadRes = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { format: "full" },
          }
        );
        const messages = threadRes.data?.messages ?? [];
        const formatted = formatThreadAsComment(messages);

        // 7) Enviar comentario formateado
        await addCommentToTask(taskId, formatted, clickupToken);
        console.log(`✅ Comentario (formateado) añadido en tarea ${taskId} (thread ${threadId})`);
      }
    }

    // 8) Avanzar historyId
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




