
// gmail.ts
// Router para gestionar autenticación OAuth2 con Google (Gmail)

import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('No se recibió código');
  }

  try {
    // Aquí puedes intercambiar el código por tokens si lo deseas:
    /*
    const response = await axios.post('https://oauth2.googleapis.com/token', null, {
      params: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.GOOGLE_REDIRECT_URI
      }
    });

    const { access_token, refresh_token } = response.data;
    return res.send({ access_token, refresh_token });
    */

    // Por ahora, simplemente mostramos el código recibido
    res.send(`Código recibido correctamente: ${code}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al intercambiar el código por tokens');
  }
});

export default router;
