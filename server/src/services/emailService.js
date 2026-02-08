import nodemailer from "nodemailer";

let transport;

export const getMailer = () => {
  if (transport) return transport;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration missing");
  }

  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transport;
};

export const sendEmail = async ({ to, subject, html }) => {
  const from = process.env.SMTP_FROM || "SWMS <no-reply@swms.com>";
  const mailer = getMailer();
  await mailer.sendMail({ from, to, subject, html });
};
