import express, { Request, Response } from 'express';
import { google } from 'googleapis';
import { addCommentToTask } from '../services/commentService';
import axios from "axios";
import { getAccessToken } from "../utils/googleAuth";

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { taskId, body } = req.body;
    const accessToken = process.env.CLICKUP_ACCESS_TOKEN;
    if (!accessToken) throw new Error("Falta CLICKUP_ACCESS_TOKEN");
    await addCommentToTask(taskId, body, accessToken);
    res.status(200).send('Comentario añadido');
  } catch (error) {
    console.error('Error en webhook:', error);
    res.status(500).send('Error al procesar el webhook');
  }
});

router.post("/gmail", async (req: Request, res: Response) => {
  try {
    // 1. Google Pub/Sub manda un mensaje codificado en base64
    const message = req.body.message?.data;
    if (!message) {
      return res.status(400).json({ error: "No message in webhook" });
    }

    const decoded = Buffer.from(message, "base64").toString("utf8");
    const notification = JSON.parse(decoded);

    console.log("📩 Notificación de Gmail:", notification);

    // 2. Sacar threadId
    const threadId = notification.threadId;

    // 3. Obtener el hilo desde Gmail
    const accessToken = await getAccessToken();
    const gmailThread = await axios.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    // 4. Adjuntar el último mensaje como comentario en ClickUp
    const lastMessage = gmailThread.data.messages.pop();
    const plainText = Buffer.from(
      lastMessage.payload.parts[0].body.data,
      "base64"
    ).toString("utf8");

    await axios.post(
      `https://api.clickup.com/api/v2/task/{TASK_ID}/comment`,
      { comment_text: plainText },
      { headers: { Authorization: process.env.CLICKUP_API_TOKEN } }
    );

    res.status(200).send("OK");
  } catch (error: any) {
    console.error("❌ Error webhook:", error.response?.data || error.message);
    res.status(500).json({ error: "Error en webhook" });
  }
});

export default router;
