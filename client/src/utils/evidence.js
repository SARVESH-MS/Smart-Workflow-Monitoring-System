const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export const resolveEvidenceUrl = (value) => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith("/")) return `${API_BASE_URL}${text}`;
  return text;
};

export const getEvidenceReference = (log) => log?.evidenceAttachment?.url || log?.evidenceUrl || "";

export const hasEvidenceReference = (log) => Boolean(String(getEvidenceReference(log) || "").trim());
