import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import { chromium } from "playwright-core";
import Task from "../models/Task.js";
import VerificationJob from "../models/VerificationJob.js";

const FETCH_TIMEOUT_MS = 12000;
const JOB_TIMEOUT_MS = 4 * 60 * 1000;
const RUNTIME_PLACEHOLDER_LABEL = "Runtime verification";
const ALLOWED_UPLOAD_URL_PATTERN = /^\/uploads\//i;
const ABSOLUTE_HTTP_URL_PATTERN = /^https?:\/\//i;
const BROWSER_PLACEHOLDER_LABEL = "Browser verification";
const BROWSER_EXECUTABLE_CANDIDATES = {
  win32: [
    process.env.PLAYWRIGHT_BROWSER_PATH,
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ],
  darwin: [
    process.env.PLAYWRIGHT_BROWSER_PATH,
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  ],
  linux: [
    process.env.PLAYWRIGHT_BROWSER_PATH,
    "/usr/bin/microsoft-edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/snap/bin/chromium"
  ]
};
const ROLE_SCENARIO_CONFIG = {
  admin: {
    label: "Admin scenario",
    loginPath: "/login/admin",
    emailEnv: "VERIFIER_ADMIN_EMAIL",
    passwordEnv: "VERIFIER_ADMIN_PASSWORD",
    expectedHeading: "Admin Dashboard",
    secondaryText: "Session Monitor"
  },
  manager: {
    label: "Manager scenario",
    loginPath: "/login/manager",
    emailEnv: "VERIFIER_MANAGER_EMAIL",
    passwordEnv: "VERIFIER_MANAGER_PASSWORD",
    expectedHeading: "Manager Dashboard",
    secondaryText: "Tasks"
  },
  employee: {
    label: "Employee scenario",
    loginPath: "/login/employee",
    emailEnv: "VERIFIER_EMPLOYEE_EMAIL",
    passwordEnv: "VERIFIER_EMPLOYEE_PASSWORD",
    expectedHeading: "Employee Dashboard",
    secondaryText: "Tasks"
  }
};

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const toTokenSet = (value) =>
  new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );

const getTokenSimilarity = (left, right) => {
  const leftTokens = toTokenSet(left);
  const rightTokens = toTokenSet(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union === 0 ? 0 : intersection / union;
};

const isAbsoluteHttpUrl = (value) => ABSOLUTE_HTTP_URL_PATTERN.test(String(value || "").trim());

const isLocalUploadUrl = (value) => ALLOWED_UPLOAD_URL_PATTERN.test(String(value || "").trim());

const addCheck = (checks, label, status, message) => {
  checks.push({ label, status, message });
};

const scoreStatus = (checks) => {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "pass";
};

const buildSummary = (status, checks) => {
  const failing = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  if (status === "pass") return "Runtime verification passed.";
  if (status === "warning") return `Runtime verification completed with ${warnings} warning${warnings === 1 ? "" : "s"}.`;
  return `Runtime verification failed ${failing} check${failing === 1 ? "" : "s"}.`;
};

const getBrowserExecutableCandidates = () => {
  const candidates =
    BROWSER_EXECUTABLE_CANDIDATES[process.platform] || BROWSER_EXECUTABLE_CANDIDATES.linux;
  return candidates.filter(Boolean);
};

const stripHtml = (value) =>
  String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getUploadsRoot = () => path.resolve("uploads");

const resolveUploadedEvidencePath = (evidenceUrl) => {
  const relative = String(evidenceUrl || "").trim().replace(/^\/uploads\//i, "");
  if (!relative) return null;
  const uploadsRoot = getUploadsRoot();
  const target = path.resolve(uploadsRoot, relative);
  return target.startsWith(uploadsRoot) ? target : null;
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": "SWMS-Runtime-Verification/1.0" }
    });
  } finally {
    clearTimeout(timer);
  }
};

const fileExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const resolveBrowserExecutablePath = async () => {
  for (const candidate of getBrowserExecutableCandidates()) {
    if (await fileExists(candidate)) {
      return candidate;
    }
  }
  return null;
};

const getExpectedPathPrefix = (role) => {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/manager/";
  if (role === "employee") return "/employee/";
  return "/";
};

