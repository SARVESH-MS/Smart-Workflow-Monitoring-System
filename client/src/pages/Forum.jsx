import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  getMyRoom,
  listMessages,
  sendMessage,
  uploadFile,
  attachFile,
  markForumRead
} from "../api/forum.js";
import { useAuth } from "../utils/AuthContext.jsx";
import { createSocket } from "../utils/socket.js";

const Forum = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const messageEndRef = useRef(null);

  const useLightChatFrames = room?.name
    ? room.name.toLowerCase().includes("team discussion")
    : false;

  const load = async () => {
    const roomData = await getMyRoom();
    setRoom(roomData);
    const msgs = await listMessages(roomData._id);
    setMessages(msgs);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (room?._id) {
      markForumRead();
    }
  }, [room?._id]);

  useEffect(() => {
    const socket = createSocket();
    socket.on("forum:message", (msg) => {
      if (msg.roomId === room?._id) {
        setMessages((prev) => (prev.some((m) => m._id === msg._id) ? prev : [...prev, msg]));
        markForumRead();
      }
    });
    socket.on("forum:message_updated", (msg) => {
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? msg : m)));
    });
    socket.on("forum:message_deleted", ({ id }) => {
      setMessages((prev) => prev.filter((m) => m._id !== id));
    });
    return () => socket.disconnect();
  }, [room?._id]);

  const handleSend = async () => {
    if (!text.trim()) return;
    await sendMessage({ roomId: room._id, text: text.trim() });
    setText("");
  };

  const handleUpload = async () => {
    if (!file || !room) return;
    setUploading(true);
    try {
      const upload = await uploadFile(file);
      const message = await sendMessage({ roomId: room._id, text: file.name });
      const updated = await attachFile(message._id, upload);
      setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const linkify = (value) => {
    if (!value) return [];
    const parts = value.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, idx) => {
      if (part.match(/^https?:\/\//)) {
        return (
          <a
            key={`${part}-${idx}`}
            href={part}
            className="text-blue-300 underline"
            target="_blank"
            rel="noreferrer"
          >
            {part}
          </a>
        );
      }
      return <span key={`${part}-${idx}`}>{part}</span>;
    });
  };

  const formatMessageTime = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  useEffect(() => {
    if (!messages.length) return;
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className={useLightChatFrames ? "card forum-light" : "card"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            className="h-10 w-10 rounded-full border border-slate-700 text-slate-200 hover:border-slate-500"
            onClick={() => {
              const id = params?.id || user?.id;
              const basePath = user?.role === "manager" ? `/manager/${id}` : `/employee/${id}`;
              navigate(basePath);
            }}
            aria-label="Back"
            title="Back"
          >
            {"<-"}
          </button>
          <div>
            <h2 className="text-xl font-semibold">{room?.name || "Team Discussion"}</h2>
            <p className="text-sm text-slate-400">Discuss tasks, share code and documents.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            className="text-xs"
            accept=".pdf,.doc,.docx,.txt,.js,.jsx,.ts,.tsx,.zip,.xls,.xlsx"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <button className="btn-ghost" onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid max-h-[420px] gap-3 overflow-auto">
        {messages.map((msg) => (
          <div key={msg._id} className="forum-message glass rounded-xl p-3">
            <div className="flex items-center justify-between">
              <div className="forum-message-meta text-sm text-slate-300">
                <span className="font-semibold">{msg.userId?.name || "User"}</span>
                <span className="ml-2 text-xs text-slate-500">{msg.userId?.role}</span>
              </div>
              <div className="text-[11px] text-slate-500">{formatMessageTime(msg.createdAt)}</div>
            </div>
            <div className="forum-message-body mt-2 text-sm text-slate-200 whitespace-pre-wrap">
              {linkify(msg.text)}
            </div>
            {msg.attachments?.length > 0 && (
              <div className="mt-3 grid gap-2">
                {msg.attachments.map((fileItem) => (
                  <a
                    key={fileItem.url}
                    href={`${import.meta.env.VITE_API_URL || "http://localhost:5000"}${fileItem.url}`}
                    className="forum-message-link text-xs text-blue-300 underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {fileItem.filename}
                  </a>
                ))}
              </div>
            )}
            {msg.editedAt && <div className="forum-message-edited mt-2 text-xs text-slate-500">Edited</div>}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>

      <div className="mt-4 grid gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wide text-slate-300">Message</label>
            <span className="text-[11px] text-slate-500">Type text or paste a link</span>
          </div>
          <textarea
            className="mt-2 w-full rounded-xl bg-slate-950 px-3 py-2 text-sm"
            placeholder="Write a message or paste a link..."
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <button className="btn-primary justify-self-end" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
};

export default Forum;
