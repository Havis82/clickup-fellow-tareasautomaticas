
// commentService.ts
// Servicio para agregar comentarios a una tarea en ClickUp

import axios from 'axios';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';

export async function addCommentToTask(taskId: string, comment: string, accessToken: string) {
    const response = await axios.post(
        `${CLICKUP_API_URL}/task/${taskId}/comment`,
        { comment_text: comment },
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    return response.data;
}

export async function setThreadIdOnTask(
  taskId: string,
  threadId: string,
  fieldId: string
) {
  const token = process.env.CLICKUP_ACCESS_TOKEN;
  if (!token) throw new Error("Falta CLICKUP_ACCESS_TOKEN");

  await axios.put(
    `https://api.clickup.com/api/v2/task/${taskId}`,
    {
      custom_fields: [
        { id: fieldId, value: threadId }
      ]
    },
    { headers: { Authorization: token } }
  );
}