const inferRelevantRoles = (task, progressLog) => {
  const text = normalizeText(
    `${task?.title || ""} ${task?.description || ""} ${task?.roleContribution || ""} ${progressLog?.affectedArea || ""} ${progressLog?.note || ""}`
  );
  const roles = [];
  if (text.includes("admin")) roles.push("admin");
  if (text.includes("manager")) roles.push("manager");
  if (text.includes("employee")) roles.push("employee");
  return roles.length > 0 ? [...new Set(roles)] : ["admin", "manager", "employee"];
};

const getConfiguredRoleScenarios = (task, progressLog) => {
  const relevantRoles = inferRelevantRoles(task, progressLog);
  return relevantRoles.map((role) => {
    const config = ROLE_SCENARIO_CONFIG[role];
    return {
      role,
      label: config.label,
      loginPath: config.loginPath,
      expectedHeading: config.expectedHeading,
      secondaryText: config.secondaryText,
      email: String(process.env[config.emailEnv] || "").trim(),
      password: String(process.env[config.passwordEnv] || "").trim()
    };
  });
};

const matchesExpectedPath = (role, pathname) => {
  const pathText = String(pathname || "");
  if (role === "admin") return pathText === "/admin";
  if (role === "manager") return /^\/manager\/[^/]+\/?$/.test(pathText);
  if (role === "employee") return /^\/employee\/[^/]+\/?$/.test(pathText);
  return false;
};

const getBodyText = async (page) =>
  normalizeText(
    (await page.locator("body").innerText().catch(() => "")) || ""
  );

const runRoleScenario = async ({ browser, baseUrl, scenario, checks }) => {
  if (!scenario.email || !scenario.password) {
    addCheck(
      checks,
      scenario.label,
      "warning",
      `Skipped because ${scenario.role} test account credentials are not configured.`
    );
    return;
  }

  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });

  try {
    const loginUrl = new URL(scenario.loginPath, baseUrl).toString();
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    const emailField = page.locator('input[placeholder="Email"], input[type="email"]').first();
    const passwordField = page.locator('input[type="password"]').first();
    const submitButton = page.getByRole("button", { name: /sign in/i }).first();

    if ((await emailField.count()) === 0 || (await passwordField.count()) === 0) {
      addCheck(checks, scenario.label, "warning", `Skipped because the expected login form was not found at ${scenario.loginPath}.`);
      return;
    }

    await emailField.fill(scenario.email);
    await passwordField.fill(scenario.password);
    if ((await submitButton.count()) > 0) {
      await submitButton.click();
    } else {
      await passwordField.press("Enter");
    }

    let passed = false;
    let lastBodyText = "";
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await page.waitForTimeout(700);
      const pathname = new URL(page.url()).pathname;
      lastBodyText = await getBodyText(page);
      if (matchesExpectedPath(scenario.role, pathname) && lastBodyText.includes(normalizeText(scenario.expectedHeading))) {
        passed = true;
        break;
      }
      if (lastBodyText.includes("invalid credentials") || lastBodyText.includes("account does not match this portal")) {
        break;
      }
    }

    if (!passed) {
      addCheck(
        checks,
        scenario.label,
        "fail",
        `Login or redirect for the ${scenario.role} flow did not reach the expected dashboard.`
      );
      return;
    }

    addCheck(
      checks,
      scenario.label,
      "pass",
      `The ${scenario.role} test account reached the expected dashboard route ${new URL(page.url()).pathname}.`
    );

    if (lastBodyText.includes(normalizeText(scenario.secondaryText))) {
      addCheck(
        checks,
        `${scenario.label} content`,
        "pass",
        `The ${scenario.role} dashboard rendered expected content such as ${scenario.secondaryText}.`
      );
    } else {
      addCheck(
        checks,
        `${scenario.label} content`,
        "warning",
        `The ${scenario.role} dashboard opened, but expected content such as ${scenario.secondaryText} was not clearly confirmed.`
      );
    }
  } catch (error) {
    addCheck(checks, scenario.label, "warning", `The ${scenario.role} scenario could not complete: ${error.message}`);
  } finally {
    await page.close().catch(() => null);
  }
};

