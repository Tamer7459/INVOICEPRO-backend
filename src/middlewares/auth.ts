import { Request, Response, NextFunction } from "express";
import { verifyToken, JwtPayload } from "../utils/jwt";
import { UnauthorizedError, ForbiddenError } from "../utils/errors";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) throw new UnauthorizedError("No token provided");
  const token = header.split(" ")[1];
  if (!token) throw new UnauthorizedError("Invalid token");
  req.user = verifyToken(token);
  next();
};

export const authorize = (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new UnauthorizedError("Not authenticated");
    if (!roles.includes(req.user.role)) throw new ForbiddenError("Insufficient permissions");
    next();
  };
