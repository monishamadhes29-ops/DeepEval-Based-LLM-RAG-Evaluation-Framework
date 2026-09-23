import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { evalWithFields, evalMultiTurn, TurnInput, generateGoldens, getSupportedMetrics } from "../services/evalClient.js";
import { parseExcelFile } from "../services/excelService.js";
import { generateHTMLReport, generateExcelReport } from "../services/reportService.js";
import { ENV } from "../config/env.js";

/*multer is used for handling file uploads in the /batch/upload-excel endpoint.
It saves uploaded files to a temporary directory and provides file information in the request object for further processing. In this code, we configure multer to only accept Excel files and store them in an 'uploads' directory. After processing the file, we also ensure that the temporary file is deleted to prevent clutter and save storage space.*/
const router = Router();

/**
 * Error handler middleware for async routes
 */
const asyncHandler =
  (fn: (req: Request, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res)).catch(next);
  };

/**
 * Middleware guard for every /batch/* endpoint (upload-excel, evaluate, generate-report) -
 * mirrors the ENABLE_SINGLE_TURN/ENABLE_MULTI_TURN checks already inline in /eval-only and
 * /eval-multiturn, but as reusable middleware since these routes need the check to run
 * before multer's file upload handling too.
 */
const requireBatchEval = (req: Request, res: Response, next: NextFunction) => {
  if (!ENV.ENABLE_BATCH_EVAL) {
    return res.status(403).json({
      error: "Batch evaluation is disabled",
      details: "Set ENABLE_BATCH_EVAL=true in the backend .env to enable this endpoint"
    });
  }
  next();
};

/**
 * GET /health
 * Health check endpoint
 */
router.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /config/metrics
 * Enabled metric names for the frontend dropdowns - the DeepEval sidecar's full
 * supported-metrics list, minus whatever DISABLED_METRICS excludes in the backend .env.
 * Falls back to a small hardcoded list (also minus DISABLED_METRICS) if the sidecar is
 * unreachable, so the UI degrades gracefully instead of breaking.
 *
 * Response: { singleTurn: string[], multiTurn: string[] }
 */
const FALLBACK_SINGLE_TURN_METRICS = [
  "faithfulness", "answer_relevancy", "contextual_precision", "contextual_recall",
  "pii_leakage", "bias", "hallucination", "toxicity"
];
const FALLBACK_MULTI_TURN_METRICS = ["conversation_completeness"];

router.get("/config/metrics", asyncHandler(async (req: Request, res: Response) => {
  const isEnabled = (m: string) => !ENV.DISABLED_METRICS.includes(m.toLowerCase());

  try {
    const supported = await getSupportedMetrics();
    res.json({
      singleTurn: supported.singleTurn.filter(isEnabled),
      multiTurn: supported.multiTurn.filter(isEnabled),
    });
  } catch (error) {
    console.warn("Could not reach DeepEval service for /config/metrics, using fallback list:", error instanceof Error ? error.message : error);
    res.json({
      singleTurn: FALLBACK_SINGLE_TURN_METRICS.filter(isEnabled),
      multiTurn: FALLBACK_MULTI_TURN_METRICS.filter(isEnabled),
    });
  }
}));

/**
 * POST /eval-only
 * DeepEval evaluation endpoint 
 * Request body:
 * {
 *   query?: string - the input question,
 *   output?: string - the response to evaluate (required for most metrics, NOT required for contextual_precision and contextual_recall),
 *   context?: string | string[] - context for faithfulness evaluation
 *   expected_output?: string - reference/expected answer (required for contextual_precision and contextual_recall),
 *   metric?: string (optional, defaults to 'answer_relevancy')
 * }
 *
 * Response:
 * {
 *   metric: string,
 *   score: number,
 *   verdict: string,
 *   explanation: string,
 *   query?: string,
 *   output?: string (not included for contextual metrics),
 *   context?: string[]
 * }
 */
