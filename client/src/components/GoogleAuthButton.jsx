import React, { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_ID = "swms-google-gsi";
const GOOGLE_SRC = "https://accounts.google.com/gsi/client";

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const existing = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")), {
        once: true
      });
      return;
    }
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });

const GoogleAuthButton = ({ text = "continue_with", onCredential, onError }) => {
  const containerRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let cancelled = false;
    let resizeObserver;
    const init = async () => {
      if (!clientId || !containerRef.current) return;
      try {
        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id || !containerRef.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response?.credential) return;
            onCredential?.(response.credential);
          }
        });
        const renderGoogleButton = () => {
          if (!containerRef.current) return;
          const width = Math.min(Math.max(containerRef.current.clientWidth, 280), 420);
          containerRef.current.innerHTML = "";
          window.google.accounts.id.renderButton(containerRef.current, {
            type: "standard",
            theme: "filled_blue",
            size: "large",
            shape: "pill",
            logo_alignment: "left",
            text,
            width: String(width)
          });
        };
        renderGoogleButton();
        resizeObserver = new ResizeObserver(() => renderGoogleButton());
        resizeObserver.observe(containerRef.current);
        setIsReady(true);
      } catch (err) {
        onError?.(err.message || "Google auth initialization failed");
      }
    };
    init();
    return () => {
      cancelled = true;
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [clientId, onCredential, onError, text]);

  return (
    <div className="mt-2 flex w-full flex-col items-center gap-2">
      {clientId ? (
        <>
          <div ref={containerRef} className="w-full" />
          {!isReady && <div className="text-xs text-slate-400">Loading Google sign-in...</div>}
        </>
      ) : (
        <>
          <button type="button" className="btn-ghost w-full" disabled>
            Continue with Google
          </button>
          <div className="text-xs text-amber-500">
            Google button hidden: set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>client/.env</code>
          </div>
        </>
      )}
    </div>
  );
};

export default GoogleAuthButton;
