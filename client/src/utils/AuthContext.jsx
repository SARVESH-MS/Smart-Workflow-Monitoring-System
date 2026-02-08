import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getToken, getUser, setAuth, clearAuth } from "./auth.js";
import { me } from "../api/auth.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getUser());
  const [token, setToken] = useState(getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (token) {
        try {
          const data = await me();
          setUser(data.user);
          setAuth(token, data.user);
        } catch {
          clearAuth();
          setUser(null);
          setToken(null);
        }
      }
      setLoading(false);
    };
    init();
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      setSession: (tokenValue, userValue) => {
        setToken(tokenValue);
        setUser(userValue);
        setAuth(tokenValue, userValue);
      },
      logout: () => {
        clearAuth();
        setUser(null);
        setToken(null);
      }
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
