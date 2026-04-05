const normalizeCountryCode = (value) => {
  if (!value) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
};

export const normalizePhoneNumber = (raw, defaultCountryCode = process.env.DEFAULT_PHONE_COUNTRY_CODE) => {
  const input = String(raw || "").trim();
  if (!input) return "";
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";

  if (input.startsWith("+")) {
    return `+${digits}`;
  }

  const defaultCode = normalizeCountryCode(defaultCountryCode);
  if (defaultCode) {
    const codeDigits = defaultCode.replace(/\D/g, "");
    if (codeDigits && digits.startsWith(codeDigits) && digits.length > 10) {
      return `+${digits}`;
    }
    return `${defaultCode}${digits}`;
  }

  return `+${digits}`;
};
