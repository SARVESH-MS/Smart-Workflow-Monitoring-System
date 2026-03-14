import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleAuth, login } from "../api/auth.js";
import { useAuth } from "../utils/AuthContext.jsx";
import GoogleAuthButton from "../components/GoogleAuthButton.jsx";

const ROLE_LABELS = {
  admin: "Admin",
  manager: "Manager",
  employee: "Employee"
};

const Login = ({ role }) => {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const portalRole = role || selectedRole;
  const portalLabel = useMemo(() => ROLE_LABELS[portalRole] || "Role", [portalRole]);

  useEffect(() => {
    setError("");
  }, [form]);

  const goToAuthRoute = (path) => {
    const container = document.getElementById("landing-scroll");
    if (container) {
      container.scrollTo({ top: 0, behavior: "auto" });
    }
    navigate(path);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!portalRole) {
        setError("Select a role to continue.");
        return;
      }
      const payload = { ...form, role: portalRole };
      const data = await login(payload);
      if (portalRole && data.user.role !== portalRole) {
        setError(`${portalLabel} portal only. Use the correct login page.`);
        return;
      }
      setSession(data.token, data.user);
      if (data.user.role === "admin") navigate("/admin");
      if (data.user.role === "manager") navigate(`/manager/${data.user.id}`);
      if (data.user.role === "employee") navigate(`/employee/${data.user.id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    }
  };

  const handleGoogleLogin = async (credential) => {
    try {
      const enforceRole = Boolean(role);
      const data = await googleAuth({
        credential,
        mode: "login",
        ...(enforceRole ? { role: portalRole } : {})
      });
      if (enforceRole && data.user.role !== portalRole) {
        setError(`${portalLabel} portal only. Use the correct login page.`);
        return;
      }
      setSession(data.token, data.user);
      if (data.user.role === "admin") navigate("/admin");
      if (data.user.role === "manager") navigate(`/manager/${data.user.id}`);
      if (data.user.role === "employee") navigate(`/employee/${data.user.id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Google login failed");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-2xl font-semibold">
            {portalRole ? `${portalLabel} Login` : "Welcome back"}
          </h2>
          <p className="text-sm text-slate-400">
            {portalRole ? `Sign in to the ${portalLabel} portal.` : "Sign in to continue to your workspace."}
          </p>
        </div>
        {!role && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {["admin", "manager", "employee"].map((key) => (
              <button
                key={key}
                type="button"
                className={selectedRole === key ? "btn-primary px-3 py-1 text-xs" : "btn-ghost px-3 py-1 text-xs"}
                onClick={() => setSelectedRole(key)}
              >
                {ROLE_LABELS[key]}
              </button>
            ))}
          </div>
        )}
      </div>
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Email</span>
        <input
          className="auth-field w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        </label>
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Password</span>
        <input
          className="auth-field w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        </label>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button className="btn-primary" type="submit">Sign In</button>
        <GoogleAuthButton text="signin_with" onCredential={handleGoogleLogin} onError={setError} />
        <button className="btn-ghost" type="button" onClick={() => goToAuthRoute("/register")}>
          Sign Up
        </button>
      </form>
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        Authorized users only. Access is controlled by role and company approval.
      </div>
    </div>
  );
};

export default Login;
