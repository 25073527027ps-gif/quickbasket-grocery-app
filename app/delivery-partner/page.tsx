
"use client";

import { useCallback, useEffect, useState } from "react";

type Order = {
  id: string;
  order_number?: string;
  customer_name?: string;
  customer_phone?: string;
  delivery_address?: string;
  order_status: string;
  total?: number;
  created_at?: string;
};

export default function DeliveryPartnerPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [partner, setPartner] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/delivery-partner/orders", {
        cache: "no-store",
      });
      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Orders load nahi hue.");
        return;
      }

      setOrders(data.orders || []);
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

  async function login(event: React.FormEvent<HTMLFormElement>) {
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
      } else {
        setPartner(data.partner.name);
        setMessage("Login successful!");
      }
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Status update nahi hua.");
      } else {
        setMessage("Order status updated.");
        await loadOrders();
      }
    } catch {
      setMessage("Network error. Dobara try karo.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await fetch("/api/delivery-partner/logout", { method: "POST" });
    } finally {
      setPartner("");
      setOrders([]);
      setPin("");
      setMessage("Logged out.");
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-gray-50 p-4 text-gray-900">
      <h1 className="mb-2 text-3xl font-bold">QuickBasket Delivery</h1>
      <p className="mb-6 text-gray-600">Delivery Partner Panel</p>

      {message && (
        <p className="mb-4 rounded-lg bg-blue-100 p-3">{message}</p>
      )}

      {!partner ? (
        <form
          onSubmit={login}
          className="space-y-4 rounded-xl bg-white p-5 shadow"
        >
          <h2 className="text-xl font-semibold">Partner Login</h2>

          <label className="block">
            Mobile number
            <input
              className="mt-1 w-full rounded-lg border p-3"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="numeric"
              maxLength={10}
              required
            />
          </label>

          <label className="block">
            6-digit PIN
            <input
              className="mt-1 w-full rounded-lg border p-3"
              type="password"
              value={pin}
              onChange={(event) => setPin(event.target.value)}
              inputMode="numeric"
              maxLength={6}
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
          <section className="mb-5 flex items-center justify-between rounded-xl bg-white p-4 shadow">
            <div>
              <p className="text-sm text-gray-500">Welcome</p>
              <h2 className="text-xl font-semibold">{partner}</h2>
            </div>
            <button
              onClick={logout}
              className="rounded-lg border px-4 py-2"
            >
              Logout
            </button>
          </section>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold">My Orders</h2>
            <button
              onClick={() => void loadOrders()}
              className="rounded-lg border bg-white px-3 py-2"
            >
              Refresh
            </button>
          </div>

          {orders.length === 0 ? (
            <p className="rounded-xl bg-white p-5 shadow">
              Abhi koi assigned order nahi hai.
            </p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="space-y-3 rounded-xl bg-white p-5 shadow"
                >
                  <div className="flex justify-between gap-3">
                    <h3 className="font-bold">
                      Order #{order.order_number || order.id.slice(0, 8)}
                    </h3>
                    <span className="text-sm font-semibold">
                      {order.order_status}
                    </span>
                  </div>

                  <p>Customer: {order.customer_name || "N/A"}</p>
                  <p>Phone: {order.customer_phone || "N/A"}</p>
                  <p>Address: {order.delivery_address || "N/A"}</p>
                  <p>Total: ₹{Number(order.total || 0).toFixed(2)}</p>

                  {order.order_status === "placed" && (
                    <button
                      disabled={loading}
                      onClick={() =>
                        void updateStatus(order.id, "preparing")
                      }
                      className="w-full rounded-lg bg-blue-700 p-3 text-white"
                    >
                      Accept / Preparing
                    </button>
                  )}

                  {order.order_status === "preparing" && (
                    <button
                      disabled={loading}
                      onClick={() =>
                        void updateStatus(order.id, "out_for_delivery")
                      }
                      className="w-full rounded-lg bg-orange-600 p-3 text-white"
                    >
                      Out for Delivery
                    </button>
                  )}

                  {order.order_status === "out_for_delivery" && (
                    <button
                      disabled={loading}
                      onClick={() =>
                        void updateStatus(order.id, "delivered")
                      }
                      className="w-full rounded-lg bg-green-700 p-3 text-white"
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
