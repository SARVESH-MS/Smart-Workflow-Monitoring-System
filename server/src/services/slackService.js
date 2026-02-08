import fetch from "node-fetch";

export const sendSlack = async ({ text }) => {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error("SLACK_WEBHOOK_URL missing");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status}`);
  }
};
