import type { Request, Response } from "express";
import { app } from "../backend/src/app.js";

const originalPathKey = "__px_original_path";

export default function handler(req: Request, res: Response) {
  const requestUrl = new URL(req.url ?? "/", "https://vercel.invalid");
  const originalPath = requestUrl.searchParams.get(originalPathKey);

  if (originalPath) {
    const normalizedPath = originalPath.startsWith("/") ? originalPath : `/${originalPath}`;
    if (
      normalizedPath !== "/health" &&
      normalizedPath !== "/webhooks/whatsapp" &&
      !normalizedPath.startsWith("/api/")
    ) {
      return res.status(400).json({ error: "Rota encaminhada inválida" });
    }

    requestUrl.searchParams.delete(originalPathKey);
    req.url = `${normalizedPath}${requestUrl.search}`;
  }

  return app(req, res);
}
