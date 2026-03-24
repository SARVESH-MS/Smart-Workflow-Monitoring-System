const SESSION_ID_KEY = "swms_session_id";

const generateSessionId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `swms-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getSessionId = () => {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }
  return sessionId;
};

export const setAuth = (token, user) => {
  sessionStorage.setItem("swms_token", token);
  sessionStorage.setItem("swms_user", JSON.stringify(user));
};

export const clearAuth = () => {
  sessionStorage.removeItem("swms_token");
  sessionStorage.removeItem("swms_user");
  sessionStorage.removeItem(SESSION_ID_KEY);
  localStorage.removeItem("swms_token");
  localStorage.removeItem("swms_user");
};

export const getToken = () => sessionStorage.getItem("swms_token");

export const getUser = () => {
  const raw = sessionStorage.getItem("swms_user");
  return raw ? JSON.parse(raw) : null;
};
