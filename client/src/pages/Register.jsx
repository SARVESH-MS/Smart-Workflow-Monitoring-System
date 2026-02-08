import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../api/auth.js";
import { useAuth } from "../utils/AuthContext.jsx";

const Register = () => {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "employee",
    teamRole: "frontend"
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = await register(form);
      setSession(data.token, data.user);
      if (data.user.role === "admin") navigate("/admin");
      if (data.user.role === "manager") navigate(`/manager/${data.user.id}`);
      if (data.user.role === "employee") navigate(`/employee/${data.user.id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Register failed");
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold">Create your account</h2>
      <p className="text-sm text-slate-400">Choose a role to view dashboards</p>
      <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
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
        <select
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
        >
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="employee">Employee</option>
        </select>
        <select
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm"
          value={form.teamRole}
          onChange={(e) => setForm({ ...form, teamRole: e.target.value })}
        >
          <option value="designer">Designer</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="tester">Tester</option>
        </select>
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button className="btn-primary" type="submit">Create account</button>
        <button className="btn-ghost" type="button" onClick={() => navigate("/login")}>Back to login</button>
      </form>
    </div>
  );
};

export default Register;