const runConfiguredRoleScenarios = async ({ browser, baseUrl, task, progressLog, checks }) => {
  const scenarios = getConfiguredRoleScenarios(task, progressLog);
  if (scenarios.length === 0) {
    return;
  }
  for (const scenario of scenarios) {
    await runRoleScenario({ browser, baseUrl, scenario, checks });
  }
};

const runCommand = ({ command, args = [], cwd, env = {}, timeoutMs = JOB_TIMEOUT_MS }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      shell: false,
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, timeoutMs);

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });

const startServerCommand = ({ command, args = [], cwd, env = {} }) => {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env, ...env },
    shell: false,
    windowsHide: true
  });
  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk) => {
    stdout += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  return {
    child,
    getOutput: () => `${stdout}\n${stderr}`.trim()
  };
};

const stopChild = async (child) => {
  if (!child || child.killed) return;
  child.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  if (!child.killed) {
    child.kill("SIGKILL");
  }
};

const waitForUrl = async (url, timeoutMs = 45000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchWithTimeout(url);
      if (response.ok) {
        const text = await response.text();
        return { response, text };
      }
    } catch {
      // Keep polling until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`Server did not become reachable at ${url}`);
};

const getRuntimeModeForEvidence = (evidenceReference) => {
  if (isAbsoluteHttpUrl(evidenceReference)) return "url";
  if (isLocalUploadUrl(evidenceReference) && /\.zip$/i.test(evidenceReference)) return "archive";
  return null;
};

const mergeVerification = (currentVerification = {}, runtimeResult = {}, jobId = "") => {
  const automatedChecks = (currentVerification?.checks || []).filter((check) => check.label !== RUNTIME_PLACEHOLDER_LABEL);
  const mergedChecks = automatedChecks.concat(runtimeResult.checks || []);
  const mergedStatus = scoreStatus(mergedChecks);
  return {
    ...currentVerification,
    jobId,
    status: mergedStatus,
    summary: runtimeResult.summary || buildSummary(mergedStatus, mergedChecks),
    scope: "automated + runtime",
    checkedAt: new Date(),
    checks: mergedChecks,
    runtimeStatus: runtimeResult.runtimeStatus || "completed",
    runtimeSummary: runtimeResult.summary || ""
  };
};

const updateTaskLogVerification = async (job, runtimeResult) => {
  const task = await Task.findById(job.taskId);
  if (!task) return;
  const log = task.progressLogs.find((entry) => entry.entryId === job.progressEntryId);
  if (!log) return;
  log.verification = mergeVerification(log.verification, runtimeResult, String(job._id));
  await task.save();
};

const updateTaskLogRuntimeState = async (job, runtimeStatus, runtimeSummary) => {
  const task = await Task.findById(job.taskId);
  if (!task) return;
  const log = task.progressLogs.find((entry) => entry.entryId === job.progressEntryId);
  if (!log) return;
  log.verification = {
    ...(log.verification || {}),
    jobId: String(job._id),
    runtimeStatus,
    runtimeSummary: runtimeSummary || "",
    scope: log.verification?.scope || "automated + runtime"
  };
  await task.save();
};

export const queueRuntimeVerificationJob = async (task, entry) => {
  const evidenceReference = String(entry?.evidenceAttachment?.url || entry?.evidenceUrl || "").trim();
  const mode = getRuntimeModeForEvidence(evidenceReference);
  if (!mode) {
    return entry.verification;
  }

  const job = await VerificationJob.create({
    taskId: task._id,
    progressEntryId: entry.entryId,
    evidenceType: entry.evidenceType,
    evidenceUrl: evidenceReference,
    mode,
    status: "queued",
    summary: "Full runtime verification queued.",
    checks: []
  });

  const currentChecks = Array.isArray(entry.verification?.checks) ? entry.verification.checks : [];
  return {
    ...entry.verification,
    jobId: String(job._id),
    status: entry.verification?.status || "pass",
    summary:
      entry.verification?.status === "warning"
        ? "Automated checks finished with warnings. Full runtime verification is queued."
        : entry.verification?.status === "fail"
          ? "Automated checks failed. Full runtime verification is queued for deeper inspection."
          : "Proof submitted successfully. Full runtime verification is queued.",
    scope: "automated + runtime",
    checks: currentChecks.concat([
      {
        label: RUNTIME_PLACEHOLDER_LABEL,
        status: "pass",
        message:
          mode === "archive"
            ? "Uploaded project archive queued for isolated runtime verification."
            : "Live evidence URL queued for runtime verification."
      }
    ]),
    runtimeStatus: "queued",
    runtimeSummary: "Full runtime verification queued."
  };
};

