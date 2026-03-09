export const setAuth = (token, user) => {
  sessionStorage.setItem("swms_token", token);
  sessionStorage.setItem("swms_user", JSON.stringify(user));
};

export const clearAuth = () => {
  sessionStorage.removeItem("swms_token");
  sessionStorage.removeItem("swms_user");
  localStorage.removeItem("swms_token");
  localStorage.removeItem("swms_user");
};

export const getToken = () => sessionStorage.getItem("swms_token");

export const getUser = () => {
  const raw = sessionStorage.getItem("swms_user");
  return raw ? JSON.parse(raw) : null;
};
