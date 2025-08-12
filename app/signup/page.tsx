"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const apiURl = process.env.BACKEND_SIGNUP;
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    const res = await fetch(`${apiURl}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Signup failed");
      return;
    }

    // Auto-login after successful signup
    const result = await signIn("credentials", {
      redirect: false,
      name: form.name,
      password: form.password,
    });

    if (result?.ok) {
      router.push("/signin");
    } else {
      router.push("/");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h1 className="text-xl font-semibold mb-4">Sign Up</h1>

        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="Username"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="border px-3 py-2 w-full mb-2"
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="border px-3 py-2 w-full mb-2"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="border px-3 py-2 w-full mb-4"
            required
          />
          <button
            type="submit"
            className="bg-blue-500 text-white w-full py-2 rounded hover:bg-blue-600"
          >
            Sign Up
          </button>
        </form>

        {error && (
          <p className="text-green-600 text-sm mt-4 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
