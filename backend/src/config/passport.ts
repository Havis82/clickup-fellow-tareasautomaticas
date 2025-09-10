import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile, VerifyCallback as GoogleVerifyCallback } from 'passport-google-oauth20';
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
      clientID: GOOGLE_CLIENT_ID || "",
      clientSecret: GOOGLE_CLIENT_SECRET || "",
      callbackURL: GOOGLE_REDIRECT_URI || "",
    },
    // Firma de verify: (accessToken, refreshToken, profile, done)
    async (accessToken: string, refreshToken: string | undefined, profile: GoogleProfile, done) => {
      try {
        // Aquí puedes persistir tokens en tu BD (recomendado)
        // Para ejemplo simple, devolvemos un "user" con los tokens:
        const user = {
          googleId: profile.id,
          email: profile.emails?.[0]?.value,
          tokens: {
            accessToken,
            refreshToken, // <-- IMPORTANTE: guarda esto si llega
          },
          profile,
        };

        return done(null, user);
      } catch (err) {
        return done(err);
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
passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

export default passport;


