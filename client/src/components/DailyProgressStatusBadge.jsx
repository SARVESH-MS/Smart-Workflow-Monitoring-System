import React from "react";

const STATUS_STYLES = {
  with_proof: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  without_proof: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  missing: "border-rose-500/30 bg-rose-500/10 text-rose-300"
};

const DailyProgressStatusBadge = ({ status, showMessage = true }) => {
  const safeStatus = status || {
    state: "missing",
    label: "Missing today",
    message: "Today's progress has not been uploaded yet."
  };
  const badgeStyle = STATUS_STYLES[safeStatus.state] || STATUS_STYLES.missing;

  return (
    <div className="min-w-0 text-xs">
      <span className={`inline-flex rounded-full border px-2.5 py-1 font-medium ${badgeStyle}`}>
        {safeStatus.label}
      </span>
      {showMessage ? <div className="mt-1 break-words text-slate-400">{safeStatus.message}</div> : null}
    </div>
  );
};

export default DailyProgressStatusBadge;
