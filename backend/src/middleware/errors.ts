import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const notFound: RequestHandler = (_req, res) => res.status(404).json({ error: "Rota não encontrada" });
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) return res.status(400).json({ error: "Dados inválidos", details: error.flatten() });
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error?.name === "PrismaClientKnownRequestError") {
    if (error.code === "P2002") return res.status(409).json({ error: "Já existe um registro com esses dados." });
    if (error.code === "P2025") return res.status(404).json({ error: "O registro solicitado não foi encontrado." });
    if (error.code === "P2003") return res.status(400).json({ error: "A operação referencia um registro inválido." });
    if (error.code === "P2034") return res.status(409).json({ error: "O registro foi alterado por outra operação. Atualize e tente novamente." });
    console.error(error);
    return res.status(500).json({ error: "Não foi possível concluir a operação no banco de dados." });
  }
  if (error?.name === "PrismaClientInitializationError" || error?.name === "PrismaClientRustPanicError") {
    return res.status(503).json({ error: "Banco de dados indisponível. Configure a conexão do Supabase." });
  }
  console.error(error);
  return res.status(500).json({ error: "Erro interno do servidor" });
};
