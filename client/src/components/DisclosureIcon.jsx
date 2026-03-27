import React from "react";

const DisclosureIcon = ({ open }) => (
  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center" aria-hidden="true">
    <svg
      viewBox="0 0 64 64"
      className={`h-6 w-6 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
    >
      <rect x="9" y="9" width="46" height="46" rx="12" fill="#11181d" stroke="#11181d" strokeWidth="1.5" />
      <rect x="6" y="6" width="52" height="52" rx="15" stroke="#f8fafc" strokeWidth="2.4" />
      <rect x="8.5" y="8.5" width="47" height="47" rx="13" stroke="#0f172a" strokeWidth="1.4" opacity="0.75" />
      <path d="M32 40 19 26h26L32 40Z" fill="#f8fafc" />
    </svg>
  </span>
);

export default DisclosureIcon;
