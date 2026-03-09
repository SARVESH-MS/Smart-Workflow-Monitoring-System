const firstHeaderValue = (value) => {
  if (!value) return "";
  if (Array.isArray(value)) return value[0] || "";
  return String(value).split(",")[0].trim();
};

export const getClientIp = (req) => {
  const forwardedIp = firstHeaderValue(req.headers["x-forwarded-for"]);
  const realIp = firstHeaderValue(req.headers["x-real-ip"]);
  const cloudflareIp = firstHeaderValue(req.headers["cf-connecting-ip"]);
  const ip = cloudflareIp || forwardedIp || realIp || req.ip || req.socket?.remoteAddress || "-";
  return String(ip).replace("::ffff:", "");
};

const detectOs = (ua) => {
  if (/windows/i.test(ua)) return "Windows";
  if (/android/i.test(ua)) return "Android";
  if (/(iphone|ipad|ipod|ios)/i.test(ua)) return "iOS";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Unknown OS";
};

const detectBrowser = (ua) => {
  if (/edg\//i.test(ua)) return "Edge";
  if (/opr\//i.test(ua)) return "Opera";
  if (/chrome\//i.test(ua)) return "Chrome";
  if (/firefox\//i.test(ua)) return "Firefox";
  if (/safari\//i.test(ua)) return "Safari";
  return "Unknown Browser";
};

const detectDeviceType = (ua) => {
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  if (/mobile|android|iphone|ipod/i.test(ua)) return "Mobile";
  return "Desktop";
};

export const getDeviceName = (req) => {
  const ua = String(req.headers["user-agent"] || "");
  const type = detectDeviceType(ua);
  const os = detectOs(ua);
  const browser = detectBrowser(ua);
  return `${type} • ${os} • ${browser}`;
};

export const getRequestMeta = (req) => ({
  ip: getClientIp(req),
  ua: String(req.headers["user-agent"] || "-"),
  deviceName: getDeviceName(req)
});
