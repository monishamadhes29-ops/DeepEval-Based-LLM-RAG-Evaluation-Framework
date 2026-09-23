import { Router, Request, Response, NextFunction } from "express";
import { evalCustomGEval, getCustomGEvalConfig, getSupportedCustomMetrics } from "../services/evalClient.js";
import { ENV } from "../config/env.js";

/**
 * Custom Metrics (G-Eval) API - STRICTLY separate from evalRoutes.ts/`/api/eval-only`.
 * Built-in DeepEval metrics (faithfulness, answer_relevancy, ...) and user-defined G-Eval
 * criteria (e.g. "correctness") are evaluated through entirely different endpoints, per the
 * requirement that custom G-Eval gets its own dedicated API surface.
 */
const router = Router();

const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

const FALLBACK_CUSTOM_METRICS = ["correctness", "fairness"];

/**
 * GET /api/custom-metrics
 * Whether the Custom Metrics (G-Eval) feature is enabled (ON/OFF toggle), plus the list of
 * custom G-Eval metric presets available for the checkbox menu.
 *
 * Response: { enabled: boolean, metrics: string[] }
 */
router.get(
  "/custom-metrics",
  asyncHandler(async (req: Request, res: Response) => {
    if (!ENV.ENABLE_CUSTOM_METRICS) {
      return res.json({ enabled: false, metrics: [] });
    }

    try {
      const metrics = await getSupportedCustomMetrics();
      res.json({ enabled: true, metrics });
    } catch (error) {
      console.warn("Could not reach DeepEval service for /custom-metrics, using fallback list:", error instanceof Error ? error.message : error);
      res.json({ enabled: true, metrics: FALLBACK_CUSTOM_METRICS });
    }
  })
);

/**
 * GET /api/custom-metrics/config?metric_name=correctness
 * Current (env-resolved) scoring configuration for a custom G-Eval metric - criteria,
 * evaluation_params, threshold, and verdict cutoffs - so the UI can display/edit the
 * "scoring mechanism" before running an evaluation.
 *
 * Response: { metric_name, criteria, evaluation_params, threshold, verdict_high, verdict_low }
 */
router.get(
  "/custom-metrics/config",
  asyncHandler(async (req: Request, res: Response) => {
    if (!ENV.ENABLE_CUSTOM_METRICS) {
      return res.status(403).json({
        error: "Custom metrics are disabled",
        details: "Set ENABLE_CUSTOM_METRICS=true in the backend .env to enable this endpoint",
      });
    }

    const metricName = typeof req.query.metric_name === "string" ? req.query.metric_name : "correctness";

    try {
      const config = await getCustomGEvalConfig(metricName);
      res.json(config);
    } catch (error) {
      console.error("Failed to fetch custom G-Eval config:", error);
      res.status(500).json({
        error: "Failed to fetch custom metric configuration",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })
);

/**
 * POST /api/custom-metrics/geval
 * Evaluate a custom G-Eval metric (e.g. "correctness"). Scoring is configurable: omit
 * criteria/evaluation_steps/threshold to use the sidecar's configured defaults, or override
 * any of them per-request.
 *
 * Request body:
 * {
 *   metric_name?: string (defaults to 'correctness'),
 *   query?: string,
 *   output: string - required,
 *   expected_output?: string,
 *   context?: string[],
 *   criteria?: string - overrides the configured criteria for this call,
 *   evaluation_steps?: string[] - overrides criteria if provided,
 *   threshold?: number - overrides the configured pass/fail threshold,
 *   provider?: string
 * }
 *
 * Response mirrors /api/eval-only's single-metric shape so ResponsePanel and the
 * /api/eval-report reporting endpoint work unchanged for custom metrics too:
 * { metric, score, verdict, explanation, query?, output, context? }
 */
router.post(
  "/custom-metrics/geval",
  asyncHandler(async (req: Request, res: Response) => {
    if (!ENV.ENABLE_CUSTOM_METRICS) {
      return res.status(403).json({
        error: "Custom metrics are disabled",
        details: "Set ENABLE_CUSTOM_METRICS=true in the backend .env to enable this endpoint",
      });
    }

    const {
      metric_name,
      query,
      output,
      expected_output,
      context,
      criteria,
      evaluation_steps,
      threshold,
      provider,
    } = req.body;

    if (!output || !String(output).trim()) {
      return res.status(400).json({
        error: "Missing required field: output (required for custom G-Eval metrics)",
      });
    }

    try {
      const evalResult = await evalCustomGEval({
        metric_name: metric_name || "correctness",
        query,
        output,
        expected_output,
        context: context ? (Array.isArray(context) ? context : [context]) : undefined,
        criteria,
        evaluation_steps,
        threshold,
        provider: provider || "groq",
      });

      console.log("DeepEval Custom G-Eval Raw Response:", JSON.stringify(evalResult, null, 2));

      let verdict: string | undefined;
      let usage: any;
      if (evalResult.results && Array.isArray(evalResult.results) && evalResult.results.length > 0) {
        verdict = evalResult.results[0].verdict;
        usage = evalResult.results[0].usage;
      }

      const response: any = {
        metric: evalResult.metric_name || metric_name || "correctness",
        score: evalResult.score,
        verdict,
        explanation: evalResult.explanation,
        output,
      };
      if (usage) response.usage = usage;
      if (query) response.query = query;
      if (context) response.context = Array.isArray(context) ? context : [context];

      res.json(response);
    } catch (error) {
      console.error("Custom G-Eval evaluation error:", error);
      res.status(500).json({
        error: "Custom G-Eval evaluation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      });
    }
  })
);

export default router;
