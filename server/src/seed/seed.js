import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";

dotenv.config();

const passwordHash = await bcrypt.hash("Password123!", 10);

const seed = async () => {
  await connectDB();
  await User.deleteMany({});
  await Project.deleteMany({});
  await Task.deleteMany({});

  await User.create({
    name: "Admin",
    email: "admin@swms.com",
    password: passwordHash,
    role: "admin",
    phone: "+10000000001",
    teamRole: "manager",
    notificationPrefs: { emailDelay: true, emailComplete: false, smsDelay: false }
  });

  const managerRaju = await User.create({
    name: "Raju",
    email: "raju@swms.com",
    password: passwordHash,
    role: "manager",
    phone: "+10000000002",
    teamRole: "manager",
    notificationPrefs: { emailDelay: true, emailComplete: false, smsDelay: true }
  });

  const managerLeena = await User.create({
    name: "Leena",
    email: "leena@swms.com",
    password: passwordHash,
    role: "manager",
    phone: "+10000000003",
    teamRole: "manager",
    notificationPrefs: { emailDelay: true, emailComplete: false, smsDelay: false }
  });

  const rajuTeamRoles = [
    "designer",
    "designer",
    "frontend",
    "frontend",
    "frontend",
    "backend",
    "backend",
    "backend",
    "tester",
    "tester"
  ];

  const leenaTeamRoles = [
    "designer",
    "frontend",
    "frontend",
    "backend",
    "backend",
    "backend",
    "tester",
    "tester",
    "tester"
  ];

  const rajuTeam = await Promise.all(
    rajuTeamRoles.map((roleName, idx) =>
      User.create({
        name: `RajuTeam${idx + 1}`,
        email: `raju${idx + 1}@swms.com`,
        password: passwordHash,
        role: "employee",
        phone: `+100000001${idx}`,
        managerId: managerRaju._id,
        teamRole: roleName,
        notificationPrefs: { emailDelay: true, emailComplete: false, smsDelay: false }
      })
    )
  );

  const leenaTeam = await Promise.all(
    leenaTeamRoles.map((roleName, idx) =>
      User.create({
        name: `LeenaTeam${idx + 1}`,
        email: `leena${idx + 1}@swms.com`,
        password: passwordHash,
        role: "employee",
        phone: `+100000002${idx}`,
        managerId: managerLeena._id,
        teamRole: roleName,
        notificationPrefs: { emailDelay: true, emailComplete: false, smsDelay: false }
      })
    )
  );

  const project1 = await Project.create({
    name: "Workflow Automation Revamp",
    description: "Modernize workflow automation across teams.",
    deadline: dayjs().add(30, "day").toDate(),
    managerId: managerRaju._id,
    status: "development",
    workflow: ["Planning", "Design", "Development", "Testing", "Done"]
  });

  const project2 = await Project.create({
    name: "Analytics Dashboard 2.0",
    description: "New analytics dashboard for executive visibility.",
    deadline: dayjs().add(45, "day").toDate(),
    managerId: managerLeena._id,
    status: "design",
    workflow: ["Planning", "Design", "Development", "Testing", "Done"]
  });

  const tasks = [];
  rajuTeam.slice(0, 5).forEach((member, idx) => {
    tasks.push({
      projectId: project1._id,
      userId: member._id,
      title: `Raju Task ${idx + 1}`,
      description: "Implement assigned feature module.",
      roleContribution: `${member.teamRole} contributor`,
      deadline: dayjs().add(10 + idx, "day").toDate(),
      status: "todo"
    });
  });

  leenaTeam.slice(0, 5).forEach((member, idx) => {
    tasks.push({
      projectId: project2._id,
      userId: member._id,
      title: `Leena Task ${idx + 1}`,
      description: "Build dashboard component.",
      roleContribution: `${member.teamRole} contributor`,
      deadline: dayjs().add(12 + idx, "day").toDate(),
      status: "todo"
    });
  });

  await Task.insertMany(tasks);

  console.log("Seed complete");
  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