const createJobWorkspace = async (jobId) => {
  const baseDir = path.resolve("uploads", "runtime-verifier", String(jobId));
  const extractDir = path.join(baseDir, "extracted");
  await fs.mkdir(extractDir, { recursive: true });
  return { baseDir, extractDir };
};

const extractZipArchive = async (archivePath, extractDir) => {
  if (process.platform === "win32") {
    const result = await runCommand({
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-Command",
        `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`
      ],
      cwd: extractDir,
      timeoutMs: JOB_TIMEOUT_MS
    });
    if (result.code !== 0) {
      throw new Error(result.stderr || "Expand-Archive failed");
    }
    return result;
  }

  const result = await runCommand({
    command: "unzip",
    args: ["-o", archivePath, "-d", extractDir],
    cwd: extractDir,
    timeoutMs: JOB_TIMEOUT_MS
  });
  if (result.code !== 0) {
    throw new Error(result.stderr || "unzip failed");
  }
  return result;
};

const findProjectRoot = async (dir) => {
  const directPackage = path.join(dir, "package.json");
  try {
    await fs.access(directPackage);
    return dir;
  } catch {
    // Continue.
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nestedPackage = path.join(dir, entry.name, "package.json");
    try {
      await fs.access(nestedPackage);
      return path.join(dir, entry.name);
    } catch {
      // Keep looking.
    }
  }

  return null;
};

const deriveCandidatePaths = (task, progressLog) => {
  const text = normalizeText(`${task?.title || ""} ${task?.description || ""} ${task?.roleContribution || ""} ${progressLog?.affectedArea || ""} ${progressLog?.note || ""}`);
  const candidates = new Set(["/"]);
  if (text.includes("login")) candidates.add("/login");
  if (text.includes("admin")) candidates.add("/admin");
  if (text.includes("dashboard")) candidates.add("/dashboard");
  if (text.includes("admin") && text.includes("dashboard")) candidates.add("/admin/dashboard");
  if (text.includes("manager")) candidates.add("/manager");
  if (text.includes("employee")) candidates.add("/employee");
  if (text.includes("qa")) candidates.add("/qa");
  if (text.includes("review")) candidates.add("/review");
  return [...candidates];
};

