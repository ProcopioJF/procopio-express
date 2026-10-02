/** Development seam only. Replace with verified authentication in phase 2. */
import type { RequestHandler } from "express";

export const developmentActor: RequestHandler = (req, _res, next) => {
  const role = req.header("x-dev-role") as "ADMIN" | "COMPANY" | "COURIER" | undefined;
  if (process.env.NODE_ENV === "production" && role) return next(new Error("Development actor is disabled"));
  if (!req.actor && role) req.actor = { id: req.header("x-dev-user-id") ?? "development-user", role, companyId: req.header("x-dev-company-id") ?? undefined };
  next();
};
