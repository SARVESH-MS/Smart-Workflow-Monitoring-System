import { sendEmail } from "./emailService.js";
import { sendSms } from "./smsService.js";
import NotificationTemplate from "../models/NotificationTemplate.js";
import { sendSlack } from "./slackService.js";
import EmailLog from "../models/EmailLog.js";
import Notification from "../models/Notification.js";

const shouldNotifyDelay = () => String(process.env.NOTIFY_ON_DELAY).toLowerCase() === "true";
const shouldNotifyComplete = () => String(process.env.NOTIFY_ON_COMPLETE).toLowerCase() === "true";

const userPref = (user, key, fallback) => {
  if (!user || !user.notificationPrefs) return fallback;
  return Boolean(user.notificationPrefs[key]);
};

const renderTemplate = (template, data) => {
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const path = key.trim().split(".");
    let value = data;
    path.forEach((p) => {
      value = value && value[p];
    });
    return value ?? "";
  });
};

const getTemplate = async (key, fallback) => {
  const tpl = await NotificationTemplate.findOne({ key });
  return tpl || fallback;
};

const uniqueRecipients = (...emails) => [...new Set(emails.filter(Boolean))];

const createInAppInboxLogs = async ({ recipients, subject, html, templateKey, meta }) => {
  if (!recipients.length) return new Map();
  const created = await EmailLog.insertMany(
    recipients.map((to) => ({
      to,
      subject,
      body: html,
      templateKey,
      sentByRole: "system",
      meta,
      deliveryStatus: "sent"
    }))
  );
  return new Map(created.map((doc) => [doc.to, doc._id]));
};

const sendExternalEmails = async ({ recipients, subject, html, logIdsByRecipient }) => {
  await Promise.all(
    recipients.map(async (to) => {
      try {
        await sendEmail({ to, subject, html });
      } catch (err) {
        const errorMessage = err?.message || "Email send failed";
        console.error(`[notify] Email send failed to ${to}: ${errorMessage}`);
        const logId = logIdsByRecipient.get(to);
        if (logId) {
          await EmailLog.findByIdAndUpdate(logId, {
            $set: {
              deliveryStatus: "failed",
              error: errorMessage,
              "meta.failed": true
            }
          }).catch(() => null);
        }
      }
    })
  );
};

export const notifyDelay = async ({ user, manager, task, project }) => {
  const fallback = {
    subject: `Task delayed: ${task.title}`,
    body: `
      <div>
        <h2>Task Delay Alert</h2>
        <p><strong>Task:</strong> {{task.title}}</p>
        <p><strong>Project:</strong> {{project.name}}</p>
        <p><strong>Assigned:</strong> {{user.name}} ({{user.email}})</p>
        <p><strong>Deadline:</strong> {{task.deadline}}</p>
        <p>Please review and adjust timelines as needed.</p>
      </div>
    `
  };
  const template = await getTemplate("task.delay.email", fallback);
  const subject = renderTemplate(template.subject || fallback.subject, { task, project, user, manager });
  const html = renderTemplate(template.body || fallback.body, {
    task: { ...task, deadline: new Date(task.deadline).toLocaleString() },
    project,
    user,
    manager
  });

  const allRecipients = uniqueRecipients(manager?.email, user?.email);
  const logIdsByRecipient = await createInAppInboxLogs({
    recipients: allRecipients,
    subject,
    html,
    templateKey: "task.delay.email",
    meta: { projectId: project?._id, taskId: task?._id }
  });

  await Promise.all(
    [user, manager]
      .filter(Boolean)
      .map((target) =>
        Notification.create({
          userId: target._id,
          type: "task.delay",
          title: `Task delayed: ${task.title}`,
          message: `${project?.name || "Project"} | Deadline: ${new Date(task.deadline).toLocaleDateString()}`
        }).catch(() => null)
      )
  );
  const externalRecipients = uniqueRecipients(
    userPref(manager, "emailDelay", true) && shouldNotifyDelay() ? manager?.email : null,
    userPref(user, "emailDelay", true) && shouldNotifyDelay() ? user?.email : null
  );
  await sendExternalEmails({ recipients: externalRecipients, subject, html, logIdsByRecipient });

  if (!shouldNotifyDelay()) return;
  const slackTpl = await getTemplate("task.delay.slack", { body: "Delay: {{task.title}} ({{project.name}})" });
  const slackText = renderTemplate(slackTpl.body, { task, project, user, manager });
  await sendSlack({ text: slackText }).catch(() => null);
};

