"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // The environment variable name is correctly defined and fetched here.
  const apiUrl = process.env.NEXT_PUBLIC_BACKEND_SIGNUP;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // --- Added form validation to prevent ZodError on empty fields ---
    if (!form.name || !form.email || !form.password) {
      setError("Please fill out all fields.");
      setLoading(false);
      return;
    }
    // --- End of added validation ---

    // A crucial check to prevent the 'Failed to fetch' error
    if (!apiUrl) {
      setError(
        "Signup API URL is not configured. Please check your .env file."
      );
      setLoading(false);
      return;
    }

    try {
      // Correct variable name is used here.
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const data = await res.json();
        // The error message comes from the NestJS backend's `ConflictException`.
        throw new Error(data.message || "Signup failed.");
      }

      // Auto-login after successful signup
      const result = await signIn("credentials", {
        redirect: false,
        email: form.email,
        password: form.password,
      });

      // Corrected logic: redirect to the home page on success, and show an error if auto-login fails.
      if (result?.error) {
        setError(
          "Error logging in after signup. Please try to sign in manually."
        );
        router.push("/signin"); // Redirect to sign-in page if auto-login fails
      } else {
        router.push("/"); // Redirect to home page on success
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
            className="bg-blue-500 text-white w-full py-2 rounded hover:bg-blue-600 disabled:bg-blue-300"
            disabled={loading}
          >
            {loading ? "Signing Up..." : "Sign Up"}
          </button>
        </form>

        {error && (
          <p className="text-red-600 text-sm mt-4 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
