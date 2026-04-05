import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getToken, getUser, setAuth, clearAuth } from "./auth.js";
import { me, logout as logoutApi } from "../api/auth.js";
import { createSocket } from "./socket.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => getUser());
  const [token, setToken] = useState(() => getToken());
  const [loading, setLoading] = useState(() => Boolean(getToken() && !getUser()));

  useEffect(() => {
    const init = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      // If we already have a cached session, render immediately and revalidate in the background.
      if (user) {
        setLoading(false);
      } else {
        setLoading(true);
      }

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

  useEffect(() => {
    const handleUserUpdated = (event) => {
      const nextUser = event?.detail;
      if (!nextUser) return;
      setUser(nextUser);
      if (token) {
        setAuth(token, nextUser);
      }
    };
    window.addEventListener("swms:user-updated", handleUserUpdated);
    return () => window.removeEventListener("swms:user-updated", handleUserUpdated);
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = createSocket();
    socket.on("user:updated", (nextUser) => {
      if (!nextUser) return;
      const nextUserId = String(nextUser.id || nextUser._id || "");
      const currentUserId = String(user?.id || user?._id || "");
      if (!nextUserId || nextUserId !== currentUserId) return;
      setUser(nextUser);
      setAuth(token, nextUser);
    });
    return () => socket.disconnect();
  }, [token, user?.id, user?._id]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      setSession: (tokenValue, userValue) => {
        setToken(tokenValue);
        setUser(userValue);
        setAuth(tokenValue, userValue);
        setLoading(false);
      },
      updateCurrentUser: (nextUser) => {
        setUser(nextUser);
        if (token) {
          setAuth(token, nextUser);
        }
      },
      logout: async () => {
        if (token) {
          try {
            await logoutApi();
          } catch {
            // Session is client-side JWT; always clear local auth even if API fails.
          }
        }
        clearAuth();
        setUser(null);
        setToken(null);
        setLoading(false);
      }
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
