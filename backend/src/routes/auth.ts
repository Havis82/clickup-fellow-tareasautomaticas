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
  "/google",
  passport.authenticate("google", {
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
    accessType: "offline",      // <-- PIDE refresh_token
    prompt: "consent",          // <-- FUERZA a Google a mostrar consentimiento (y devolverlo)
    includeGrantedScopes: true,
  } as any) // cast para opciones adicionales no tipadas
);

// 👉 Callback de Google
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failed" }),
  (req, res) => {
    // Aquí ya tienes req.user con tokens. Persiste refreshToken en tu BD si no lo haces en verify().
    // Ejemplo rápido para ver en logs:
    // console.log("Google user:", (req.user as any)?.tokens);

    // Redirige donde quieras:
    res.redirect("/"); // o a una página de éxito
  }
);

// (Opcional) páginas de feedback
router.get("/failed", (_req, res) => res.status(401).send("Login fallido"));
router.get("/success", (_req, res) => res.send("Login ok"));

export default router;

