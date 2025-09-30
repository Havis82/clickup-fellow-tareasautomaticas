import { Request, Response, NextFunction } from 'express';
import { refreshToken } from '../middleware/tokenRefresher';

export async function tokenRefresherMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated() && req.user && 'refreshToken' in req.user) {
    try {
      const newAccessToken = await refreshToken((req.user as any).refreshToken);
      (req.user as any).accessToken = newAccessToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
    }
  }
  next();
}
