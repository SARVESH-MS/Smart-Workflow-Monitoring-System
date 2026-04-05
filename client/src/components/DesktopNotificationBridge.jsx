import React, { useEffect, useRef } from "react";
import { listMyNotifications } from "../api/notifications.js";

const STORAGE_KEY = "swms_desktop_notification_ids";
const ANCHOR_KEY = "swms_desktop_notification_anchor";
const POLL_MS = 20000;

const desktopNotificationTypes = new Set([
  "task.progress.missing",
  "task.delay",
  "task.complete",
  "task.assigned"
]);

const shouldShowDesktopNotification = (notification, user) => {
  if (!notification || !user?.notificationPrefs?.desktopDailyProgress) return false;
  return desktopNotificationTypes.has(notification.type);
};

const showDesktopNotification = (notification) => {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (window.Notification.permission !== "granted") return;
  const popup = new window.Notification(notification.title || "SWMS reminder", {
    body: notification.message || "",
    tag: notification._id,
    renotify: true
  });
  popup.onclick = () => {
    window.focus();
    popup.close();
  };
};

const getUserKey = (userId, base) => `${base}:${userId || "unknown"}`;

const getShownIds = (userId) => {
  try {
    const raw = localStorage.getItem(getUserKey(userId, STORAGE_KEY));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveShownId = (userId, id) => {
  if (!id) return;
  const next = [id, ...getShownIds(userId).filter((item) => item !== id)].slice(0, 25);
  localStorage.setItem(getUserKey(userId, STORAGE_KEY), JSON.stringify(next));
};

const getAnchor = (userId) => {
  const raw = localStorage.getItem(getUserKey(userId, ANCHOR_KEY));
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

const setAnchor = (userId, value) => {
  if (!value) return;
  const iso = new Date(value).toISOString();
  localStorage.setItem(getUserKey(userId, ANCHOR_KEY), iso);
};

const DesktopNotificationBridge = ({ user }) => {
  const timerRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return undefined;
    if (!user?.notificationPrefs?.desktopDailyProgress) return undefined;

    if (window.Notification.permission === "default") {
      void window.Notification.requestPermission().catch(() => null);
    }

    const poll = async () => {
      try {
        const items = await listMyNotifications();
        if (!Array.isArray(items) || items.length === 0) return;
        const userId = String(user?.id || user?._id || "");
        const anchor = getAnchor(userId);
        const newest = items[0]?.createdAt || items[0]?.created_at;

        if (!anchor && newest) {
          setAnchor(userId, newest);
          return;
        }

        const candidates = items
          .filter((item) => shouldShowDesktopNotification(item, user))
          .filter((item) => {
            const createdAt = Date.parse(item?.createdAt || item?.created_at || 0);
            return anchor ? createdAt > anchor : true;
          })
          .filter((item) => !getShownIds(userId).includes(item._id))
          .sort((a, b) => Date.parse(a.createdAt || a.created_at || 0) - Date.parse(b.createdAt || b.created_at || 0));

        const next = candidates[0];
        if (next?._id) {
          showDesktopNotification(next);
          saveShownId(userId, next._id);
          const nextCreated = next.createdAt || next.created_at;
          if (nextCreated) {
            setAnchor(userId, nextCreated);
          }
        }
      } catch {
        // Ignore desktop notification polling failures.
      }
    };

    void poll();
    timerRef.current = window.setInterval(() => {
      void poll();
    }, POLL_MS);

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [user]);

  return null;
};

export default DesktopNotificationBridge;
