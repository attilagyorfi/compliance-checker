/**
 * In-memory analysis queue with retry logic.
 * Pilot-level implementation – suitable for single-instance deployments.
 * For multi-instance production use, replace with a DB-backed queue.
 */

export type QueueJobStatus = "pending" | "running" | "completed" | "failed";

export interface QueueJob {
  id: number; // analysisId
  status: QueueJobStatus;
  retryCount: number;
  lastError?: string;
  startedAt?: Date;
  completedAt?: Date;
}

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

const jobs = new Map<number, QueueJob>();

/**
 * Enqueue an analysis job. If already queued or running, returns existing job.
 */
export function enqueueAnalysis(analysisId: number): QueueJob {
  const existing = jobs.get(analysisId);
  if (existing && (existing.status === "pending" || existing.status === "running")) {
    return existing;
  }
  const job: QueueJob = {
    id: analysisId,
    status: "pending",
    retryCount: 0,
  };
  jobs.set(analysisId, job);
  return job;
}

/**
 * Run an analysis job with automatic retry on failure.
 * The processor function should update the DB status itself.
 */
export async function runWithRetry(
  analysisId: number,
  processor: () => Promise<void>,
  onStatusChange?: (status: QueueJobStatus, error?: string) => void
): Promise<void> {
  const job = jobs.get(analysisId) ?? enqueueAnalysis(analysisId);
  job.status = "running";
  job.startedAt = new Date();
  onStatusChange?.("running");

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await processor();
      job.status = "completed";
      job.completedAt = new Date();
      onStatusChange?.("completed");
      return;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      job.lastError = errorMsg;
      job.retryCount = attempt + 1;

      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[Queue] Analysis ${analysisId} failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay}ms: ${errorMsg}`
        );
        await sleep(delay);
      } else {
        job.status = "failed";
        job.completedAt = new Date();
        onStatusChange?.("failed", errorMsg);
        throw err;
      }
    }
  }
}

/**
 * Get the current status of a queued job.
 */
export function getJobStatus(analysisId: number): QueueJob | undefined {
  return jobs.get(analysisId);
}

/**
 * Remove a completed or failed job from the queue.
 */
export function clearJob(analysisId: number): void {
  jobs.delete(analysisId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
