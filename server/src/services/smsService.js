import twilio from "twilio";

let client;

export const getTwilio = () => {
  if (client) return client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error("Twilio configuration missing");
  }
  client = twilio(sid, token);
  return client;
};

export const sendSms = async ({ to, body }) => {
  const from = process.env.TWILIO_FROM;
  if (!from) {
    throw new Error("TWILIO_FROM missing");
  }
  const twilioClient = getTwilio();
  await twilioClient.messages.create({ from, to, body });
};
