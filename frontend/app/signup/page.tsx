"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error } = await createClient().auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (!data.session) {
      router.push("/login");
      return;
    }
    router.push("/chats");
    router.refresh();
  }

  const field = (
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement>,
  ) => (
    <label className="grid gap-1 text-sm">
      <span className="text-wa-subtle">{label}</span>
      <input
        {...props}
        className="rounded-lg border border-wa-line px-3 py-2 outline-none focus:border-wa-green"
      />
    </label>
  );

  return (
    <div className="min-h-screen bg-wa-panel">
      <div className="h-32 bg-wa-teal" />
      <div className="mx-auto -mt-20 max-w-md px-4">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full bg-wa-green text-white">
              <MessageCircle size={24} />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-wa-ink">WhatsApp+</h1>
              <p className="text-sm text-wa-subtle">Create your account</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="grid gap-4">
            {field("Display name", {
              type: "text",
              required: true,
              value: displayName,
              onChange: (e) => setDisplayName(e.target.value),
            })}
            {field("Email", {
              type: "email",
              required: true,
              value: email,
              onChange: (e) => setEmail(e.target.value),
            })}
            {field("Password", {
              type: "password",
              required: true,
              minLength: 6,
              value: password,
              onChange: (e) => setPassword(e.target.value),
            })}
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-wa-green py-2.5 font-medium text-white disabled:opacity-50"
            >
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-wa-subtle">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-wa-green-dark">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
