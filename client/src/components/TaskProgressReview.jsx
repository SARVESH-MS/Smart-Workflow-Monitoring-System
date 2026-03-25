import React from "react";

const REVIEW_STYLES = {
  none: {
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    card: "border-emerald-500/20 bg-emerald-500/5 text-emerald-100"
  },
  warning: {
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    card: "border-amber-500/20 bg-amber-500/5 text-amber-100"
  },
  high: {
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    card: "border-rose-500/20 bg-rose-500/5 text-rose-100"
  }
};

const labelForRisk = (riskLevel) => {
  if (riskLevel === "high") return "High review risk";
  if (riskLevel === "warning") return "Needs review";
  return "Looks healthy";
};

const formatSimilarity = (value) => `${Math.round(Number(value || 0) * 100)}%`;

const TaskProgressReview = ({ review, compact = false }) => {
  const safeReview = review || {
    windowDays: 7,
    checkedLogs: 0,
    riskLevel: "none",
    flags: []
  };
  const styles = REVIEW_STYLES[safeReview.riskLevel] || REVIEW_STYLES.none;
  const hasFlags = Array.isArray(safeReview.flags) && safeReview.flags.length > 0;

  if (compact) {
    return (
      <div className="mt-2 min-w-0 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}>
            {labelForRisk(safeReview.riskLevel)}
          </span>
          <span className="text-slate-500">
            {safeReview.checkedLogs} update{safeReview.checkedLogs === 1 ? "" : "s"} checked in last {safeReview.windowDays} days
          </span>
        </div>
        {hasFlags ? <div className="mt-1 text-amber-200">{safeReview.flags[0]?.message}</div> : null}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${styles.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">Weekly Review</div>
          <div className="mt-1 text-sm font-semibold">{labelForRisk(safeReview.riskLevel)}</div>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${styles.badge}`}>
          Last {safeReview.windowDays} days
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2">
          Updates checked: {safeReview.checkedLogs}
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2">
          Reused evidence: {safeReview.repeatedEvidenceCount || 0}
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2">
          Similar updates: {safeReview.similarUpdateCount || 0}
        </div>
        <div className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2">
          Highest similarity: {formatSimilarity(safeReview.latestSimilarityScore)}
        </div>
      </div>

      {hasFlags ? (
        <div className="mt-3 grid gap-2">
          {safeReview.flags.map((flag) => (
            <div
              key={`${flag.type}-${flag.message}`}
              className="rounded-lg border border-white/10 bg-slate-950/25 px-3 py-2 text-sm text-slate-100"
            >
              {flag.message}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-emerald-500/15 bg-slate-950/25 px-3 py-2 text-sm text-slate-100">
          Recent updates show enough variation for this 7-day check. This is a review aid, not a final proof of quality.
        </div>
      )}
    </div>
  );
};

export default TaskProgressReview;
