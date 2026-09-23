import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import evalRoutes from "./routes/evalRoutes.js";
import customMetricsRoutes from "./routes/customMetricsRoutes.js";
import { ENV } from "./config/env.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from root directory
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();

// Configuration from .env
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Mount evaluation routes (from evalRoutes.ts)
app.use("/api", evalRoutes);
// Mount Custom Metrics (G-Eval) routes - strictly separate API surface (customMetricsRoutes.ts)
app.use("/api", customMetricsRoutes);

// ============================================
// HEALTH CHECK
// ============================================
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "Testleaf LLM Evaluation Framework",
    message: "DeepEval evaluation API is running",
    version: "1.0.0",
    environment: NODE_ENV,
    providers: {
      deepeval: {
        status: "active",
        metrics: ["faithfulness", "answer_relevancy", "contextual_precision", "contextual_recall", "pii_leakage", "bias", "hallucination", "toxicity"],
        endpoint: "/api/eval-only"
      }
    },
    timestamp: new Date().toISOString(),
  });
});

// ============================================
// BACKEND STATUS
// ============================================
app.get("/api/status", (req: Request, res: Response) => {
  res.json({
    service: "Testleaf LLM Evaluation Framework",
    version: "1.0.0",
    backend: {
      status: "running",
      port: PORT,
      environment: NODE_ENV,
    },
    providers: {
      deepeval: {
        status: "configured",
        metrics: ["faithfulness", "answer_relevancy", "contextual_precision", "contextual_recall", "pii_leakage", "bias", "hallucination", "toxicity"]
      }
    },
    // Feature toggles - frontend uses these to show/hide the corresponding tabs
    features: {
      singleTurn: ENV.ENABLE_SINGLE_TURN,
      multiTurn: ENV.ENABLE_MULTI_TURN,
      customMetrics: ENV.ENABLE_CUSTOM_METRICS,
      batchEval: ENV.ENABLE_BATCH_EVAL,
      goldenDataset: ENV.ENABLE_GOLDEN_DATASET,
    },
    endpoints: {
      health: "GET /health",
      deepeval: "POST /api/eval-only",
      customMetrics: "POST /api/custom-metrics/geval",
      status: "GET /api/status",
    },
  });
});

// ============================================
// 404 HANDLER
// ============================================
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: {
      health: "GET /health",
      deepeval: "POST /api/eval-only",
      status: "GET /api/status",
    },
  });
});

// ============================================
// GLOBAL ERROR HANDLER
// ============================================
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error("[ERROR]", err);

  const error = err as Error & { status?: number };
  const status = error.status || 500;
  const message = error.message || "Internal Server Error";

  res.status(status).json({
    error: message,
    status,
    environment: NODE_ENV,
    ...(NODE_ENV === "development" && { stack: error.stack }),
  });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log('🚀 ═══════════════════════════════════════════════════');
  console.log('🤖 Testleaf LLM Evaluation Framework Backend');
  console.log('🚀 ═══════════════════════════════════════════════════');
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log('📊 Available Endpoints:');
  console.log(`   └─ DeepEval: http://localhost:${PORT}/api/eval-only`);
  console.log('🚀 ═══════════════════════════════════════════════════');
});

export default app;