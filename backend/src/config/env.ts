import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), "..", ".env") });

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  GROQ_API_KEY: process.env.GROQ_API_KEY || "",
  DEEPEVAL_URL: process.env.DEEPEVAL_URL || "http://localhost:8000/eval",
  DEEPEVAL_MULTITURN_URL: process.env.DEEPEVAL_MULTITURN_URL || "http://localhost:8000/eval/multiturn",
  DEEPEVAL_GENERATE_GOLDENS_URL: process.env.DEEPEVAL_GENERATE_GOLDENS_URL || "http://localhost:8000/generate-goldens",
  DEEPEVAL_METRICS_URL: process.env.DEEPEVAL_METRICS_URL || "http://localhost:8000/metrics",
  DEEPEVAL_CUSTOM_GEVAL_URL: process.env.DEEPEVAL_CUSTOM_GEVAL_URL || "http://localhost:8000/custom-metrics/geval",
  DEEPEVAL_CUSTOM_METRICS_CONFIG_URL: process.env.DEEPEVAL_CUSTOM_METRICS_CONFIG_URL || "http://localhost:8000/custom-metrics/config",
  DEEPEVAL_CUSTOM_METRICS_LIST_URL: process.env.DEEPEVAL_CUSTOM_METRICS_LIST_URL || "http://localhost:8000/custom-metrics",
  // Feature toggles - default to enabled unless explicitly set to "false"
  ENABLE_SINGLE_TURN: process.env.ENABLE_SINGLE_TURN !== "false",
  ENABLE_MULTI_TURN: process.env.ENABLE_MULTI_TURN !== "false",
  // Master ON/OFF toggle for the Custom Metrics (G-Eval) menu/endpoint - separate from
  // ENABLE_SINGLE_TURN since custom G-Eval metrics use their own dedicated API.
  ENABLE_CUSTOM_METRICS: process.env.ENABLE_CUSTOM_METRICS !== "false",
  // ON/OFF toggle for the Batch Evaluation menu/endpoints (/api/batch/upload-excel,
  // /api/batch/evaluate, /api/batch/generate-report).
  ENABLE_BATCH_EVAL: process.env.ENABLE_BATCH_EVAL !== "false",
  // ON/OFF toggle for the Golden Dataset menu/endpoint (/api/batch/generate-goldens) -
  // separate from ENABLE_BATCH_EVAL since generating a golden dataset doesn't require an
  // uploaded Excel file the way batch evaluation does.
  ENABLE_GOLDEN_DATASET: process.env.ENABLE_GOLDEN_DATASET !== "false",
  // Comma-separated metric names to hide from dropdowns and reject if requested directly,
  // e.g. DISABLED_METRICS=bias,pii_leakage - matches single-turn or multi-turn metric names.
  DISABLED_METRICS: (process.env.DISABLED_METRICS || "")
    .split(",")
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean),
};

// Validate required environment variables
if (!ENV.GROQ_API_KEY && !ENV.OPENAI_API_KEY) {
  console.warn(
    "Warning: Neither GROQ_API_KEY nor OPENAI_API_KEY is set. LLM calls will fail."
  );
} else {
  if (!ENV.GROQ_API_KEY) {
    console.info("ℹ️ GROQ_API_KEY not configured. Groq provider is unavailable.");
  } else {
    console.info("✓ Groq provider available.");
  }
  if (!ENV.OPENAI_API_KEY) {
    console.info("ℹ️ OPENAI_API_KEY not configured. OpenAI provider is unavailable.");
  } else {
    console.info("✓ OpenAI provider available.");
  }
}

console.info(`ℹ️ Single-turn evaluation: ${ENV.ENABLE_SINGLE_TURN ? "enabled" : "disabled"} (ENABLE_SINGLE_TURN)`);
console.info(`ℹ️ Multi-turn evaluation: ${ENV.ENABLE_MULTI_TURN ? "enabled" : "disabled"} (ENABLE_MULTI_TURN)`);
console.info(`ℹ️ Custom metrics (G-Eval): ${ENV.ENABLE_CUSTOM_METRICS ? "enabled" : "disabled"} (ENABLE_CUSTOM_METRICS)`);
console.info(`ℹ️ Batch evaluation: ${ENV.ENABLE_BATCH_EVAL ? "enabled" : "disabled"} (ENABLE_BATCH_EVAL)`);
console.info(`ℹ️ Golden dataset: ${ENV.ENABLE_GOLDEN_DATASET ? "enabled" : "disabled"} (ENABLE_GOLDEN_DATASET)`);
if (ENV.DISABLED_METRICS.length > 0) {
  console.info(`ℹ️ Disabled metrics: ${ENV.DISABLED_METRICS.join(", ")} (DISABLED_METRICS)`);
}
