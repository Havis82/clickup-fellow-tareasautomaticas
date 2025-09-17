import axios from "axios";
import { getAccessToken } from "../utils/googleAuth";
import { addCommentToTask } from "./commentService";

// ✅ Cargamos el historyId inicial desde variable de entorno (si existe)
let lastHistoryId: string | null = process.env.GMAIL_LAST_HISTORY_ID || null;

// (Para producción conviene persistir en BBDD/Redis. Aquí usamos memoria + logs)
async function saveHistoryId(id: string) {
  lastHistoryId = id;
}

// Mensaje guía para que lo copies a Render
function adviseUpdateEnv(newId: string, reason: string) {
  console.log(
    `ℹ️ ${reason}. Copia este valor en Render → Environment:\n` +
    `GMAIL_LAST_HISTORY_ID=${newId}`
  );
}

/**
 * Polling de Gmail: busca mensajes nuevos y los enlaza a tareas en ClickUp
 */
export async function pollGmail() {
  const accessToken = await getAccessToken();

  const clickupToken = process.env.CLICKUP_ACCESS_TOKEN!;
  const spaceId = process.env.CLICKUP_SPACE_ID!;
  const threadFieldId = process.env.CLICKUP_THREAD_FIELD_ID!;

  // 1) Inicialización segura del historyId
  if (!lastHistoryId) {
    const profileRes = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const initialId = profileRes.data.historyId;
    await saveHistoryId(initialId);
    console.log("🔹 Inicializado historyId:", initialId);
    adviseUpdateEnv(initialId, "Inicialización del historyId");
    // Salimos en este tick; a partir del siguiente ya consultará cambios
    return;
  }

  try {
    // 2) Pedir cambios desde el último historyId
    const historyRes = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/history",
      {
        params: {
          startHistoryId: lastHistoryId,
          historyTypes: "messageAdded", // Filtra a mensajes nuevos
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const history = historyRes.data.history || [];
    if (history.length === 0) {
      console.log("⏳ Sin cambios en Gmail");
    }

    for (const h of history) {
      if (!h.messagesAdded) continue;

      for (const m of h.messagesAdded) {
        const msgId = m.message.id;

        // 3) Obtener mensaje completo
        const msgRes = await axios.get(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        const threadId = msgRes.data.threadId;
        const snippet = msgRes.data.snippet;

        // 4) Buscar la tarea con ese threadId en el Space
        const taskId = await findTaskByThreadId(
          threadId,
          spaceId,
          threadFieldId,
          clickupToken
        );

        if (!taskId) {
          console.log(`⚠️ No se encontró tarea para threadId ${threadId}`);
          continue;
        }

        // 5) Añadir el correo como comentario en la tarea
        await addCommentToTask(taskId, snippet, clickupToken);
        console.log(`✅ Comentario añadido en tarea ${taskId}: ${snippet}`);
      }
    }

    // 6) Avanzar el puntero de historyId
    if (historyRes.data.historyId && historyRes.data.historyId !== lastHistoryId) {
      await saveHistoryId(historyRes.data.historyId);
      adviseUpdateEnv(historyRes.data.historyId, "Actualización de historyId tras procesar cambios");
    }
  } catch (err: any) {
    const status = err?.response?.status;
    const message = err?.response?.data?.error?.message;

    if (status === 404) {
      // Gmail indica que el historyId ya no es válido → reset
      const profileRes = await axios.get(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const resetId = profileRes.data.historyId;
      await saveHistoryId(resetId);
      console.warn("⚠️ historyId inválido (404). Reseteado a:", resetId, "| msg:", message);
      adviseUpdateEnv(resetId, "Reset de historyId tras 404");
      return; // No rompemos el loop; el siguiente tick ya irá bien
    }

    console.error("❌ Error en polling Gmail:", err.response?.data || err.message);
  }
}

/**
 * Busca una tarea del Space que tenga el threadId en el campo personalizado.
 */
async function findTaskByThreadId(
  threadId: string,
  spaceId: string,
  threadFieldId: string,
  clickupToken: string
): Promise<string | null> {
  try {
    // 1) Listas del Space
    const listsRes = await axios.get(
      `https://api.clickup.com/api/v2/space/${spaceId}/list`,
      { headers: { Authorization: clickupToken } }
    );
    const lists = listsRes.data.lists;

    // 2) Recorrer tareas por lista
    for (const list of lists) {
      const tasksRes = await axios.get(
        `https://api.clickup.com/api/v2/list/${list.id}/task`,
        { headers: { Authorization: clickupToken } }
      );
      const tasks = tasksRes.data.tasks;

      for (const task of tasks) {
        const match = task.custom_fields?.find(
          (f: any) => f.id === threadFieldId && f.value === threadId
        );
        if (match) return task.id; // id de la tarea encontrada
      }
    }

    return null;
  } catch (err: any) {
    console.error("❌ Error buscando tarea:", err.response?.data || err.message);
    return null;
  }
}


