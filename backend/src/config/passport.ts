import passport from 'passport';
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as OAuth2Strategy, VerifyFunction as ClickUpVerifyFunction } from 'passport-oauth2';

// Validaciones de entorno
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
const clickupClientID = process.env.CLICKUP_CLIENT_ID!;
const clickupClientSecret = process.env.CLICKUP_CLIENT_SECRET!;
const clickupCallbackURL = process.env.CLICKUP_CALLBACK_URL!;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI ||
    !clickupClientID || !clickupClientSecret || !clickupCallbackURL) {
  throw new Error('❌ Faltan variables de entorno necesarias para OAuth');
}

// Extender Express.User
declare global {
  namespace Express {
    interface User {
      accessToken: string;
      refreshToken?: string;
    }
  }
}

// Estrategia de Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID || '',
      clientSecret: GOOGLE_CLIENT_SECRET || '',
      callbackURL: GOOGLE_REDIRECT_URI || '' // ej.: https://clickup-hilo-correos.onrender.com/auth/google/callback
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Aquí debes persistir refreshToken en tu BD/almacenamiento
        const user = {
          googleId: profile.id,
          email: profile.emails?.[0]?.value,
          tokens: { accessToken, refreshToken }
        };
        return done(null, user);
      } catch (err) {
        return done(err as any);
      }
    }
  )
);

// Estrategia de ClickUp OAuth
const clickupVerify = (
  accessToken: string,
  refreshToken: string,
  profile: any,
  done: (error: any, user?: Express.User) => void 
): void => {
  const user: Express.User = { accessToken, refreshToken };
  done(null, user);
};

passport.use('clickup', new OAuth2Strategy(
  {
    authorizationURL: 'https://app.clickup.com/api/v2/oauth/authorize',
    tokenURL: 'https://api.clickup.com/api/v2/oauth/token',
    clientID: clickupClientID,
    clientSecret: clickupClientSecret,
    callbackURL: clickupCallbackURL,
  },
  clickupVerify
));

// Serialización y deserialización compartida
passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((obj: any, done) => done(null, obj));

export default passport;


