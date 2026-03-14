import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleAuth, register } from "../api/auth.js";
import GoogleAuthButton from "../components/GoogleAuthButton.jsx";

const Register = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    companyId: "",
    role: "",
    teamRole: "frontend"
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      if (!form.role) {
        setError("Select a role to continue.");
        return;
      }
      const payload = {
        ...form,
        ...(form.role === "employee" ? {} : { teamRole: undefined })
      };
      const data = await register(payload);
      setSuccess(data.message || "Your progress has been sent to the Admin.");
    } catch (err) {
      setError(err.response?.data?.message || "Register failed");
    }
  };

  const goToAuthRoute = (path) => {
    const container = document.getElementById("landing-scroll");
    if (container) {
      container.scrollTo({ top: 0, behavior: "auto" });
    }
    navigate(path);
  };

  const handleGoogleRegister = async (credential) => {
    setError("");
    setSuccess("");
    try {
      if (!form.role) {
        setError("Select a role to continue.");
        return;
      }
      const payload = {
        credential,
        mode: "register",
        companyId: form.companyId,
        role: form.role,
        ...(form.role === "employee" ? { teamRole: form.teamRole } : {})
      };
      const data = await googleAuth(payload);
      setSuccess(data.message || "Your progress has been sent to the Admin.");
    } catch (err) {
      setError(err.response?.data?.message || "Google sign up failed");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Sign up</h2>
      <p className="text-sm text-slate-400">Set up your profile and role access.</p>
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Full name</span>
        <input
          className="auth-field w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        </label>
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
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Company ID</span>
        <input
          className="auth-field w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          placeholder="Enter company ID"
          value={form.companyId}
          onChange={(e) => setForm({ ...form, companyId: e.target.value })}
        />
        </label>
        <label className="grid gap-2">
          <span className="text-xs uppercase tracking-wide text-slate-400">Role</span>
        <select
          className="auth-field w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="">Select role</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </select>
        </label>
        {form.role === "employee" && (
          <label className="grid gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">Team role</span>
          <select
            className="auth-field w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
            value={form.teamRole}
            onChange={(e) => setForm({ ...form, teamRole: e.target.value })}
          >
            <option value="designer">Designer</option>
            <option value="frontend">Frontend</option>
            <option value="backend">Backend</option>
            <option value="tester">Tester</option>
          </select>
          </label>
        )}
        {error && <div className="text-sm text-red-400">{error}</div>}
        {success && <div className="text-sm text-emerald-300">{success}</div>}
        <button className="btn-primary" type="submit">Sign Up</button>
        <GoogleAuthButton text="signup_with" onCredential={handleGoogleRegister} onError={setError} />
        <button className="btn-ghost" type="button" onClick={() => goToAuthRoute("/login")}>Back to login</button>
      </form>
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
        Use manager/employee roles for team workflows and admin for portfolio governance.
      </div>
    </div>
  );
};

export default Register;
