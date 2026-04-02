import React from "react";

const STATUS_STYLES = {
  with_proof: "border-emerald-300 bg-emerald-100 text-emerald-950",
  without_proof: "border-amber-300 bg-amber-100 text-amber-950",
  missing: "border-rose-300 bg-rose-100 text-rose-950"
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
      {showMessage ? <div className="mt-1 break-words text-slate-700">{safeStatus.message}</div> : null}
    </div>
  );
};

export default DailyProgressStatusBadge;
