import express from 'express';
import passport from 'passport';

const router = express.Router();

console.log('🔧 Entrando en rutas de autenticación');

// 👉 Autenticación con ClickUp
router.get(
  '/clickup', (req, res, next) => {
    console.log ('🔧 Autenticación con ClickUp iniciada');
    next();
  },
  passport.authenticate('clickup', { scope: ['task:read', 'task:write'] })
);

// 👉 Callback de ClickUp (añade esto si aún no lo tienes en app.ts)
// router.get(
  // '/callback',
  // passport.authenticate('clickup', {
  // failureRedirect: '/login',
  //  successRedirect: '/', // o a donde quieras
  //})
//);

// 👉 Autenticación con Google
router.get(
  '/google',
  passport.authenticate('google', {
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
      ],
    accessType: 'offline',        // 🔴 clave: pide refresh_token
    prompt: 'consent',            // 🔴 clave: fuerza el consentimiento y la entrega
    includeGrantedScopes: true
  })
);

// 👉 Callback de Google
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failed' }),
  (req, res) => {
    // Aquí ya deberías tener el refresh_token en req.session.googleTokens.refresh_token (si Google lo entregó)
    res.redirect('/'); // o a una página que confirme “Autenticado”
  }
);

// 👉 Ruta para cerrar sesión
router.get('/logout', (req: express.Request, res: express.Response) => {
  req.logout((err: any) => {
    if (err) {
      console.error('Error during logout:', err);
    }
    res.redirect('/');
  });
});

console.log('✅ Auth routes mounted');

export default router;

