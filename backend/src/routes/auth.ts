import express from 'express';
import passport from 'passport';

const router = express.Router();

/** ---------- CLICKUP ---------- */
router.get(
  '/clickup',
  (req, _res, next) => {
    console.log('🔧 Autenticación con ClickUp iniciada');
    next();
  },
  passport.authenticate('clickup', { scope: ['task:read', 'task:write'] })
);

// Si ya tienes la ruta de callback de ClickUp en otro sitio, deja esto comentado.
// router.get('/clickup/callback',
//   passport.authenticate('clickup', { failureRedirect: '/auth/failed' }),
//   (_req, res) => res.redirect('/')
// );

/** ---------- GOOGLE OAUTH (Gmail) ---------- */
// 👉 RUTA QUE INICIA EL LOGIN (AQUÍ ESTÁ EL SCOPE + OFFLINE + CONSENT)
router.get(
  '/google',
  passport.authenticate('google', {
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ],
    accessType: 'offline',      // pide refresh_token
    prompt: 'consent',          // fuerza consentimiento (necesario para refresh_token)
    includeGrantedScopes: true
  } as any) // cast para permitir accessType/prompt en TS
);

// 👉 CALLBACK (DEBE COINCIDIR CON GOOGLE_REDIRECT_URI)
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failed' }),
  (_req, res) => res.redirect('/') // o a donde quieras
);

// Feedback opcional
router.get('/failed', (_req, res) => res.status(401).send('Login fallido'));
router.get('/success', (_req, res) => res.send('Login ok'));

export default router;

