export const setAuth = (token, user) => {
  localStorage.setItem("swms_token", token);
  localStorage.setItem("swms_user", JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem("swms_token");
  localStorage.removeItem("swms_user");
};

export const getToken = () => localStorage.getItem("swms_token");

export const getUser = () => {
  const raw = localStorage.getItem("swms_user");
  return raw ? JSON.parse(raw) : null;
};
