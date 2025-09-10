
// gmail.ts
// Router para gestionar autenticación OAuth2 con Google (Gmail)

import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { Router } from 'express';

const router = express.Router();

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

// Scopes mínimos para leer hilos y mensajes de Gmail
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
];

router.get('/auth/google', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return res.status(500).send('Faltan GOOGLE_CLIENT_ID o GOOGLE_REDIRECT_URI');
  }

  // CSRF: genera y guarda state en sesión
  const state = crypto.randomUUID();
  (req.session as any).google_oauth_state = state;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),      // <— IMPORTANTE
    access_type: 'offline',              // para obtener refresh_token
    include_granted_scopes: 'true',
    prompt: 'consent',                   // fuerza consentimiento 1ª vez (útil para refresh_token)
    state,
  });

  const url = `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`;
  return res.redirect(url);
});

router.get('/auth/google/callback', async (req, res) => {
  const { code, state } = req.query as { code?: string; state?: string };

  // Valida estado (CSRF)
  const expectedState = (req.session as any).google_oauth_state;
  if (!state || !expectedState || state !== expectedState) {
    return res.status(400).send('Estado OAuth inválido o ausente');
  }
  // Limpia el state ya usado
  delete (req.session as any).google_oauth_state;

  if (!code) return res.status(400).send('No se recibió código');

  try {
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
    });

    const { access_token, refresh_token, expires_in, id_token, token_type } = tokenRes.data;

    // TODO: persiste de forma segura el refresh_token para uso posterior con Gmail
    //       (p.ej., BD/secret store). Aquí te lo devuelvo para que verifiques rápidamente.
    return res.json({
      ok: true,
      token_type,
      expires_in,
      access_token,
      refresh_token,
      id_token,
      scopes: GOOGLE_SCOPES,
    });
  } catch (err: any) {
    console.error('Error intercambiando el código por tokens:', err?.response?.data || err?.message || err);
    return res.status(500).send('Error al intercambiar el código por tokens');
  }
});

export default router;
