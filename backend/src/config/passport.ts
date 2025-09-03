import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile, VerifyCallback as GoogleVerifyCallback } from 'passport-google-oauth20';
import { Strategy as OAuth2Strategy, VerifyFunction as ClickUpVerifyFunction } from 'passport-oauth2';

// Validaciones de entorno
const googleClientID = process.env.GOOGLE_CLIENT_ID!;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET!;
const googleRedirectURI = process.env.GOOGLE_REDIRECT_URI!;
const clickupClientID = process.env.CLICKUP_CLIENT_ID!;
const clickupClientSecret = process.env.CLICKUP_CLIENT_SECRET!;
const clickupCallbackURL = process.env.CLICKUP_CALLBACK_URL!;

if (!googleClientID || !googleClientSecret || !googleRedirectURI ||
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
passport.use('google', new GoogleStrategy(
  {
    clientID: googleClientID,
    clientSecret: googleClientSecret,
    callbackURL: googleRedirectURI,
    scope: ['https://www.googleapis.com/auth/gmail.readonly'],
  },
  function (
    accessToken: string,
    refreshToken: string,
    profile: GoogleProfile,
    done: GoogleVerifyCallback
  ) {
    done(null, { accessToken, refreshToken });
  }
));

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


