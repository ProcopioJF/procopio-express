import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { RoleName, User } from "@prisma/client";
import { config } from "./config.js";

export type AuthActor = {
  id: string;
  role: RoleName;
  companyId?: string;
};

type TokenPayload = {
  sub: string;
  role: RoleName;
  companyId?: string;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function createAccessToken(actor: AuthActor) {
  return jwt.sign(
    { role: actor.role, companyId: actor.companyId },
    config.jwtSecret,
    { subject: actor.id, expiresIn: config.jwtExpiresIn as jwt.SignOptions["expiresIn"] },
  );
}

export function verifyAccessToken(token: string): AuthActor {
  const payload = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & Partial<TokenPayload>;
  if (!payload.sub || !payload.role || !["ADMIN", "COMPANY", "COURIER"].includes(payload.role)) {
    throw new Error("Token inválido");
  }
  return { id: payload.sub, role: payload.role, companyId: payload.companyId };
}

export function publicUser(user: Pick<User, "id" | "name" | "email" | "phone" | "companyId" | "companyPermission" | "isActive"> & { role: { name: RoleName } }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role.name,
    companyId: user.companyId,
    companyPermission: user.companyPermission,
    isActive: user.isActive,
  };
}
