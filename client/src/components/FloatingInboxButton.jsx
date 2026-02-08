import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";

const FloatingInboxButton = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = useParams();
  const location = useLocation();

  if (!user || user.role === "admin") return null;

  const id = params?.id || user.id;
  const basePath = user.role === "manager" ? `/manager/${id}` : `/employee/${id}`;
  const inInbox = location.pathname.endsWith("/inbox");

  return (
    <button
      className="fixed bottom-24 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-slate-700 text-white shadow-xl transition hover:bg-slate-600"
      onClick={() => navigate(inInbox ? basePath : `${basePath}/inbox`)}
      aria-label="Inbox"
      title="Inbox"
    >
      <span className="text-2xl leading-none">{inInbox ? "←" : "📧"}</span>
    </button>
  );
};

export default FloatingInboxButton;
