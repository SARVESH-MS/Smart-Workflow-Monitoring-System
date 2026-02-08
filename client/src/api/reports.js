import api from "./client.js";

export const downloadTasksCsv = () =>
  api.get("/api/reports/tasks.csv", { responseType: "blob" }).then((res) => res.data);

export const downloadTasksPdf = () =>
  api.get("/api/reports/tasks.pdf", { responseType: "blob" }).then((res) => res.data);