const runBrowserVerification = async ({ baseUrl, task, progressLog, checks, screenshotDir }) => {
  const executablePath = await resolveBrowserExecutablePath();
  if (!executablePath) {
    addCheck(
      checks,
      BROWSER_PLACEHOLDER_LABEL,
      "warning",
      "No supported local browser executable was found for Playwright verification."
    );
    return;
  }

  let browser;
  try {
    browser = await chromium.launch({
      executablePath,
      headless: true
    });
    addCheck(checks, BROWSER_PLACEHOLDER_LABEL, "pass", `Browser automation launched with ${path.basename(executablePath)}.`);

    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 }
    });

    const visitedRoutes = [];
    const probeRoute = async (targetUrl, label) => {
      const response = await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });
      await page.waitForTimeout(800);
      const title = (await page.title()).trim();
      const bodyText = normalizeText((await page.locator("body").innerText().catch(() => "")) || "");
      const combinedText = `${title} ${bodyText}`.trim();
      visitedRoutes.push(new URL(targetUrl).pathname);
      return {
        response,
        title,
        combinedText,
        label
      };
    };

    const rootResult = await probeRoute(baseUrl, "Rendered page");
    if (rootResult.response?.ok()) {
      addCheck(checks, "Rendered page", "pass", `The app rendered successfully in a real browser${rootResult.title ? ` (${rootResult.title})` : ""}.`);
    } else {
      addCheck(checks, "Rendered page", "warning", "The browser opened the page, but the initial response was not clearly successful.");
    }

    const renderedAlignment = getTokenSimilarity(
      `${task?.title || ""} ${task?.description || ""} ${progressLog?.note || ""}`,
      rootResult.combinedText
    );
    if (renderedAlignment >= 0.12) {
      addCheck(checks, "Rendered content", "pass", "Rendered browser content appears relevant to the assigned task.");
    } else if (renderedAlignment > 0) {
      addCheck(checks, "Rendered content", "warning", "The page rendered, but the visible browser content only weakly matches the assigned task.");
    } else {
      addCheck(checks, "Rendered content", "warning", "The page rendered, but the visible browser content could not confirm the assigned task.");
    }

    const candidatePaths = deriveCandidatePaths(task, progressLog).filter((candidate) => candidate !== "/");
    let routeFound = false;
    for (const candidate of candidatePaths.slice(0, 6)) {
      try {
        const routeResult = await probeRoute(new URL(candidate, baseUrl).toString(), "Browser route");
        if (routeResult.response?.ok()) {
          routeFound = true;
          addCheck(checks, "Browser route", "pass", `Browser navigation to ${candidate} succeeded.`);
          break;
        }
      } catch {
        // Ignore route misses and continue probing.
      }
    }
    if (!routeFound && candidatePaths.length > 0) {
      addCheck(checks, "Browser route", "warning", "The app rendered, but no likely feature route could be confirmed in the browser automatically.");
    }

    if (screenshotDir) {
      await fs.mkdir(screenshotDir, { recursive: true });
      const screenshotPath = path.join(screenshotDir, "verification.png");
      await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
      if (await fileExists(screenshotPath)) {
        addCheck(checks, "Browser capture", "pass", "A verification screenshot was captured from the rendered page.");
      }
    }

    await runConfiguredRoleScenarios({ browser, baseUrl, task, progressLog, checks });
  } catch (error) {
    addCheck(
      checks,
      BROWSER_PLACEHOLDER_LABEL,
      "warning",
      `Browser automation could not complete: ${error.message}`
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
};

const verifyLiveUrl = async (job, task, progressLog) => {
  const checks = [];
  const response = await fetchWithTimeout(job.evidenceUrl);
  if (!response.ok) {
    addCheck(checks, "Page reachability", "fail", `The URL responded with HTTP ${response.status}.`);
    return {
      status: "fail",
      summary: buildSummary("fail", checks),
      runtimeStatus: "completed",
      checks
    };
  }

  const body = await response.text();
  addCheck(checks, "Page reachability", "pass", `The URL responded successfully with HTTP ${response.status}.`);
  const pageText = `${response.url} ${stripHtml(body).slice(0, 12000)}`;
  const alignment = getTokenSimilarity(`${task?.title || ""} ${task?.description || ""} ${progressLog?.note || ""}`, pageText);
  if (alignment >= 0.12) {
    addCheck(checks, "Task match", "pass", "The live page content appears related to the assigned task.");
  } else {
    addCheck(checks, "Task match", "warning", "The live page was reachable, but task-specific content could not be strongly confirmed.");
  }

  const candidatePaths = deriveCandidatePaths(task, progressLog);
  const baseUrl = new URL(job.evidenceUrl);
  for (const candidate of candidatePaths.slice(0, 4)) {
    if (candidate === "/") continue;
    try {
      const candidateUrl = new URL(candidate, `${baseUrl.protocol}//${baseUrl.host}`);
      const candidateResponse = await fetchWithTimeout(candidateUrl.toString());
      if (candidateResponse.ok) {
        addCheck(checks, "Feature route", "pass", `Candidate route ${candidate} responded successfully.`);
        break;
      }
    } catch {
      // Ignore candidate misses.
    }
  }

  const browserWorkspace = await createJobWorkspace(`${job._id}-url-browser`);
  await runBrowserVerification({
    baseUrl: job.evidenceUrl,
    task,
    progressLog,
    checks,
    screenshotDir: browserWorkspace.baseDir
  });

  const status = scoreStatus(checks);
  return {
    status,
    summary: buildSummary(status, checks),
    runtimeStatus: "completed",
    checks
  };
};

const verifyArchiveProject = async (job, task, progressLog) => {
  const checks = [];
  const archivePath = resolveUploadedEvidencePath(job.evidenceUrl);
  if (!archivePath) {
    addCheck(checks, "Archive path", "fail", "The uploaded archive path is invalid.");
    return { status: "fail", summary: buildSummary("fail", checks), runtimeStatus: "completed", checks };
  }

  const { extractDir } = await createJobWorkspace(job._id);
  await extractZipArchive(archivePath, extractDir);
  addCheck(checks, "Archive extraction", "pass", "The uploaded archive was extracted into an isolated workspace.");

  const projectRoot = await findProjectRoot(extractDir);
  if (!projectRoot) {
    addCheck(checks, "Project detection", "fail", "No package.json was found in the uploaded project archive.");
    return { status: "fail", summary: buildSummary("fail", checks), runtimeStatus: "completed", checks };
  }

  addCheck(checks, "Project detection", "pass", `Detected project root at ${path.basename(projectRoot)}.`);

  const packageJson = JSON.parse(await fs.readFile(path.join(projectRoot, "package.json"), "utf8"));
  if (!packageJson?.scripts) {
    addCheck(checks, "Package scripts", "fail", "The uploaded project does not define runnable package scripts.");
    return { status: "fail", summary: buildSummary("fail", checks), runtimeStatus: "completed", checks };
  }

  const installResult = await runCommand({
    command: "npm.cmd",
    args: ["install", "--ignore-scripts"],
    cwd: projectRoot,
    timeoutMs: JOB_TIMEOUT_MS
  });
  if (installResult.code !== 0) {
    addCheck(checks, "Dependency install", "fail", "Dependencies could not be installed in the isolated workspace.");
    return { status: "fail", summary: buildSummary("fail", checks), runtimeStatus: "completed", checks };
  }
  addCheck(checks, "Dependency install", "pass", "Dependencies installed successfully in the isolated workspace.");

  if (packageJson.scripts.build) {
    const buildResult = await runCommand({
      command: "npm.cmd",
      args: ["run", "build"],
      cwd: projectRoot,
      timeoutMs: JOB_TIMEOUT_MS
    });
    if (buildResult.code !== 0) {
      addCheck(checks, "Build", "fail", "The uploaded project failed to build.");
      return { status: "fail", summary: buildSummary("fail", checks), runtimeStatus: "completed", checks };
    }
    addCheck(checks, "Build", "pass", "The uploaded project built successfully.");
  } else {
    addCheck(checks, "Build", "warning", "No build script was found, so only runtime startup checks were attempted.");
  }

  const randomPort = 4200 + Math.floor(Math.random() * 400);
  let serverCommand = null;
  let serverArgs = [];
  if (packageJson.scripts.dev) {
    serverCommand = "npm.cmd";
    serverArgs = ["run", "dev", "--", "--host", "127.0.0.1", "--port", String(randomPort)];
  } else if (packageJson.scripts.start) {
    serverCommand = "npm.cmd";
    serverArgs = ["run", "start"];
  }

  if (!serverCommand) {
    addCheck(checks, "Runtime start", "warning", "No start/dev script was found, so the project could not be opened automatically.");
    const status = scoreStatus(checks);
    return { status, summary: buildSummary(status, checks), runtimeStatus: "completed", checks };
  }

  const server = startServerCommand({
    command: serverCommand,
    args: serverArgs,
    cwd: projectRoot,
    env: { PORT: String(randomPort), HOST: "127.0.0.1", BROWSER: "none", CI: "true" }
  });

  try {
    const reachable = await waitForUrl(`http://127.0.0.1:${randomPort}`);
    addCheck(checks, "Runtime start", "pass", "The uploaded project started and responded over HTTP.");

    const rootText = `${reachable.response.url} ${stripHtml(reachable.text).slice(0, 12000)}`;
    const rootAlignment = getTokenSimilarity(`${task?.title || ""} ${task?.description || ""} ${progressLog?.note || ""}`, rootText);
    if (rootAlignment >= 0.1) {
      addCheck(checks, "Feature content", "pass", "The running project content appears relevant to the assigned task.");
    } else {
      addCheck(checks, "Feature content", "warning", "The project runs, but the root page content does not strongly confirm the assigned feature.");
    }

    const candidatePaths = deriveCandidatePaths(task, progressLog);
    let featureRouteFound = false;
    for (const candidate of candidatePaths.slice(0, 5)) {
      try {
        const response = await fetchWithTimeout(`http://127.0.0.1:${randomPort}${candidate}`);
        if (response.ok) {
          featureRouteFound = true;
          addCheck(checks, "Feature route", "pass", `Candidate route ${candidate} responded successfully on the running project.`);
          break;
        }
      } catch {
        // Ignore and keep probing.
      }
    }
    if (!featureRouteFound) {
      addCheck(checks, "Feature route", "warning", "The project runs, but no candidate feature route could be confirmed automatically.");
    }

    await runBrowserVerification({
      baseUrl: `http://127.0.0.1:${randomPort}`,
      task,
      progressLog,
      checks,
      screenshotDir: extractDir
    });
  } catch (error) {
    addCheck(checks, "Runtime start", "fail", `The uploaded project could not be opened automatically: ${error.message}`);
  } finally {
    await stopChild(server.child);
  }

  const status = scoreStatus(checks);
  return {
    status,
    summary: buildSummary(status, checks),
    runtimeStatus: "completed",
    checks
  };
};

const markJobRunning = async (job) =>
  {
    const runningJob = await VerificationJob.findByIdAndUpdate(
      job._id,
      { status: "running", startedAt: new Date(), summary: "Runtime verification is running." },
      { new: true }
    );
    if (runningJob) {
      await updateTaskLogRuntimeState(runningJob, "running", "Full runtime verification is running.");
    }
    return runningJob;
  };

const finalizeJob = async (job, result, logText = "") => {
  const status = result.status === "fail" ? "fail" : result.status === "warning" ? "warning" : "pass";
  await VerificationJob.findByIdAndUpdate(job._id, {
    status,
    summary: result.summary,
    checks: result.checks,
    log: logText,
    completedAt: new Date()
  });
  await updateTaskLogVerification(job, result);
};

const failJob = async (job, error) => {
  const result = {
    status: "fail",
    runtimeStatus: "error",
    summary: "Runtime verification crashed before it could complete.",
    checks: [
      {
        label: RUNTIME_PLACEHOLDER_LABEL,
        status: "fail",
        message: error?.message || "Unknown runtime verification error."
      }
    ]
  };
  await VerificationJob.findByIdAndUpdate(job._id, {
    status: "error",
    summary: result.summary,
    checks: result.checks,
    log: String(error?.stack || error?.message || error),
    completedAt: new Date()
  });
  await updateTaskLogVerification(job, result);
};

export const processNextVerificationJob = async () => {
  const queuedJob = await VerificationJob.findOne({ status: "queued" }).sort({ createdAt: 1 });
  if (!queuedJob) return false;

  const job = await markJobRunning(queuedJob);
  if (!job) return false;

  try {
    const task = await Task.findById(job.taskId).lean();
    const progressLog = task?.progressLogs?.find((entry) => entry.entryId === job.progressEntryId);
    if (!task || !progressLog) {
      throw new Error("The task or submission for this verification job no longer exists.");
    }

    let result;
    if (job.mode === "url") {
      result = await verifyLiveUrl(job, task, progressLog);
    } else {
      result = await verifyArchiveProject(job, task, progressLog);
    }

    await finalizeJob(job, result);
    return true;
  } catch (error) {
    await failJob(job, error);
    return true;
  }
};

export const startVerificationWorker = () => {
  const intervalMs = Number(process.env.RUNTIME_VERIFIER_POLL_MS || 10000);
  console.log(`Runtime verification worker polling every ${intervalMs}ms`);
  const run = async () => {
    try {
      let processed = true;
      while (processed) {
        processed = await processNextVerificationJob();
      }
    } catch (error) {
      console.error("Runtime verification worker loop failed", error);
    }
  };
  void run();
  return setInterval(run, intervalMs);
};

export const getRuntimeVerificationMode = getRuntimeModeForEvidence;
