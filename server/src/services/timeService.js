import dayjs from "dayjs";

export const endOtherActiveTasks = async (TaskModel, userId, exceptTaskId) => {
  const activeTasks = await TaskModel.find({
    userId,
    status: "in_progress",
    _id: { $ne: exceptTaskId }
  });
  const now = new Date();
  await Promise.all(
    activeTasks.map(async (task) => {
      if (task.startTime) {
        const diff = dayjs(now).diff(dayjs(task.startTime), "minute");
        task.timeSpent += diff;
      }
      task.endTime = now;
      task.status = "todo";
      await task.save();
    })
  );
};

export const startTimer = async (task) => {
  if (!task.startTime) {
    task.startTime = new Date();
  }
  task.status = "in_progress";
  await task.save();
  return task;
};

export const stopTimer = async (task) => {
  const now = new Date();
  if (task.startTime) {
    const diff = dayjs(now).diff(dayjs(task.startTime), "minute");
    task.timeSpent += diff;
  }
  task.endTime = now;
  task.status = "todo";
  await markDelay(task);
  await task.save();
  return task;
};

export const markDelay = async (task) => {
  const checkTime = task.endTime || new Date();
  task.isDelayed = task.deadline ? checkTime > task.deadline : false;
  return task;
};
