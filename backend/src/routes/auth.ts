import express from 'express';
import passport from 'passport';

const router = express.Router();

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
    // 👇 OBLIGATORIO: scopes
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify"
    ],
    // 👇 Para obtener refresh_token
    accessType: "offline",
    prompt: "consent",
    includeGrantedScopes: true
  } as any) // cast para permitir accessType/prompt en TS
);

// 👉 Callback de Google
router.get(
  "/google/callback",
  passport.authenticate("google", { failureRedirect: "/auth/failed" }),
  (_req, res) => res.redirect("/") // o a donde quieras
);

// (Opcional) páginas de feedback
router.get("/failed", (_req, res) => res.status(401).send("Login fallido"));
router.get("/success", (_req, res) => res.send("Login ok"));

export default router;

