
"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";

type Order = {
  id: string;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  order_status: string;
  total?: number;
  created_at?: string;
  delivery_notes?: string;
};

type Partner = {
  id: string;
  name: string;
  phone: string;
};

export default function DeliveryPartnerPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [partner, setPartner] = useState<Partner | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/delivery-partner/orders", {
        method: "GET",
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Orders load nahi hue.");
        return;
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setMessage("");
    } catch {
      setMessage("Network error. Dobara try karo.");
    }
  }, []);

  useEffect(() => {
    if (partner) {
      void loadOrders();
    }
  }, [partner, loadOrders]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/delivery-partner/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Login failed.");
        return;
      }

      if (!data.partner?.name) {
        setMessage("Login response incomplete. Please try again.");
        return;
      }

      setPartner(data.partner);
      setPin("");
      setMessage("Login successful!");
    } catch {
      setMessage("Network error. Dobara try karo.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(orderId: string, status: string) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/delivery-partner/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Status update nahi hua.");
        return;
      }

      setMessage("Order status updated!");
      await loadOrders();
    } catch {
      setMessage("Network error. Dobara try karo.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);

    try {
      const response = await fetch("/api/delivery-partner/logout", {
        method: "POST",
      });

      if (!response.ok) {
        setMessage("Logout nahi hua. Dobara try karo.");
        return;
      }

      setPartner(null);
      setOrders([]);
      setPhone("");
      setPin("");
      setMessage("Logged out successfully.");
    } catch {
      setMessage("Network error. Dobara try karo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-gray-50 p-4 text-gray-900">
      <header className="mb-6">
        <h1 className="text-3xl font-bold">QuickBasket Delivery</h1>
        <p className="mt-1 text-gray-600">Delivery Partner Panel</p>
      </header>

      {message && (
        <div
          role="status"
          className="mb-4 rounded-lg bg-blue-100 p-3 text-blue-900"
        >
          {message}
        </div>
      )}

      {!partner ? (
        <form
          onSubmit={login}
          className="space-y-4 rounded-xl bg-white p-5 shadow"
        >
          <h2 className="text-xl font-semibold">Partner Login</h2>

          <label className="block">
            <span>Mobile number</span>
            <input
              className="mt-1 w-full rounded-lg border p-3"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              autoComplete="tel"
              required
            />
          </label>

          <label className="block">
            <span>6-digit PIN</span>
            <input
              className="mt-1 w-full rounded-lg border p-3"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              autoComplete="current-password"
              required
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-700 p-3 font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Please wait..." : "Login"}
          </button>
        </form>
      ) : (
        <>
          <section className="mb-5 flex items-center justify-between gap-3 rounded-xl bg-white p-4 shadow">
            <div>
              <p className="text-sm text-gray-500">Welcome</p>
              <h2 className="text-xl font-semibold">{partner.name}</h2>
              <p className="text-sm text-gray-600">{partner.phone}</p>
            </div>

            <button
              type="button"
              onClick={() => void logout()}
              disabled={loading}
              className="rounded-lg border px-4 py-2 disabled:opacity-50"
            >
              Logout
            </button>
          </section>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">My Orders</h2>
            <button
              type="button"
              onClick={() => void loadOrders()}
              disabled={loading}
              className="rounded-lg border bg-white px-3 py-2 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-xl bg-white p-5 shadow">
              <p>Abhi koi assigned order nahi hai.</p>
              <p className="mt-1 text-sm text-gray-500">
                Naye assigned orders dekhne ke liye Refresh dabao.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="space-y-3 rounded-xl bg-white p-5 shadow"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-bold">
                      Order #{order.order_number || order.id.slice(0, 8)}
                    </h3>
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold">
                      {order.order_status}
                    </span>
                  </div>

                  <p>Customer: {order.customer_name || "N/A"}</p>
                  <p>Phone: {order.customer_phone || "N/A"}</p>
                  <p>Address: {order.delivery_address || "N/A"}</p>
                  <p>Total: ₹{Number(order.total || 0).toFixed(2)}</p>

                  {order.delivery_notes && (
                    <p>Notes: {order.delivery_notes}</p>
                  )}

                  {order.order_status === "placed" && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void updateStatus(order.id, "preparing")
                      }
                      className="w-full rounded-lg bg-blue-700 p-3 text-white disabled:opacity-50"
                    >
                      Accept / Preparing
                    </button>
                  )}

                  {order.order_status === "preparing" && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void updateStatus(order.id, "out_for_delivery")
                      }
                      className="w-full rounded-lg bg-orange-600 p-3 text-white disabled:opacity-50"
                    >
                      Out for Delivery
                    </button>
                  )}

                  {order.order_status === "out_for_delivery" && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void updateStatus(order.id, "delivered")
                      }
                      className="w-full rounded-lg bg-green-700 p-3 text-white disabled:opacity-50"
                    >
                      Mark Delivered
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
