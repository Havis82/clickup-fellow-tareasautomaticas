
// gmail.ts
// Router para gestionar autenticación OAuth2 con Google (Gmail)

import express from 'express';
import axios from 'axios';

const router = express.Router();

router.get('/auth/google/callback', async (req, res) => {
  const code = req.query.code as string;
  if (!code) return res.status(400).send('No se recibió código');

  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // TODO: guarda refresh_token de forma segura para posterior uso (Gmail threads)
    return res.json({ access_token, refresh_token, expires_in });
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error al intercambiar el código por tokens');
  }
});

export default router;
