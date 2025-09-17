import axios from "axios";
import { getAccessToken } from "../utils/googleAuth";
import { addCommentToTask } from "./commentService";

let lastHistoryId: string | null = null;

// Esta función se ejecutará periódicamente
export async function pollGmail() {
  try {
    const accessToken = await getAccessToken();

    // Si no tenemos un historyId inicial, obtenerlo de watch (o del perfil de Gmail)
    if (!lastHistoryId) {
      const profileRes = await axios.get(
        "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      lastHistoryId = profileRes.data.historyId;
      console.log("🔹 Inicializado historyId:", lastHistoryId);
      return;
    }

    // Pedir cambios desde el último historyId
    const historyRes = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/history",
      {
        params: { startHistoryId: lastHistoryId },
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

          const msgRes = await axios.get(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          const snippet = msgRes.data.snippet;

          // 👇 Aquí decides cómo mapear un correo a una tarea de ClickUp
          const taskId = "ID_DE_TAREA_DE_CLICKUP"; // pendiente: lógica real
          const clickupToken = process.env.CLICKUP_ACCESS_TOKEN!;

          await addCommentToTask(taskId, snippet, clickupToken);
          console.log(`✅ Comentario añadido a tarea ${taskId}:`, snippet);
        }
      }
    }

    // Actualizar el historyId para la próxima ejecución
    lastHistoryId = historyRes.data.historyId || lastHistoryId;
  } catch (err: any) {
    console.error("❌ Error en polling Gmail:", err.response?.data || err.message);
  }
}
