import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
  <div className="min-h-screen grid place-items-center text-center">
    <div>
      <h1 className="text-4xl font-semibold">Page not found</h1>
      <p className="text-slate-400">The page you are looking for does not exist.</p>
      <Link className="btn-primary mt-6 inline-flex" to="/">Go home</Link>
    </div>
  </div>
);

export default NotFound;
