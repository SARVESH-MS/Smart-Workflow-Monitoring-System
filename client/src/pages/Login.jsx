import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { googleAuth, login } from "../api/auth.js";
import { useAuth } from "../utils/AuthContext.jsx";
import GoogleAuthButton from "../components/GoogleAuthButton.jsx";

const Login = () => {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

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
      const data = await login(form);
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
      const data = await googleAuth({ credential, mode: "login" });
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
      <h2 className="text-2xl font-semibold">Welcome back</h2>
      <p className="text-sm text-slate-400">Sign in to continue to your workspace.</p>
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
