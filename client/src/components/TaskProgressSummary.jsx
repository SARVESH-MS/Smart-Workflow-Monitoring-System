import React from "react";
import { getEvidenceReference, resolveEvidenceUrl } from "../utils/evidence.js";

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
  pass: "border-emerald-300 bg-emerald-100 text-emerald-950",
  warning: "border-amber-300 bg-amber-100 text-amber-950",
  fail: "border-rose-300 bg-rose-100 text-rose-950"
};

const VERIFICATION_LABELS = {
  pass: "Proof verified",
  warning: "Proof needs review",
  fail: "Proof failed"
};

const truncate = (value, max = 96) => {
  const text = String(value || "").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
};

const TaskProgressSummary = ({ progressLogs = [], latestProgressLog = null, showEvidence = true, compact = false }) => {
  const latest =
    latestProgressLog || (Array.isArray(progressLogs) && progressLogs.length > 0 ? progressLogs[progressLogs.length - 1] : null);

  if (!latest) {
    return <div className="text-xs text-orange-300">No daily progress update yet.</div>;
  }

  const evidenceReference = getEvidenceReference(latest);
  const evidenceHref = resolveEvidenceUrl(evidenceReference);
  const evidenceLabel = latest?.evidenceAttachment?.filename ? `Evidence file: ${latest.evidenceAttachment.filename}` : "Evidence link";
  const verificationStatus = latest?.verification?.status || "";
  const verificationLabel = VERIFICATION_LABELS[verificationStatus] || "";
  const verificationStyle = VERIFICATION_STYLES[verificationStatus] || "";
  const notePreview = truncate(latest.note, compact ? 52 : 96);
  const areaPreview = truncate(latest.affectedArea, compact ? 32 : 88);

  if (compact) {
    return (
      <div className="min-w-0 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium text-slate-100">{new Date(latest.loggedAt).toLocaleString()}</div>
          {verificationStatus ? (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${verificationStyle}`}>
              {verificationLabel}
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[10px] text-slate-300">
            {WORK_TYPE_LABELS[latest.workType] || latest.workType || "Work"}
          </span>
          <span className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[10px] text-slate-300">
            {PROGRESS_STATE_LABELS[latest.progressState] || latest.progressState || "Update"}
          </span>
          <span className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[10px] text-slate-300">
            {EVIDENCE_TYPE_LABELS[latest.evidenceType] || latest.evidenceType || "Evidence"}
          </span>
        </div>
        {latest.affectedArea ? (
          <div className="mt-2 text-[10px] font-medium uppercase tracking-wide text-slate-700">
            {areaPreview}
          </div>
        ) : null}
        <div className="mt-1 text-[11px] leading-4 text-slate-700">{notePreview}</div>
        {showEvidence && evidenceReference ? (
          <a
            className="mt-2 inline-flex items-center text-[11px] font-medium text-blue-400 hover:text-blue-300 hover:underline"
            href={evidenceHref}
            target="_blank"
            rel="noreferrer"
          >
            Open proof
          </a>
        ) : null}
      </div>
    );
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
        {verificationStatus ? (
          <span className={`rounded-full border px-2 py-0.5 text-[11px] ${verificationStyle}`}>
            {verificationLabel}
          </span>
        ) : null}
      </div>
      {latest.affectedArea ? (
        <div className="mt-2 break-words text-[11px] uppercase tracking-wide text-slate-700">
          Area: {areaPreview}
        </div>
      ) : null}
      <div className="mt-1 break-words text-slate-700">{notePreview}</div>
      {showEvidence && evidenceReference && (
        <a
          className="mt-1 inline-block break-all text-blue-400 hover:text-blue-300 hover:underline"
          href={evidenceHref}
          target="_blank"
          rel="noreferrer"
        >
          {evidenceLabel}
        </a>
      )}
      {latest?.verification?.summary ? (
        <div className="mt-2 text-[11px] text-slate-700">{latest.verification.summary}</div>
      ) : null}
    </div>
  );
};

export default TaskProgressSummary;
