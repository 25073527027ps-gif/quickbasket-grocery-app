
"use client";

import { useState } from "react";

export default function DeliveryPartnerPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/delivery-partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setMessage(`Welcome, ${data.partner?.name ?? "Partner"}! Login successful.`);
      } else {
        setMessage(data.message ?? "Login failed. Please try again.");
      }
    } catch {
      setMessage("Server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-100 px-4 py-10 text-gray-900">
      <section className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">QuickBasket</h1>
        <p className="mt-1 text-gray-600">Delivery Partner Login</p>

        <form onSubmit={login} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              Mobile Number
            </span>
            <input
              className="w-full rounded-lg border p-3"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              pattern="[0-9]{10}"
              value={phone}
              onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="Enter 10-digit mobile number"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">
              6-digit PIN
            </span>
            <input
              className="w-full rounded-lg border p-3"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={6}
              pattern="[0-9]{6}"
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Enter PIN"
              required
            />
          </label>

          <button
            className="w-full rounded-lg bg-green-700 p-3 font-semibold text-white disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Login"}
          </button>
        </form>

        {message && (
          <p role="status" className="mt-4 break-words text-sm">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}

