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

router.get('/clickup/callback',
   passport.authenticate('clickup', { 
     failureRedirect: '/auth/failed',
     successRedirect: '/auth/success'
   })
);

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
  (req, res) => {
    const u = req.user as any;
    res.send(
      `Autenticado. accessToken: ${u?.accessToken || "N/D"} | refreshToken: ${u?.refreshToken || "N/D"}`
    );
  }   
);

// Feedback opcional
router.get('/failed', (_req, res) => res.status(401).send('Login fallido'));
router.get('/success', (_req, res) => res.send('Login ok'));

export default router;

