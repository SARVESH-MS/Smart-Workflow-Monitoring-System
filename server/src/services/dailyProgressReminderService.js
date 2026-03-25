import dayjs from "dayjs";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { notifyMissingDailyProgress } from "./notificationService.js";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const REMINDER_LEAD_MINUTES = Number(process.env.DAILY_PROGRESS_REMINDER_LEAD_MINUTES || 60);
const WORKDAY_END_HOUR = Number(process.env.DAILY_PROGRESS_WORKDAY_END_HOUR || 18);

let reminderTimer = null;
let reminderRunInFlight = false;

const getTodayKey = () => dayjs().format("YYYY-MM-DD");

const hasProgressToday = (task) =>
  Array.isArray(task?.progressLogs) &&
  task.progressLogs.some(
    (log) =>
      String(log.createdBy || "") === String(task.userId || "") &&
      dayjs(log.loggedAt).format("YYYY-MM-DD") === getTodayKey()
  );

const isInsideReminderWindow = (now = dayjs()) => {
  const currentMinutes = now.hour() * 60 + now.minute();
  const workdayEndMinutes = WORKDAY_END_HOUR * 60;
  const reminderStartMinutes = workdayEndMinutes - REMINDER_LEAD_MINUTES;
  return currentMinutes >= reminderStartMinutes && currentMinutes < workdayEndMinutes;
};

const getWorkdayEndsAtLabel = () => {
  const end = dayjs().hour(WORKDAY_END_HOUR).minute(0).second(0);
  return end.format("h:mm A");
};

const sendMissingProgressReminders = async () => {
  if (reminderRunInFlight || !isInsideReminderWindow()) return;
  reminderRunInFlight = true;

  try {
    const tasks = await Task.find({ status: "in_progress" })
      .select("_id projectId userId title progressLogs")
      .lean();
    if (tasks.length === 0) return;

    const relevantTasks = tasks.filter((task) => !hasProgressToday(task));
    if (relevantTasks.length === 0) return;

    const projectIds = [...new Set(relevantTasks.map((task) => String(task.projectId || "")).filter(Boolean))];
    const userIds = [...new Set(relevantTasks.map((task) => String(task.userId || "")).filter(Boolean))];

    const [projects, users] = await Promise.all([
      Project.find({ _id: { $in: projectIds } }).select("_id name managerId").lean(),
      User.find({ _id: { $in: userIds } }).select("_id name email notificationPrefs").lean()
    ]);

    const projectsById = new Map(projects.map((project) => [String(project._id), project]));
    const employeesById = new Map(users.map((user) => [String(user._id), user]));
    const managerIds = [...new Set(projects.map((project) => String(project.managerId || "")).filter(Boolean))];
    const managers = await User.find({ _id: { $in: managerIds } }).select("_id name email notificationPrefs").lean();
    const managersById = new Map(managers.map((manager) => [String(manager._id), manager]));

    await Promise.all(
      relevantTasks.map(async (task) => {
        const project = projectsById.get(String(task.projectId || ""));
        const user = employeesById.get(String(task.userId || ""));
        const manager = project?.managerId ? managersById.get(String(project.managerId)) : null;
        if (!project || !user) return;

        const reminderKey = `daily-progress:${task._id}:${getTodayKey()}`;
        await notifyMissingDailyProgress({
          user,
          manager,
          task,
          project,
          reminderKey,
          workdayEndsAtLabel: getWorkdayEndsAtLabel()
        });
      })
    );
  } catch (error) {
    console.error("[daily-progress-reminder]", error?.message || error);
  } finally {
    reminderRunInFlight = false;
  }
};

export const startDailyProgressReminderService = () => {
  if (reminderTimer) return reminderTimer;
  reminderTimer = setInterval(() => {
    void sendMissingProgressReminders();
  }, CHECK_INTERVAL_MS);
  reminderTimer.unref?.();
  void sendMissingProgressReminders();
  return reminderTimer;
};
