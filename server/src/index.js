import dotenv from "dotenv";
import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { Server } from "socket.io";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import forumRoutes from "./routes/forumRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";
import emailLogRoutes from "./routes/emailLogRoutes.js";
import dependencyRoutes from "./routes/dependencyRoutes.js";
import taskTemplateRoutes from "./routes/taskTemplateRoutes.js";
import recurringRoutes from "./routes/recurringRoutes.js";
import bulkRoutes from "./routes/bulkRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import availabilityRoutes from "./routes/availabilityRoutes.js";
import performanceRoutes from "./routes/performanceRoutes.js";
import rbacRoutes from "./routes/rbacRoutes.js";
import digestRoutes from "./routes/digestRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import { notFound, errorHandler } from "./middleware/error.js";
import { slowLog } from "./middleware/slowLog.js";
import { setupSockets } from "./sockets/index.js";

dotenv.config();

const app = express();
app.set("trust proxy", true);
app.set("etag", false);
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

app.set("io", io);

app.use(compression());
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));
app.use(slowLog());
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

app.get("/", (req, res) => {
  res.json({ status: "SWMS API running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/forum", forumRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api/emails", emailLogRoutes);
app.use("/api/dependencies", dependencyRoutes);
app.use("/api/task-templates", taskTemplateRoutes);
app.use("/api/recurring", recurringRoutes);
app.use("/api/bulk", bulkRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/rbac", rbacRoutes);
app.use("/api/digests", digestRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);

setupSockets(io);

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database connection failed", err);
    process.exit(1);
  });
