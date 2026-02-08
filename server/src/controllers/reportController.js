import Task from "../models/Task.js";
import Project from "../models/Project.js";
import PDFDocument from "pdfkit";

const getTasksForUser = async (user) => {
  if (user.role === "admin") {
    return Task.find({}).populate("projectId", "name").populate("userId", "name email");
  }
  if (user.role === "manager") {
    const projects = await Project.find({ managerId: user.id }).select("_id");
    return Task.find({ projectId: { $in: projects.map((p) => p._id) } })
      .populate("projectId", "name")
      .populate("userId", "name email");
  }
  return Task.find({ userId: user.id }).populate("projectId", "name").populate("userId", "name email");
};

export const exportTasksCsv = async (req, res) => {
  const tasks = await getTasksForUser(req.user);
  const header = [
    "Task",
    "Assignee",
    "Assignee Email",
    "Project",
    "Status",
    "Stage",
    "Deadline",
    "Time Spent (mins)"
  ];
  const lines = [header.join(",")];
  tasks.forEach((t) => {
    lines.push(
      [
        JSON.stringify(t.title || ""),
        JSON.stringify(t.userId?.name || ""),
        JSON.stringify(t.userId?.email || ""),
        JSON.stringify(t.projectId?.name || ""),
        JSON.stringify(t.status || ""),
        JSON.stringify(t.stage || ""),
        JSON.stringify(t.deadline ? new Date(t.deadline).toISOString() : ""),
        JSON.stringify(t.timeSpent || 0)
      ].join(",")
    );
  });

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=tasks-report.csv");
  res.send(lines.join("\n"));
};

export const exportTasksPdf = async (req, res) => {
  const tasks = await getTasksForUser(req.user);
  const doc = new PDFDocument({ margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=tasks-report.pdf");
  doc.pipe(res);

  doc.fontSize(18).text("Tasks Report", { align: "left" });
  doc.moveDown();

  tasks.forEach((t) => {
    doc
      .fontSize(12)
      .text(`Task: ${t.title}`)
      .text(`Project: ${t.projectId?.name || "-"}`)
      .text(`Assignee: ${t.userId?.name || "-"} (${t.userId?.email || "-"})`)
      .text(`Status: ${t.status} | Stage: ${t.stage || "-"}`)
      .text(`Deadline: ${t.deadline ? new Date(t.deadline).toDateString() : "-"}`)
      .text(`Time Spent: ${t.timeSpent || 0} mins`)
      .moveDown();
  });

  doc.end();
};
