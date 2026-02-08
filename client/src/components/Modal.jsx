import React from "react";

const Modal = ({ open, title, children, onClose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6">
      <div className="card w-full max-w-xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
};

export default Modal;
