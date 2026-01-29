import { Router } from "express";
import { DrCiceroService } from "../modules/closing/dr-cicero.contract";

export function closingRoutes(drCicero: DrCiceroService) {
  const r = Router();

  // Gera parecer oficial do Dr. Cícero para o mês
  r.post("/closing/evaluate", async (req, res) => {
    try {
      const input = req.body; // validar com zod em produção
      const result = await drCicero.evaluate(input);
      res.status(200).json(result);
    } catch (e: any) {
      res.status(500).json({ error: e?.message ?? "Unknown error" });
    }
  });

  return r;
}
