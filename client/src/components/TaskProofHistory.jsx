import React from "react";
import { getEvidenceReference, hasEvidenceReference, resolveEvidenceUrl } from "../utils/evidence.js";

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

const VERIFICATION_STYLES = {
  pass: "border-emerald-700/60 bg-emerald-950/70 text-emerald-100",
  warning: "border-amber-700/60 bg-amber-950/60 text-amber-100",
  fail: "border-rose-700/60 bg-rose-950/60 text-rose-100"
};

const VERIFICATION_LABELS = {
  pass: "Pass",
  warning: "Needs review",
  fail: "Fail"
};

const TaskProofHistory = ({ task, onRecheckLog = null, recheckingEntryId = "" }) => {
  const proofLogs = [...(task?.progressLogs || [])]
    .filter(hasEvidenceReference)
    .sort((left, right) => new Date(right.loggedAt) - new Date(left.loggedAt));

  if (proofLogs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        No previous proof submissions yet for this task.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {proofLogs.map((log, index) => {
        const evidenceReference = getEvidenceReference(log);
        const evidenceHref = resolveEvidenceUrl(evidenceReference);
        const evidenceLabel = log?.evidenceAttachment?.filename ? `Open file: ${log.evidenceAttachment.filename}` : "Open proof link";

        return (
          <div key={`${task?._id || "task"}-proof-${index}`} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="text-xs text-slate-500">{new Date(log.loggedAt).toLocaleString()}</div>
            {onRecheckLog && log?.entryId ? (
              <button
                className="btn-ghost px-2 py-1 text-xs"
                type="button"
                disabled={recheckingEntryId === log.entryId}
                onClick={() => onRecheckLog(log)}
              >
                {recheckingEntryId === log.entryId ? "Rechecking..." : "Recheck proof"}
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
              {WORK_TYPE_LABELS[log.workType] || log.workType || "Work"}
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
              {PROGRESS_STATE_LABELS[log.progressState] || log.progressState || "Update"}
            </span>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300">
              {EVIDENCE_TYPE_LABELS[log.evidenceType] || log.evidenceType || "Evidence"}
            </span>
            {log?.verification?.status ? (
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${VERIFICATION_STYLES[log.verification.status] || ""}`}>
                Verification: {VERIFICATION_LABELS[log.verification.status] || log.verification.status}
              </span>
            ) : null}
          </div>
          {log.affectedArea ? (
            <div className="mt-2 text-[11px] uppercase tracking-wide text-slate-500">
              Area: {log.affectedArea}
            </div>
          ) : null}
          <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">{log.note || "No notes provided."}</div>
          <a
            className="mt-3 inline-block break-all text-sm text-blue-400 hover:text-blue-300 hover:underline"
            href={evidenceHref}
            target="_blank"
            rel="noreferrer"
          >
            {evidenceLabel}
          </a>
          {log?.verification?.summary ? (
            <div className="mt-3 rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2 text-xs text-slate-300">
              <div className="font-medium text-slate-100">{log.verification.summary}</div>
              {(log.verification.checks || []).length > 0 ? (
                <div className="mt-2 grid gap-1">
                  {log.verification.checks.map((check) => (
                    <div key={`${check.label}-${check.message}`} className="text-slate-400">
                      {check.label}: {check.message}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default TaskProofHistory;
