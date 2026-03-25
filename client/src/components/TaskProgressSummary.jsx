import React from "react";

const WORK_TYPE_LABELS = {
  design: "Design",
  frontend: "Frontend",
  backend: "Backend",
  testing: "Testing",
  documentation: "Documentation",
  integration: "Integration",
  bugfix: "Bug Fix",
  review: "Review",
  deployment: "Deployment",
  research: "Research",
  other: "Other"
};

const PROGRESS_STATE_LABELS = {
  started: "Started",
  partial: "Partial",
  completed: "Completed",
  blocked: "Blocked"
};

const EVIDENCE_TYPE_LABELS = {
  none: "No Link",
  commit: "Commit",
  screenshot: "Screenshot",
  preview: "Preview",
  figma: "Figma",
  api_test: "API/Test",
  document: "Document",
  issue: "Issue",
  other: "Other"
};

const truncate = (value, max = 96) => {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
};

const TaskProgressSummary = ({ progressLogs = [], showEvidence = true }) => {
  const latest = Array.isArray(progressLogs) && progressLogs.length > 0 ? progressLogs[progressLogs.length - 1] : null;

  if (!latest) {
    return <div className="text-xs text-rose-300">No daily progress update yet.</div>;
  }

  return (
    <div className="min-w-0 text-xs text-slate-400">
      <div className="font-medium text-slate-200">{new Date(latest.loggedAt).toLocaleString()}</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
          {WORK_TYPE_LABELS[latest.workType] || latest.workType || "Work"}
        </span>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
          {PROGRESS_STATE_LABELS[latest.progressState] || latest.progressState || "Update"}
        </span>
        <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
          {EVIDENCE_TYPE_LABELS[latest.evidenceType] || latest.evidenceType || "Evidence"}
        </span>
      </div>
      {latest.affectedArea ? (
        <div className="mt-2 break-words text-[11px] uppercase tracking-wide text-slate-500">
          Area: {latest.affectedArea}
        </div>
      ) : null}
      <div className="mt-1 break-words text-slate-400">{truncate(latest.note)}</div>
      {showEvidence && latest.evidenceUrl && (
        <a
          className="mt-1 inline-block break-all text-blue-400 hover:text-blue-300 hover:underline"
          href={latest.evidenceUrl}
          target="_blank"
          rel="noreferrer"
        >
          Evidence link
        </a>
      )}
    </div>
  );
};

export default TaskProgressSummary;
