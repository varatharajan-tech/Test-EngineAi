// Placeholder ML model registry — future integrations.
import type { FuelInput, EngineInput, ConditionsInput, PredictionResult } from "./engine";
import { predict as heuristicPredict } from "./engine";

export type ModelId = "heuristic" | "xgboost" | "random_forest" | "neural_net";

export const MODELS: Array<{ id: ModelId; label: string; status: "active" | "planned" }> = [
  { id: "heuristic", label: "Physics Heuristic (v1.0)", status: "active" },
  { id: "xgboost", label: "XGBoost Regressor", status: "planned" },
  { id: "random_forest", label: "Random Forest Ensemble", status: "planned" },
  { id: "neural_net", label: "Deep Neural Network", status: "planned" },
];

export function predictWith(model: ModelId, fuel: FuelInput, engine: EngineInput, cond: ConditionsInput): PredictionResult {
  if (model === "heuristic") return heuristicPredict(fuel, engine, cond);
  throw new Error(`Model "${model}" not yet trained — coming soon.`);
}
