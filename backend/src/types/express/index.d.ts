declare global {
  namespace Express {
    interface User {
      accessToken: string;
      refreshToken: string;
    }

    // Esta es la parte nueva para extender Express. Request
    interface Request {
      user?: User;
    }
  }
}
