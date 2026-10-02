import type { RequestHandler } from "express";
import { verifyAccessToken } from "../auth.js";
import { prisma } from "../db.js";
import { HttpError } from "./errors.js";

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
      actor?: {
        id: string;
        role: "ADMIN" | "COMPANY" | "COURIER";
        companyId?: string;
      };
    }
  }
}

export const bearerAuth: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization");
  if (!header) return next();

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(new HttpError(401, "Cabeçalho de autorização inválido"));

  try {
    req.actor = verifyAccessToken(token);
    next();
  } catch {
    next(new HttpError(401, "Token inválido ou expirado"));
  }
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.actor) return next(new HttpError(401, "Autenticação necessária"));
  const actor = req.actor;
  void prisma.user.findUnique({
    where: { id: actor.id },
    select: { isActive: true, companyId: true, role: { select: { name: true } } },
  }).then((user) => {
    if (!user?.isActive || user.role.name !== actor.role || (actor.role === "COMPANY" && user.companyId !== actor.companyId)) {
      return next(new HttpError(401, "Sessão inválida ou conta desativada"));
    }
    next();
  }).catch(next);
};
