import dayjs from "dayjs";

export const formatDate = (value) => (value ? dayjs(value).format("MMM D, YYYY") : "-");
export const formatTime = (value) => (value ? dayjs(value).format("HH:mm") : "-");
export const diffMinutes = (start, end) => dayjs(end).diff(dayjs(start), "minute");
export const formatDurationHours = (minutes) => {
  const total = Number(minutes || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};
