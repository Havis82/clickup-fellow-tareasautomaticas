import axios from "axios";
import { getAccessToken } from "../utils/googleAuth";
import { addCommentToTask } from "./commentService";

let lastHistoryId: string | null = null;

// TODO: sustituir por persistencia real (BBDD, KV, etc.)
async function loadHistoryId(): Promise<string | null> {
  return lastHistoryId;
}
async function saveHistoryId(id: string) {
  lastHistoryId = id;
}

/**
 * Polling de Gmail: busca mensajes nuevos y los enlaza a tareas en ClickUp
 */
export async function pollGmail() {
  const accessToken = await getAccessToken();
  const clickupToken = process.env.CLICKUP_ACCESS_TOKEN!;
  const spaceId = process.env.CLICKUP_SPACE_ID!;
  const threadFieldId = process.env.CLICKUP_THREAD_FIELD_ID!;

  // 1. Inicializar historyId la primera vez
  if (!lastHistoryId) {
    const profileRes = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    await saveHistoryId(profileRes.data.historyId);
    console.log("🔹 Inicializado historyId:", profileRes.data.historyId);
    return;
  }

  try {
    // 2. Pedir cambios desde el último historyId
    const historyRes = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/history",
      {
        params: {
          startHistoryId: lastHistoryId,
          historyTypes: "messageAdded", // opcional, limita a mensajes añadidos
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const history = historyRes.data.history || [];
    if (history.length === 0) {
      console.log("⏳ Sin cambios en Gmail");
      return;
    }

    for (const h of history) {
      if (h.messagesAdded) {
        for (const m of h.messagesAdded) {
          const msgId = m.message.id;

          // 3. Obtener mensaje completo
          const msgRes = await axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          const threadId = msgRes.data.threadId;
          const snippet = msgRes.data.snippet;

          // 4. Buscar la tarea con ese threadId en el space
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

          // 5. Añadir el correo como comentario en la tarea
          await addCommentToTask(taskId, snippet, clickupToken);
          console.log(`✅ Comentario añadido en tarea ${taskId}: ${snippet}`);
        }
      }
    }

    // 6. Actualizar historyId
    if (historyRes.data.historyId) {
      await saveHistoryId(historyRes.data.historyId);
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
      await saveHistoryId(profileRes.data.historyId);
      console.warn("⚠️ historyId inválido, reseteado a:", profileRes.data.historyId);
      return;
    }
    console.error("❌ Error en polling Gmail:", err.response?.data || err.message);
  }
}

/**
 * Busca una tarea dentro de un space que tenga el threadId en el campo personalizado.
 */
async function findTaskByThreadId(
  threadId: string,
  spaceId: string,
  threadFieldId: string,
  clickupToken: string
): Promise<string | null> {
  try {
    // 1. Obtener todas las listas del space
    const listsRes = await axios.get(
      `https://api.clickup.com/api/v2/space/${spaceId}/list`,
      { headers: { Authorization: clickupToken } }
    );

    const lists = listsRes.data.lists;

    // 2. Recorrer cada lista y buscar tareas
    for (const list of lists) {
      const tasksRes = await axios.get(
        `https://api.clickup.com/api/v2/list/${list.id}/task`,
        { headers: { Authorization: clickupToken } }
      );

      const tasks = tasksRes.data.tasks;

      for (const task of tasks) {
        const match = task.custom_fields.find(
          (f: any) => f.id === threadFieldId && f.value === threadId
        );

        if (match) {
          return task.id; // devuelve el ID de la tarea encontrada
        }
      }
    }

    return null;
  } catch (err: any) {
    console.error("❌ Error buscando tarea:", err.response?.data || err.message);
    return null;
  }
}

