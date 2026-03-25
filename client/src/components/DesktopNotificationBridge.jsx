import React, { useEffect, useRef } from "react";
import { listMyNotifications } from "../api/notifications.js";

const STORAGE_KEY = "swms_desktop_notification_ids";
const POLL_MS = 20000;

const shouldShowDesktopNotification = (notification, user) => {
  if (!notification || !user?.notificationPrefs?.desktopDailyProgress) return false;
  return notification.type === "task.progress.missing";
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

const getShownIds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveShownId = (id) => {
  if (!id) return;
  const next = [id, ...getShownIds().filter((item) => item !== id)].slice(0, 25);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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
        const eligible = Array.isArray(items)
          ? items.find((item) => shouldShowDesktopNotification(item, user) && !getShownIds().includes(item._id))
          : null;
        if (eligible?._id) {
          showDesktopNotification(eligible);
          saveShownId(eligible._id);
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
