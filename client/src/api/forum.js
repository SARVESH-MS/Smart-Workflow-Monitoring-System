import api from "./client.js";

export const getMyRoom = () => api.get("/api/forum/room").then((res) => res.data);
export const listMessages = (roomId) =>
  api.get("/api/forum/messages", { params: { roomId } }).then((res) => res.data);
export const sendMessage = (data) => api.post("/api/forum/messages", data).then((res) => res.data);
export const uploadFile = (file) => {
  const form = new FormData();
  form.append("file", file);
  return api
    .post("/api/forum/upload", form, { headers: { "Content-Type": "multipart/form-data" } })
    .then((res) => res.data);
};
export const attachFile = (id, payload) =>
  api.post(`/api/forum/messages/${id}/attachments`, payload).then((res) => res.data);
