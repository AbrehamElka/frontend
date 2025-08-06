"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async () => {
    const res = await signIn("credentials", {
      redirect: false,
      email,
      password,
    });

    if (res?.ok) {
      router.push("/room");
    } else {
      alert("Login failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-8 bg-white rounded shadow-md w-96">
        <h1 className="text-xl font-semibold mb-4">Sign In</h1>
        <input
          placeholder="Name"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border px-3 py-2 w-full mb-2"
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border px-3 py-2 w-full mb-4"
        />
        <button
          onClick={handleLogin}
          className="bg-blue-500 text-white w-full py-2 rounded hover:bg-blue-600"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
