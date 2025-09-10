// backend/src/routes/gmail.ts
import express from 'express';
import crypto from 'crypto';
import axios from 'axios';

const router = express.Router();

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

// 1) Inicio del flujo OAuth: /auth/google
router.get('/auth/google', (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) {
    return res.status(500).send('Faltan GOOGLE_CLIENT_ID o GOOGLE_REDIRECT_URI');
  }

  const state = crypto.randomUUID();
  (req.session as any).google_oauth_state = state;

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state,
  });

  return res.redirect(`${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`);
});

// 2) Callback de Google: /auth/google/callback
router.get('/auth/google/callback', async (req, res) => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    return res.status(500).send('Faltan variables de entorno de Google');
  }

  const code = req.query.code as string | undefined;
  const state = req.query.state as string | undefined;

  // ⚠️ Si entras al callback sin 'code', reinicia el flujo correctamente CON scope.
  if (!code) {
    const newState = crypto.randomUUID();
    (req.session as any).google_oauth_state = newState;

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: ['https://www.googleapis.com/auth/gmail.readonly'].join(' '), // <— IMPORTANTE
      access_type: 'offline',
      include_granted_scopes: 'true',
      prompt: 'consent',
      state: newState,
    });

    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  }

  // ✅ Solo validamos el 'state' cuando ya hay 'code'
  const expectedState = (req.session as any).google_oauth_state;
  if (!state || !expectedState || state !== expectedState) {
    return res.status(400).send('Estado OAuth inválido o ausente');
  }
  delete (req.session as any).google_oauth_state;

  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: GOOGLE_REDIRECT_URI,
    });

    const { access_token, refresh_token, expires_in, id_token, token_type } = tokenRes.data;

    // TODO: guarda 'refresh_token' de forma segura para uso posterior
    return res.json({
      ok: true,
      token_type,
      expires_in,
      access_token,
      refresh_token,
      id_token,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    });
  } catch (err: any) {
    console.error('Error al intercambiar el código por tokens:', err?.response?.data || err?.message || err);
    return res.status(500).send('Error al intercambiar el código por tokens');
  }
});

export default router;

