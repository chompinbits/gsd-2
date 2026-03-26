import { writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AccountingConfig, PremiumRequestSummary } from "./types.js";
import type { RequestTracker } from "./request-tracker.js";

/**
 * Returns a formatted line for a single stage entry in the premium request summary.
 * Stage name is padded to 12 chars; numbers are right-aligned.
 * Example: "  plan           3         0.99"
 */
export function formatStageLine(
  stage: string,
  data: { count: number; premiumCost: number },
): string {
  const stagePadded = stage.padEnd(12);
  const countStr = String(data.count).padStart(8);
  const costStr = data.premiumCost.toFixed(2).padStart(12);
  return `  ${stagePadded}  ${countStr}  ${costStr}`;
}

/**
 * Returns a multi-line formatted premium request summary block.
 * Includes per-stage breakdown, totals, budget usage percentage, and a visual bar.
 * Pass `downgrades` to include model downgrade events in the output (D-12).
 */
export function formatPremiumSummary(
  summary: PremiumRequestSummary,
  config: AccountingConfig,
  downgrades?: Array<{ originalModel: string; downgradedTo: string; percentUsed: number }>,
): string {
  const header = "Premium Request Summary";
  const divider = "═".repeat(header.length);
  const colHeader = `  ${"Stage".padEnd(12)}  ${"Requests".padStart(8)}  ${"Premium Cost".padStart(12)}`;
  const separator = `  ${"─".repeat(12)}  ${"─".repeat(8)}  ${"─".repeat(12)}`;

  const stageLines = Object.entries(summary.byStage)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stage, data]) => formatStageLine(stage, data));

  const totalLine =
    `  ${"Total".padEnd(12)}  ${String(summary.totalRequests).padStart(8)}  ${summary.totalPremiumCost.toFixed(2).padStart(12)}`;

  const budgetLine =
    config.budgetLimit > 0
      ? `Budget: ${summary.totalPremiumCost.toFixed(2)} / ${config.budgetLimit} (${summary.budgetPercentUsed.toFixed(1)}%)`
      : `Budget: ${summary.totalPremiumCost.toFixed(2)} / unlimited`;

  const barWidth = 20;
  const filled =
    config.budgetLimit > 0
      ? Math.round((summary.budgetPercentUsed / 100) * barWidth)
      : 0;
  const bar = `[${"█".repeat(filled)}${"░".repeat(barWidth - filled)}] ${summary.budgetPercentUsed.toFixed(1)}%`;

  const lines = [
    header,
    divider,
    colHeader,
    separator,
    ...stageLines,
    separator,
    totalLine,
    budgetLine,
    bar,
  ];

  if (downgrades && downgrades.length > 0) {
    lines.push("");
    lines.push("Model downgrades:");
    for (const d of downgrades) {
      lines.push(`  ${d.originalModel} → ${d.downgradedTo} (at ${d.percentUsed.toFixed(1)}% budget)`);
    }
  }

  return lines.join("\n");
}

/**
 * Persists the current tracker state to {sessionDir}/accounting.json.
 * Idempotent — overwrites on each call (latest state wins).
 */
export async function persistSessionAccounting(
  tracker: RequestTracker,
  sessionDir: string,
): Promise<void> {
  const filePath = join(sessionDir, "accounting.json");
  await writeFile(filePath, JSON.stringify(tracker.toJSON(), null, 2), "utf-8");
}

/**
 * Loads a persisted RequestTracker from {sessionDir}/accounting.json.
 * Returns null if the file does not exist or cannot be parsed.
 */
export async function loadPersistedAccounting(
  sessionDir: string,
  sessionId: string,
): Promise<RequestTracker | null> {
  const { RequestTracker } = await import("./request-tracker.js");
  const filePath = join(sessionDir, "accounting.json");
  try {
    const raw = await readFile(filePath, "utf-8");
    const data: unknown = JSON.parse(raw);
    return RequestTracker.fromJSON(data, sessionId);
  } catch {
    return null;
  }
}
