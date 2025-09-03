
// clickup.ts
// Ruta de ClickUp
import express from 'express';
const router = express.Router();

// NUEVO: Endpoint opcional para asociar tarea con hilo de correo
router.post('/link-task-thread', (req, res) => {
    const { taskId, threadId } = req.body;
    // Aquí se guardaría la relación en base de datos
    res.status(200).send(`Tarea ${taskId} vinculada al hilo ${threadId}`);
});

export default router;