router.post(
  "/eval-only",
  asyncHandler(async (req: Request, res: Response) => {
    if (!ENV.ENABLE_SINGLE_TURN) {
      return res.status(403).json({
        error: "Single-turn evaluation is disabled",
        details: "Set ENABLE_SINGLE_TURN=true in the backend .env to enable this endpoint"
      });
    }

    const { query, output, context, metric, expected_output } = req.body;

    // `metric` may be a single string, an array of strings (multi-select), or "all".
    const rawMetric = metric || "answer_relevancy";
    const isAllMetrics = typeof rawMetric === "string" && rawMetric.toLowerCase() === "all";
    const metricsList: string[] = isAllMetrics
      ? ["all"]
      : Array.isArray(rawMetric)
      ? (rawMetric.length > 0 ? rawMetric : ["answer_relevancy"])
      : [rawMetric];
    const isMultiMetric = !isAllMetrics && metricsList.length > 1;

    // Reject explicitly-requested metrics that are disabled via DISABLED_METRICS -
    // enforced server-side so the UI hiding them isn't the only thing stopping a direct API call.
    if (!isAllMetrics) {
      const disabledRequested = metricsList.filter((m) => ENV.DISABLED_METRICS.includes(m.toLowerCase()));
      if (disabledRequested.length > 0) {
        return res.status(403).json({
          error: `Metric(s) disabled: ${disabledRequested.join(", ")}`,
          details: "These metrics are disabled via DISABLED_METRICS in the backend .env"
        });
      }
    }

    // Validation - each selected metric is checked against the same per-metric rules
    // that applied to a single metric before; first failing metric wins (same as before).
    const metricsNotRequiringOutput = ["contextual_precision", "contextual_recall"];

    for (const m of metricsList) {
      if (!metricsNotRequiringOutput.includes(m) && !output) {
        return res.status(400).json({
          error: `Missing required field: output (required for ${m} metric)`
        });
      }
      if (m === "pii_leakage" && !query) {
        return res.status(400).json({
          error: "Missing required field: query (required for pii_leakage metric)"
        });
      }
      if (m === "bias" && !query) {
        return res.status(400).json({
          error: "Missing required field: query (required for bias metric)"
        });
      }
      if (m === "toxicity" && !query) {
        return res.status(400).json({
          error: "Missing required field: query (required for toxicity metric)"
        });
      }
      if (m === "hallucination" && !query) {
        return res.status(400).json({
          error: "Missing required field: query (required for hallucination metric)"
        });
      }
      if (m === "hallucination" && !context) {
        return res.status(400).json({
          error: "Missing required field: context (required for hallucination metric)"
        });
      }
      if (m === "hallucination" && Array.isArray(context) && context.length === 0) {
        return res.status(400).json({
          error: "Context cannot be empty for hallucination metric (requires at least one context item)"
        });
      }
    }

    try {
      // For "all", expand to the explicit (enabled-only) metric list when any metrics are
      // disabled - otherwise "all" would bypass DISABLED_METRICS entirely on the DeepEval side.
      let effectiveMetric: string | string[] = isAllMetrics ? "all" : (isMultiMetric ? metricsList : metricsList[0]);
      if (isAllMetrics && ENV.DISABLED_METRICS.length > 0) {
        try {
          const supported = await getSupportedMetrics();
          effectiveMetric = supported.singleTurn.filter((m) => !ENV.DISABLED_METRICS.includes(m.toLowerCase()));
        } catch (metricsErr) {
          console.warn("Could not fetch supported metrics to filter 'all' - falling back to unfiltered 'all':", metricsErr);
        }
      }

      // Build evaluation parameters
      const evalParams: any = {
        metric: effectiveMetric,
        provider: req.body.provider || "groq",  // Use provider from request, default to groq
        output: output
      };

      if (query) evalParams.query = query;
      if (context) evalParams.context = Array.isArray(context) ? context : [context];
      if (expected_output) evalParams.expected_output = expected_output;

      console.log(`DeepEval - Metric(s): ${metricsList.join(", ")}`);
      console.log(`DeepEval - Full evalParams:`, JSON.stringify(evalParams, null, 2));
      if (query) console.log(`Query: ${query.substring(0, 80)}...`);
      if (output) console.log(`Output: ${output.substring(0, 80)}...`);
      if (context) console.log(`Context:`, JSON.stringify(context, null, 2));

      // Evaluate using DeepEval
      const evalResult = await evalWithFields(evalParams);

      console.log("DeepEval Raw Response:", JSON.stringify(evalResult, null, 2));

      // "all" metrics or a multi-select (>1 metric) both come back as a results array
      if ((isAllMetrics || isMultiMetric) && evalResult.results && Array.isArray(evalResult.results)) {
        console.log(`✓ Returning ${evalResult.results.length} metric result(s)`);
        const response: any = {
          metric: isAllMetrics ? "all" : "multiple",
          allMetrics: true,
          totalMetrics: evalResult.results.length,
          results: evalResult.results,
          output: output
        };
        if (evalResult.total_usage) response.totalUsage = evalResult.total_usage;

        if (query) response.query = query;
        if (evalParams.context) response.context = evalParams.context;

        console.log("Backend Response being sent to frontend:", JSON.stringify(response, null, 2));
        res.json(response);
      } else {
        // For single metric, extract the first result
        // The Python API returns: { results: [...], metric_name, score, explanation }
        // Extract verdict from results array (it's not at top level)
        let verdict: string | undefined = undefined;
        let detail: any = undefined;
        let usage: any = undefined;

        if (evalResult.results && Array.isArray(evalResult.results) && evalResult.results.length > 0) {
          const firstResult = evalResult.results[0];
          verdict = firstResult.verdict;
          detail = firstResult.detail;
          usage = firstResult.usage;
          console.log("✓ Extracted verdict from results[0]:", verdict);
        }

        // Return in same format as RAGAS for frontend consistency
        const response: any = {
          metric: evalResult.metric_name || metricsList[0],
          score: evalResult.score,
          verdict: verdict,  // Include verdict from results array
          explanation: evalResult.explanation,
          output: output
        };
        if (detail) response.detail = detail;
        if (usage) response.usage = usage;

        if (query) response.query = query;
        if (evalParams.context) response.context = evalParams.context;

        console.log("Backend Response being sent to frontend:", JSON.stringify(response, null, 2));
        res.json(response);
      }

    } catch (error) {
      console.error("DeepEval evaluation error:", error);
      res.status(500).json({
        error: "DeepEval evaluation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  })
);

/**
 * POST /eval-multiturn
 * Multi-turn (conversational) DeepEval evaluation endpoint
 * Request body:
 * {
 *   turns: { role: 'user'|'assistant', content: string, retrieval_context?: string[] }[] - at least 2 turns,
 *   metric?: string | string[] - 'conversation_completeness' | 'all' (optional, defaults to 'conversation_completeness'),
 *   provider?: string
 * }
 *
 * Response mirrors /eval-only: single-metric shape for one metric, or
 * { metric: 'multiple'|'all', allMetrics: true, totalMetrics, results: [...] } for several.
 */
router.post(
  "/eval-multiturn",
  asyncHandler(async (req: Request, res: Response) => {
    if (!ENV.ENABLE_MULTI_TURN) {
      return res.status(403).json({
        error: "Multi-turn evaluation is disabled",
        details: "Set ENABLE_MULTI_TURN=true in the backend .env to enable this endpoint"
      });
    }

    const { turns, metric, provider } = req.body;

    if (!Array.isArray(turns) || turns.length < 2) {
      return res.status(400).json({
        error: "At least 2 turns are required (e.g. one user turn and one assistant turn)"
      });
    }
    for (const t of turns as TurnInput[]) {
      if (!t || (t.role !== "user" && t.role !== "assistant") || !t.content) {
        return res.status(400).json({
          error: "Each turn requires a role ('user' or 'assistant') and non-empty content"
        });
      }
    }

    const rawMetric = metric || "conversation_completeness";
    const isAllMetrics = typeof rawMetric === "string" && rawMetric.toLowerCase() === "all";
    const metricsList: string[] = isAllMetrics
      ? ["all"]
      : Array.isArray(rawMetric)
      ? (rawMetric.length > 0 ? rawMetric : ["conversation_completeness"])
      : [rawMetric];
    const isMultiMetric = !isAllMetrics && metricsList.length > 1;

    // Reject explicitly-requested metrics that are disabled via DISABLED_METRICS
    if (!isAllMetrics) {
      const disabledRequested = metricsList.filter((m) => ENV.DISABLED_METRICS.includes(m.toLowerCase()));
      if (disabledRequested.length > 0) {
        return res.status(403).json({
          error: `Metric(s) disabled: ${disabledRequested.join(", ")}`,
          details: "These metrics are disabled via DISABLED_METRICS in the backend .env"
        });
      }
    }

    try {
      // For "all", expand to the explicit (enabled-only) metric list when any metrics are disabled
      let effectiveMetric: string | string[] = isAllMetrics ? "all" : (isMultiMetric ? metricsList : metricsList[0]);
      if (isAllMetrics && ENV.DISABLED_METRICS.length > 0) {
        try {
          const supported = await getSupportedMetrics();
          effectiveMetric = supported.multiTurn.filter((m) => !ENV.DISABLED_METRICS.includes(m.toLowerCase()));
        } catch (metricsErr) {
          console.warn("Could not fetch supported metrics to filter 'all' - falling back to unfiltered 'all':", metricsErr);
        }
      }

      const evalResult = await evalMultiTurn({
        turns,
        metric: effectiveMetric,
        provider: provider || "groq",
      });

      console.log("DeepEval Multi-Turn Raw Response:", JSON.stringify(evalResult, null, 2));

      if ((isAllMetrics || isMultiMetric) && evalResult.results && Array.isArray(evalResult.results)) {
        const response: any = {
          metric: isAllMetrics ? "all" : "multiple",
          allMetrics: true,
          totalMetrics: evalResult.results.length,
          results: evalResult.results,
          turns,
        };
        if (evalResult.total_usage) response.totalUsage = evalResult.total_usage;
        res.json(response);
      } else {
        let verdict: string | undefined = undefined;
        let usage: any = undefined;
        if (evalResult.results && Array.isArray(evalResult.results) && evalResult.results.length > 0) {
          verdict = evalResult.results[0].verdict;
          usage = evalResult.results[0].usage;
        }

        const response: any = {
          metric: evalResult.metric_name || metricsList[0],
          score: evalResult.score,
          verdict,
          explanation: evalResult.explanation,
          turns,
        };
        if (usage) response.usage = usage;
        res.json(response);
      }
    } catch (error) {
      console.error("DeepEval multi-turn evaluation error:", error);
      res.status(500).json({
        error: "DeepEval multi-turn evaluation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  })
);

/**
 * POST /batch/generate-goldens
 * Synthesize a golden test dataset (query + expected_output + context) from source
 * documents/context using DeepEval's Synthesizer, for use as the seed of a batch evaluation.
 *
 * Request body:
 * {
 *   contexts: string[][] - one inner array = one source document/context group,
 *   maxGoldensPerContext?: number - defaults to 2 (DeepEval's Synthesizer requires >= 2),
 *   includeExpectedOutput?: boolean - defaults to true,
 *   provider?: string
 * }
 *
 * Response: { success: true, goldens: [{ query, expected_output, context }], totalGoldens }
 */
router.post(
  "/batch/generate-goldens",
  asyncHandler(async (req: Request, res: Response) => {
    if (!ENV.ENABLE_GOLDEN_DATASET) {
      return res.status(403).json({
        error: "Golden dataset generation is disabled",
        details: "Set ENABLE_GOLDEN_DATASET=true in the backend .env to enable this endpoint"
      });
    }

    const { contexts, maxGoldensPerContext, includeExpectedOutput, provider } = req.body;

    if (!Array.isArray(contexts) || contexts.length === 0) {
      return res.status(400).json({
        error: "At least one context group is required (contexts: string[][])"
      });
    }
    for (const group of contexts) {
      if (!Array.isArray(group) || group.every((c: string) => !c || !c.trim())) {
        return res.status(400).json({
          error: "Each context group must be a non-empty array containing at least one non-empty string"
        });
      }
    }

    try {
      const result = await generateGoldens({
        contexts,
        maxGoldensPerContext,
        includeExpectedOutput,
        provider: provider || "groq",
      });

      res.json({
        success: true,
        goldens: result.goldens,
        totalGoldens: result.totalGoldens,
        usage: result.usage || undefined,
      });
    } catch (error) {
      console.error("Golden dataset generation error:", error);
      res.status(500).json({
        error: "Golden dataset generation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  })
);

/**
 * POST /batch/upload-excel
 * Upload and parse Excel file for batch evaluation
 * 
 * Request: multipart/form-data with Excel file
 * Response: {
 *   fileName: string,
 *   sheetNames: string[],
 *   datasets: {
 *     sheetName: string,
 *     data: object[],
 *     rowCount: number,
 *     columnNames: string[]
 *   }[],
 *   totalDatasets: number
 * }
 */
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  fileFilter: (req, file, cb) => {
    // Only accept Excel files
    if (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
    }
  },
});

router.post(
  '/batch/upload-excel',
  requireBatchEval,
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please upload an Excel file',
      });
    }

    try {
      console.log(`📁 Processing Excel file: ${req.file.originalname}`);
      
      // Parse the Excel file
      const parseResult = await parseExcelFile(req.file.path);
      
      console.log(`✅ Successfully parsed Excel file with ${parseResult.totalDatasets} total datasets`);
      console.log(`📊 Sheets: ${parseResult.sheetNames.join(', ')}`);

      // Clean up temporary file after parsing
      setTimeout(() => {
        fs.unlink(req.file!.path, (err) => {
          if (err) console.warn('⚠️ Failed to delete temp file:', err);
        });
      }, 1000);

      res.json({
        success: true,
        ...parseResult,
      });
    } catch (error) {
      console.error('❌ Error parsing Excel file:', error);
      
      // Clean up file on error
      if (req.file) {
        fs.unlink(req.file.path, (err) => {
          if (err) console.warn('⚠️ Failed to delete temp file:', err);
        });
      }

      res.status(500).json({
        error: 'Failed to parse Excel file',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /batch/evaluate
 * Run batch evaluation on JSON dataset using metric from each row
 * 
 * Request body:
 * {
 *   jsonData: object[] - array of records from JSON conversion,
 *   metricColumn?: string - name of column containing metric (defaults to "Metrics"),
 *   provider?: string - optional provider override (defaults to "groq")
 * }
 * 
 * Each record should have a "Metrics" column with one of:
 * - faithfulness, answer_relevancy, contextual_precision, contextual_recall,
 *   pii_leakage, bias, hallucination, toxicity
 * 
 * Response: {
 *   success: boolean,
 *   totalRecords: number,
 *   successCount: number,
 *   errorCount: number,
 *   metricsUsed: string[] - unique metrics used,
 *   results: {
 *     rowIndex: number,
 *     originalData: object,
 *     metric_name: string,
 *     score: number,
 *     verdict?: string,
 *     explanation?: string,
 *     error?: string
 *   }[]
 * }
 */
router.post(
  '/batch/evaluate',
  requireBatchEval,
  asyncHandler(async (req: Request, res: Response) => {
    const { jsonData, metricColumn = 'Metrics', provider = 'groq' } = req.body;

    // Validation
    if (!jsonData || !Array.isArray(jsonData) || jsonData.length === 0) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'jsonData must be a non-empty array'
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;
    const metricsUsed = new Set<string>();
    const batchUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 };
    let hasUsage = false;

    console.log(`🔄 Starting batch evaluation using "${metricColumn}" column`);
    console.log(`📊 Processing ${jsonData.length} records...`);

    // Helper function to check if a value is "NA" or empty
    const isNA = (value: any): boolean => {
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') {
        const trimmed = value.trim().toLowerCase();
        return trimmed === 'na' || trimmed === 'n/a' || trimmed === '' || trimmed === 'none';
      }
      return false;
    };

    // Helper to get metric from record, with default fallback
    const getMetric = (record: any): string => {
      const metricValue = record[metricColumn];
      if (metricValue && !isNA(metricValue)) {
        // Normalize metric name: lowercase, trim, consolidate spaces+underscores into single underscore
        return String(metricValue)
          .toLowerCase()
          .trim()
          .replace(/[\s_]+/g, '_'); // Replace all whitespace AND multiple underscores with single underscore
      }
      return 'answer_relevancy'; // Default metric if not specified or NA
    };

    // Process each record
    for (let i = 0; i < jsonData.length; i++) {
      const record = jsonData[i];
      
      try {
        // Get metric for this row
        const metric = getMetric(record);
        metricsUsed.add(metric);

        console.log(`Row ${i + 1}: Metric from record = "${metric}"`, {
          metricsColumn: record[metricColumn],
          allMetricsColumns: Object.keys(record).filter(k => k.toLowerCase().includes('metric'))
        });

        // Build evaluation parameters - only include non-NA fields
        const evalParams: any = {
          metric,
          provider,
        };

        // Extract relevant fields based on metric requirements
        if (record.query && !isNA(record.query)) {
          evalParams.query = record.query;
        }

        if (record.output && !isNA(record.output)) {
          evalParams.output = record.output;
        }

        if (record.context && !isNA(record.context)) {
          // Handle context as array or string
          if (Array.isArray(record.context)) {
            evalParams.context = record.context.filter((c: any) => !isNA(c));
          } else {
            evalParams.context = [record.context];
          }
        }

        if (record.expected_output && !isNA(record.expected_output)) {
          evalParams.expected_output = record.expected_output;
        }

        // Validate that required fields are present for this metric
        const metricsNotRequiringOutput = ['contextual_precision', 'contextual_recall'];
        const metricsRequiringContext = ['faithfulness', 'contextual_precision', 'contextual_recall', 'hallucination'];

        // For "all" metric, skip individual metric validation - Python will validate per metric
        if (metric !== 'all') {
          if (!metricsNotRequiringOutput.includes(metric) && !evalParams.output) {
            throw new Error(`output field is required for ${metric} metric`);
          }

          if (metricsRequiringContext.includes(metric) && (!evalParams.context || evalParams.context.length === 0)) {
            throw new Error(`context field is required for ${metric} metric`);
          }

          if ((metric === 'contextual_precision' || metric === 'contextual_recall') && !evalParams.expected_output) {
            throw new Error(`expected_output field is required for ${metric} metric`);
          }
        } else {
          // For "all" metric, ensure at least output is available (most metrics need it)
          if (!evalParams.output) {
            throw new Error(`output field is required for 'all' metrics`);
          }
        }

        console.log(`Row ${i + 1}: Using metric "${metric}"`);

        // Run evaluation
        const evalResult = await evalWithFields(evalParams);

        if (evalResult.total_usage) {
          hasUsage = true;
          batchUsage.prompt_tokens += evalResult.total_usage.prompt_tokens;
          batchUsage.completion_tokens += evalResult.total_usage.completion_tokens;
          batchUsage.total_tokens += evalResult.total_usage.total_tokens;
          batchUsage.estimated_cost_usd += evalResult.total_usage.estimated_cost_usd;
        }

        // Handle "all" metric - include all results
        if (metric === "all" && evalResult.results && Array.isArray(evalResult.results)) {
          const allMetricsResult = {
            rowIndex: i + 1,
            originalData: record,
            metric_name: "all",
            allMetrics: true,
            totalMetrics: evalResult.results.length,
            metricsResults: evalResult.results,  // Include all metric results
            usage: evalResult.total_usage || undefined,
          };
          results.push(allMetricsResult);
          console.log(`✅ Row ${i + 1} "all" metrics result:`, {
            allMetrics: allMetricsResult.allMetrics,
            totalMetrics: allMetricsResult.totalMetrics,
            metricsCount: allMetricsResult.metricsResults?.length,
            metricsNames: allMetricsResult.metricsResults?.map((m: any) => m.metric_name)
          });
        } else {
          // For single metric, extract first result
          results.push({
            rowIndex: i + 1,
            originalData: record,
            metric_name: evalResult.metric_name || metric,
            score: evalResult.score,
            verdict: evalResult.results?.[0]?.verdict || evalResult.verdict,
            explanation: evalResult.explanation,
            usage: evalResult.results?.[0]?.usage || evalResult.total_usage || undefined,
          });
        }

        successCount++;
        console.log(`✓ Row ${i + 1} (${metric}): Success - ${metric === "all" ? `${evalResult.results?.length || 1} metrics evaluated` : `Score: ${evalResult.score}`}`);

      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        results.push({
          rowIndex: i + 1,
          originalData: record,
          metric_name: 'unknown',
          error: errorMessage,
        });

        console.log(`✗ Row ${i + 1}: Error - ${errorMessage}`);
      }
    }

    console.log(`✅ Batch evaluation completed: ${successCount} success, ${errorCount} errors`);
    console.log(`📊 Metrics used: ${Array.from(metricsUsed).join(', ')}`);

    console.log(`\n📊 BATCH EVALUATION COMPLETE`);
    const allMetricsCount = results.filter((r: any) => r.allMetrics).length;
    console.log(`   Rows with allMetrics=true: ${allMetricsCount}`);
    if (allMetricsCount > 0) {
      const sample: any = results.find((r: any) => r.allMetrics);
      console.log(`   Sample metricsResults:`, sample?.metricsResults?.map((m: any) => ({
        metric: m.metric_name,
        score: m.score,
        verdict: m.verdict
      })));
    }

    res.json({
      success: true,
      totalRecords: jsonData.length,
      successCount,
      errorCount,
      metricsUsed: Array.from(metricsUsed),
      results,
      totalUsage: hasUsage
        ? { ...batchUsage, estimated_cost_usd: Math.round(batchUsage.estimated_cost_usd * 1e6) / 1e6 }
        : undefined,
    });
  })
);

/**
 * POST /batch/generate-report
 * Generate HTML and Excel reports from evaluation results
 * 
 * Request body:
 * {
 *   originalData: object[] - original data from Excel
 *   evaluationResults: object[] - results from /batch/evaluate endpoint
 *   metricsUsed: string[] - metrics that were used
 *   reportType: 'html' | 'excel' | 'both' (optional, defaults to 'both')
 * }
 * 
 * Response (html):
 * - Returns HTML file with charts and detailed results
 * 
 * Response (excel):
 * - Returns Excel workbook with Summary, Results, and Data sheets
 * 
 * Response (both):
 * - Returns ZIP file containing both HTML and Excel
 */
router.post(
  '/batch/generate-report',
  requireBatchEval,
  asyncHandler(async (req: Request, res: Response) => {
    const { originalData, evaluationResults, metricsUsed, reportType = 'both' } = req.body;

    // Validation
    if (!evaluationResults || !Array.isArray(evaluationResults)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'evaluationResults must be an array'
      });
    }

    const successCount = evaluationResults.filter(r => !r.error).length;
    const errorCount = evaluationResults.filter(r => r.error).length;

    const reportData = {
      originalData: originalData || [],
      evaluationResults,
      totalRecords: evaluationResults.length,
      successCount,
      errorCount,
      metricsUsed: metricsUsed || Array.from(new Set(evaluationResults.map((r: any) => r.metric_name))),
    };

    // Debug logging
    console.log(`📄 Generating ${reportType} report(s)...`);
    const allMetricsCount = evaluationResults.filter((r: any) => r.allMetrics || r.metricsResults).length;
    console.log(`   - Total results: ${evaluationResults.length}, All metrics results: ${allMetricsCount}`);
    if (allMetricsCount > 0) {
      const sample = evaluationResults.find((r: any) => r.metricsResults);
      console.log(`   - Sample "all" metrics result:`, {
        allMetrics: sample?.allMetrics,
        totalMetrics: sample?.totalMetrics,
        metricsResultsCount: sample?.metricsResults?.length,
        metricsResultsSample: sample?.metricsResults?.slice(0, 2).map((m: any) => ({
          metric_name: m.metric_name,
          score: m.score,
          verdict: m.verdict
        }))
      });
    }

    try {
      if (reportType === 'html') {
        const htmlContent = generateHTMLReport(reportData);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="evaluation-report.html"');
        res.send(htmlContent);
      } else if (reportType === 'excel') {
        const excelBuffer = await generateExcelReport(reportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="evaluation-report.xlsx"');
        res.send(excelBuffer);
      } else if (reportType === 'both') {
        // For now, send both as separate files
        // In a more advanced implementation, you could create a ZIP file
        const htmlContent = generateHTMLReport(reportData);
        const excelBuffer = await generateExcelReport(reportData);
        
        res.json({
          success: true,
          message: 'Reports generated successfully',
          reports: {
            html: Buffer.from(htmlContent).toString('base64'),
            excel: excelBuffer.toString('base64'),
          }
        });
      }
    } catch (error) {
      console.error('❌ Error generating report:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

/**
 * POST /eval-report
 * Generate an HTML/Excel report for a single (or multi-metric) evaluation result -
 * the same report machinery as /batch/generate-report, applied to one evaluation
 * instead of a batch. Accepts the response shape /eval-only already returns, so the
 * frontend can pass its evaluation result straight through.
 *
 * Request body:
 * {
 *   query?: string, output?: string, context?: string[],
 *   results?: { metric_name, score, verdict, explanation, error }[] - multi-metric case,
 *   metric?: string, metric_name?: string, score?: number, verdict?: string, explanation?: string - single-metric case,
 *   reportType: 'html' | 'excel' | 'both' (optional, defaults to 'html')
 * }
 *
 * Response mirrors /batch/generate-report: streams the file for 'html'/'excel',
 * or returns base64-encoded JSON for 'both'.
 */
router.post(
  '/eval-report',
  asyncHandler(async (req: Request, res: Response) => {
    const { query, output, context, results, metric, metric_name, score, verdict, explanation, reportType = 'html' } = req.body;

    // Normalize into the same per-metric row shape /batch/generate-report already expects
    let metricResults: any[];
    if (Array.isArray(results) && results.length > 0) {
      metricResults = results;
    } else if (metric_name || metric) {
      metricResults = [{ metric_name: metric_name || metric, score, verdict, explanation }];
    } else {
      return res.status(400).json({
        error: 'Invalid request',
        message: "Provide either a 'results' array or single-metric fields (metric_name/score/verdict)"
      });
    }

    const evaluationResults = metricResults.map((r: any, idx: number) => ({
      rowIndex: idx + 1,
      metric_name: r.metric_name,
      score: r.score,
      verdict: r.verdict,
      explanation: r.explanation,
      error: r.error || null,
    }));

    const successCount = evaluationResults.filter(r => !r.error).length;
    const errorCount = evaluationResults.length - successCount;

    const reportData = {
      originalData: [{ query: query || '', output: output || '', context: Array.isArray(context) ? context.join(' | ') : (context || '') }],
      evaluationResults,
      totalRecords: evaluationResults.length,
      successCount,
      errorCount,
      metricsUsed: Array.from(new Set(evaluationResults.map((r: any) => r.metric_name))),
      reportTitle: 'Single Evaluation Report',
    };

    try {
      if (reportType === 'html') {
        const htmlContent = generateHTMLReport(reportData);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="evaluation-report.html"');
        res.send(htmlContent);
      } else if (reportType === 'excel') {
        const excelBuffer = await generateExcelReport(reportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="evaluation-report.xlsx"');
        res.send(excelBuffer);
      } else {
        const htmlContent = generateHTMLReport(reportData);
        const excelBuffer = await generateExcelReport(reportData);

        res.json({
          success: true,
          message: 'Reports generated successfully',
          reports: {
            html: Buffer.from(htmlContent).toString('base64'),
            excel: excelBuffer.toString('base64'),
          }
        });
      }
    } catch (error) {
      console.error('❌ Error generating eval report:', error);
      res.status(500).json({
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
