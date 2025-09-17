import express, { Request, Response } from "express";
import axios from "axios";
import { getAccessToken } from "../utils/googleAuth";

const router = express.Router();

// Listar hilos de Gmail
router.get("/threads", async (_req: Request, res: Response) => {
  try {
    const accessToken = await getAccessToken();

    const response = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/threads",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error obteniendo hilos:", error.response?.data || error.message);
    res.status(500).json({ error: "No se pudieron obtener los hilos de Gmail" });
  }
});

// Obtener un hilo concreto
router.get("/threads/:id", async (req: Request, res: Response) => {
  try {
    const accessToken = await getAccessToken();
    const { id } = req.params;

    const response = await axios.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error obteniendo hilo:", error.response?.data || error.message);
    res.status(500).json({ error: "No se pudo obtener el hilo de Gmail" });
  }
});

export default router;

