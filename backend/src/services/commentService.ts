
// commentService.ts
// Servicio para agregar comentarios a una tarea en ClickUp

import axios from 'axios';

const CLICKUP_API_URL = 'https://api.clickup.com/api/v2';

export async function addCommentToTask(taskId: string, comment: string, accessToken: string) {
    const response = await axios.post(
        `${CLICKUP_API_URL}/task/${taskId}/comment`,
        { comment_text: comment },
        { headers: { Authorization: accessToken } }
    );
    return response.data;
}
