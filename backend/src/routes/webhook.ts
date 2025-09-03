import express from 'express';
import { google } from 'googleapis';
import { addCommentToTask } from '../services/commentService';

const router = express.Router();

router.post('/webhook', async (req, res) => {
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

export default router;
