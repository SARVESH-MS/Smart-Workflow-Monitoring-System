import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/auth.js";
import { useAuth } from "../utils/AuthContext.jsx";

const Login = () => {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
  }, [form]);

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

  return (
    <div>
      <h2 className="text-2xl font-semibold">Welcome back</h2>
      <p className="text-sm text-slate-400">Sign in to your dashboard</p>
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <input
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button className="btn-primary" type="submit">Sign In</button>
        <button className="btn-ghost" type="button" onClick={() => navigate("/register")}>
          Create account
        </button>
      </form>
    </div>
  );
};

export default Login;
