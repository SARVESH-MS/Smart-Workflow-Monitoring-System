import React from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../utils/AuthContext.jsx";

const FloatingDiscussionButton = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = useParams();
  const location = useLocation();

  if (!user || user.role === "admin") return null;

  const id = params?.id || user.id;
  const basePath = user.role === "manager" ? `/manager/${id}` : `/employee/${id}`;
  const inForum = location.pathname.endsWith("/forum");

  return (
    <button
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-500 text-white shadow-xl transition hover:bg-blue-400"
      onClick={() => navigate(inForum ? basePath : `${basePath}/forum`)}
      aria-label="Team Discussion"
      title="Team Discussion"
    >
      <span className="text-2xl leading-none">{inForum ? "?" : "??"}</span>
    </button>
  );
};

export default FloatingDiscussionButton;
