import express, { Request, Response } from "express";
import axios from "axios";

const router = express.Router();

/**
 * Ejemplo de endpoint para listar hilos de Gmail.
 * Requiere que el usuario esté autenticado con Google (via auth.ts + Passport).
 */
router.get("/threads", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.accessToken) {
      return res.status(401).json({ error: "Usuario no autenticado con Google" });
    }

    const response = await axios.get(
      "https://gmail.googleapis.com/gmail/v1/users/me/threads",
      {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error obteniendo hilos de Gmail:", error.response?.data || error.message);
    res.status(500).json({ error: "No se pudieron obtener los hilos de Gmail" });
  }
});

/**
 * Ejemplo de endpoint para obtener un hilo concreto por ID
 */
router.get("/threads/:id", async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.accessToken) {
      return res.status(401).json({ error: "Usuario no autenticado con Google" });
    }

    const { id } = req.params;

    const response = await axios.get(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${id}`,
      {
        headers: {
          Authorization: `Bearer ${user.accessToken}`,
        },
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Error obteniendo hilo de Gmail:", error.response?.data || error.message);
    res.status(500).json({ error: "No se pudo obtener el hilo de Gmail" });
  }
});

export default router;
