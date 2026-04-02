import React from "react";

const REVIEW_STYLES = {
  empty: {
    badge: "border-slate-300 bg-slate-100 text-slate-800",
    card: "border-slate-300/80 bg-slate-50/90 text-slate-900"
  },
  none: {
    badge: "border-emerald-300 bg-emerald-100 text-emerald-950",
    card: "border-emerald-300/70 bg-emerald-50/80 text-slate-900"
  },
  warning: {
    badge: "border-amber-300 bg-amber-100 text-amber-950",
    card: "border-amber-300/70 bg-amber-50/85 text-slate-900"
  },
  high: {
    badge: "border-red-300 bg-red-100 text-red-950",
    card: "border-red-300/80 bg-red-50/90 text-slate-900"
  }
};

const labelForRisk = (riskLevel, review) => {
  if (Number(review?.checkedLogs || 0) === 0) return "Awaiting submissions";
  if (riskLevel === "high" && Number(review?.taskAlignmentScore || 0) <= 0.05) {
    return "Strong task mismatch";
  }
  if (riskLevel === "high") return "High review risk";
  if (riskLevel === "warning") return "Needs review";
  return "Looks healthy";
};

const formatSimilarity = (value) => `${Math.round(Number(value || 0) * 100)}%`;
const getFlagMessageClass = (flag, compact = false) => {
  if (flag?.type === "reused_evidence" || flag?.type === "task_scope_mismatch") {
    return compact
      ? "text-red-950 font-medium"
      : "rounded-lg border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-950";
  }
  return compact
    ? "text-amber-950 font-medium"
    : "rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-950";
};

const getFlagLabel = (flag) => {
  if (flag?.type === "task_scope_mismatch") return "Task mismatch";
  if (flag?.type === "reused_evidence") return "Reused evidence";
  if (flag?.type === "evidence_type_mismatch") return "Evidence type mismatch";
  if (flag?.type === "invalid_evidence_reference") return "Invalid evidence";
  if (flag?.type === "missing_evidence") return "Missing evidence";
  return "Review note";
};

const getMetricCardClass = (tone = "default") => {
  if (tone === "high") return "rounded-lg border border-red-300 bg-red-100 px-3 py-2";
  if (tone === "warning") return "rounded-lg border border-amber-300 bg-amber-100 px-3 py-2";
  return "rounded-lg border border-slate-200 bg-white/75 px-3 py-2";
};

const TaskProgressReview = ({ review, compact = false }) => {
  const safeReview = review || {
    scopeLabel: "All submissions",
    checkedLogs: 0,
    riskLevel: "none",
    flags: []
  };
  const isEmptyReview = Number(safeReview.checkedLogs || 0) === 0;
  const styles = isEmptyReview ? REVIEW_STYLES.empty : REVIEW_STYLES[safeReview.riskLevel] || REVIEW_STYLES.none;
  const hasFlags = Array.isArray(safeReview.flags) && safeReview.flags.length > 0;
  const taskAlignmentScore = Number(safeReview.taskAlignmentScore || 0);
  const latestSimilarityScore = Number(safeReview.latestSimilarityScore || 0);
  const scopeLabel = safeReview.scopeLabel
    ? String(safeReview.scopeLabel)
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "All submissions";

  if (compact) {
    return (
      <div className={`mt-2 min-w-0 rounded-xl border p-3 text-xs ${styles.card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${styles.badge}`}>
            {labelForRisk(safeReview.riskLevel, safeReview)}
          </span>
          <span className="text-slate-700">
            {safeReview.checkedLogs} update{safeReview.checkedLogs === 1 ? "" : "s"} checked
          </span>
        </div>
        {hasFlags ? (
          <div className={`mt-2 leading-5 ${getFlagMessageClass(safeReview.flags[0], true)}`}>
            {safeReview.flags[0]?.message}
          </div>
        ) : isEmptyReview ? (
          <div className="mt-2 text-slate-700">No progress submissions have been reviewed yet.</div>
        ) : (
          <div className="mt-2 text-slate-700">Submission history looks healthy.</div>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${styles.card}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-600">Submission Review</div>
          <div className="mt-1 text-sm font-semibold text-slate-950">{labelForRisk(safeReview.riskLevel, safeReview)}</div>
        </div>
        <span className="rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-slate-800">
          {scopeLabel}
        </span>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-slate-900 sm:grid-cols-2 xl:grid-cols-5">
        <div className={getMetricCardClass()}>
          Updates checked: {safeReview.checkedLogs}
        </div>
        <div className={getMetricCardClass((safeReview.repeatedEvidenceCount || 0) > 0 ? "high" : "default")}>
          Reused evidence: {safeReview.repeatedEvidenceCount || 0}
        </div>
        <div className={getMetricCardClass((safeReview.similarUpdateCount || 0) > 0 ? "warning" : "default")}>
          Similar updates: {safeReview.similarUpdateCount || 0}
        </div>
        <div className={getMetricCardClass(latestSimilarityScore >= 0.68 ? "warning" : "default")}>
          Highest similarity: {formatSimilarity(latestSimilarityScore)}
        </div>
        <div className={getMetricCardClass(isEmptyReview ? "default" : taskAlignmentScore <= 0.12 ? "high" : taskAlignmentScore <= 0.35 ? "warning" : "default")}>
          Task alignment: {formatSimilarity(taskAlignmentScore)}
        </div>
      </div>

      {hasFlags ? (
        <div className="mt-3 grid gap-2">
          {safeReview.flags.map((flag) => (
            <div
              key={`${flag.type}-${flag.message}`}
              className={getFlagMessageClass(flag)}
            >
              <div className="font-medium">{getFlagLabel(flag)}</div>
              <div className="mt-1">{flag.message}</div>
            </div>
          ))}
        </div>
      ) : isEmptyReview ? (
        <div className="mt-3 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-800">
          No progress submissions have been reviewed yet. This panel will summarize proof quality after the employee uploads progress evidence.
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-emerald-300 bg-emerald-100/75 px-3 py-2 text-sm text-emerald-950">
          Submission history looks healthy. This is still a review aid, not a final proof of code quality or product correctness.
        </div>
      )}
    </div>
  );
};

export default TaskProgressReview;
