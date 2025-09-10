import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import type { Request, Response } from 'express';
import session from 'express-session';
import passport from './config/passport';
import type { RequestHandler } from 'express';
import authRoutes from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { tokenRefresherMiddleware } from './middleware/tokenRefresher';
import webhookRoutes from './routes/webhook';
import bodyParser from 'body-parser';
//import './smee-client';  // Add this line in development

const app = express();

// This line is crucial for parsing JSON request bodies
app.use(express.json());

// Use raw body parser for webhook route
// app.use('/webhook/clickup', bodyParser.raw({ type: 'application/json' }));

// Use JSON body parser for other routes
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false
}));

app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
    cookie: { sameSite: "lax" } // ajusta 'secure' si tienes dominio con HTTPS propio
  })
);

app.use(passport.initialize() as RequestHandler);
app.use(passport.session() as RequestHandler);
app.use('/auth', authRoutes);

// Add this new route
app.get('/', (req: Request, res: Response, next) => {
  console.log('🌐 Entrando en GET / con query:', req.query);
  // Si la URL incluye ?code=..., viene de ClickUp
  if (req.query.code) {
    passport.authenticate('clickup', {
      failureRedirect: '/login',
      successRedirect: '/', // Vuelve a entrar, pero ya autenticado
    })(req, res, next);
  } else {
    // Acceso normal a la raíz
    if (req.isAuthenticated()) {
      res.send(`
        ✅ Autenticado<br>
        Token: ${(req.user as any).accessToken}<br>
        <a href="/auth/logout">Logout</a>
      `);
    } else {
      res.send(`
        Bienvenido. <a href="/auth/clickup">Conectar con ClickUp</a>
      `);
    }
  }
});

app.get('/login', (req, res) => {
  res.send('⚠️ Error de autenticación. <a href="/auth/clickup">Inténtalo de nuevo</a>');
});

// app.use(tokenRefresherMiddleware);
app.use('/clickup/protected', tokenRefresherMiddleware, (req, res) => {
  res.send('Zona protegida con token refrescado');
});

app.use('/webhook', webhookRoutes);

app.use(errorHandler);

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