export const notifyComplete = async ({ user, manager, task, project }) => {
  const fallback = {
    subject: `Task completed: ${task.title}`,
    body: `
      <div>
        <h2>Task Completed</h2>
        <p><strong>Task:</strong> {{task.title}}</p>
        <p><strong>Project:</strong> {{project.name}}</p>
        <p><strong>Assigned:</strong> {{user.name}} ({{user.email}})</p>
        <p>Great work!</p>
      </div>
    `
  };
  const template = await getTemplate("task.complete.email", fallback);
  const subject = renderTemplate(template.subject || fallback.subject, { task, project, user, manager });
  const html = renderTemplate(template.body || fallback.body, { task, project, user, manager });

  const allRecipients = uniqueRecipients(manager?.email, user?.email);
  const logIdsByRecipient = await createInAppInboxLogs({
    recipients: allRecipients,
    subject,
    html,
    templateKey: "task.complete.email",
    meta: { projectId: project?._id, taskId: task?._id }
  });

  await Promise.all(
    [user, manager]
      .filter(Boolean)
      .map((target) =>
        Notification.create({
          userId: target._id,
          type: "task.complete",
          title: `Task completed: ${task.title}`,
          message: `${project?.name || "Project"}`
        }).catch(() => null)
      )
  );
  const externalRecipients = uniqueRecipients(
    userPref(manager, "emailComplete", false) && shouldNotifyComplete() ? manager?.email : null,
    userPref(user, "emailComplete", false) && shouldNotifyComplete() ? user?.email : null
  );
  await sendExternalEmails({ recipients: externalRecipients, subject, html, logIdsByRecipient });

  if (!shouldNotifyComplete()) return;
  const slackTpl = await getTemplate("task.complete.slack", { body: "Complete: {{task.title}} ({{project.name}})" });
  const slackText = renderTemplate(slackTpl.body, { task, project, user, manager });
  await sendSlack({ text: slackText }).catch(() => null);
};

export const notifyAssigned = async ({ user, manager, task, project }) => {
  const fallback = {
    subject: `Task assigned: ${task.title}`,
    body: `
      <div>
        <h2>New Task Assigned</h2>
        <p><strong>Task:</strong> {{task.title}}</p>
        <p><strong>Project:</strong> {{project.name}}</p>
        <p><strong>Assigned to:</strong> {{user.name}} ({{user.email}})</p>
        <p><strong>Deadline:</strong> {{task.deadline}}</p>
      </div>
    `
  };
  const template = await getTemplate("task.assigned.email", fallback);
  const subject = renderTemplate(template.subject || fallback.subject, { task, project, user, manager });
  const html = renderTemplate(template.body || fallback.body, {
    task: { ...task, deadline: new Date(task.deadline).toLocaleString() },
    project,
    user,
    manager
  });

  const allRecipients = uniqueRecipients(manager?.email, user?.email);
  const logIdsByRecipient = await createInAppInboxLogs({
    recipients: allRecipients,
    subject,
    html,
    templateKey: "task.assigned.email",
    meta: { projectId: project?._id, taskId: task?._id }
  });

  await Promise.all(
    [user, manager]
      .filter(Boolean)
      .map((target) =>
        Notification.create({
          userId: target._id,
          type: "task.assigned",
          title: `Task assigned: ${task.title}`,
          message: `${project?.name || "Project"} | Deadline: ${new Date(task.deadline).toLocaleDateString()}`
        }).catch(() => null)
      )
  );

  await sendExternalEmails({
    recipients: allRecipients,
    subject,
    html,
    logIdsByRecipient
  });

  const slackTpl = await getTemplate("task.assigned.slack", { body: "Assigned: {{task.title}} ({{project.name}})" });
  const slackText = renderTemplate(slackTpl.body, { task, project, user, manager });
  await sendSlack({ text: slackText }).catch(() => null);
};

export const notifyDelaySms = async ({ user, manager, task, project }) => {
  if (!shouldNotifyDelay()) return;
  if (!userPref(user, "smsDelay", false) && !userPref(manager, "smsDelay", false)) return;
  const body = `Delay Alert: ${task.title} for ${project.name} is past deadline.`;
  const numbers = [
    userPref(manager, "smsDelay", false) ? manager?.phone : null,
    userPref(user, "smsDelay", false) ? user?.phone : null
  ].filter(Boolean);
  await Promise.all(numbers.map((to) => sendSms({ to, body }).catch(() => null)));
};
