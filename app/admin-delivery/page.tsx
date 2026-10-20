
"use client";

import { useState } from "react";

type Order = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  order_status: string;
  total: number;
  created_at: string;
  assigned_partner_id: string | null;
  assigned_at: string | null;
};

type Partner = {
  id: string;
  full_name: string;
  phone: string;
  is_active: boolean;
};

const statusOptions = [
  { value: "placed", label: "Order placed" },
  { value: "preparing", label: "Preparing" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function DeliveryAdminPage() {
  const [key, setKey] = useState("");
  const [connected, setConnected] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function api(body?: object) {
    return fetch("/api/admin/delivery", {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        "x-delivery-admin-key": key,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: "no-store",
    });
  }

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const response = await api();
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load data.");
      }

      setOrders(data.orders || []);
      setPartners(data.partners || []);
      setConnected(true);
      setMessage("Connected successfully.");
    } catch (error) {
      setConnected(false);
      setMessage(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  async function addPartner(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    try {
      const response = await api({
        action: "add_partner",
        fullName: name,
        phone,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Partner could not be added.");
      }

      setName("");
      setPhone("");
      await loadData();
      setMessage("Delivery partner added successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    }
  }

  async function assignOrder(orderId: string) {
    const partnerId = assignments[orderId];
    if (!partnerId) {
      setMessage("Please select a delivery partner first.");
      return;
    }

    setMessage("");

    try {
      const response = await api({
        action: "assign_order",
        orderId,
        partnerId,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Assignment failed.");
      }

      await loadData();
      setMessage("Order assigned successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Assignment failed.");
    }
  }

  async function updateStatus(orderId: string) {
    const status = statuses[orderId];
    if (!status) {
      setMessage("Please select an order status first.");
      return;
    }

    setMessage("");

    try {
      const response = await api({
        action: "update_order_status",
        orderId,
        status,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Status update failed.");
      }

      await loadData();
      setMessage("Order status updated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Status update failed.");
    }
  }

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#172033",
      }}
    >
      <h1>QuickBasket Delivery Admin</h1>
      <p>Manage orders, delivery partners and order status.</p>

      <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <h2>Admin Access</h2>
        <form onSubmit={(e) => { e.preventDefault(); void loadData(); }}>
          <label htmlFor="admin-key">Delivery admin key</label>
          <input
            id="admin-key"
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setConnected(false); }}
            required
            autoComplete="current-password"
            placeholder="Enter your Vercel DELIVERY_ADMIN_KEY"
            style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 12, margin: "8px 0" }}
          />
          <button type="submit" disabled={loading} style={{ padding: "10px 16px" }}>
            {loading ? "Connecting..." : "Connect / Refresh"}
          </button>
        </form>
      </section>

      {message && <p role="status">{message}</p>}

      {connected && (
        <>
          <section style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 20 }}>
            <h2>Add Delivery Partner</h2>
            <form onSubmit={addPartner}>
              <label htmlFor="partner-name">Full name</label>
              <input
                id="partner-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                maxLength={100}
                style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 10, margin: "8px 0" }}
              />

              <label htmlFor="partner-phone">10-digit mobile number</label>
              <input
                id="partner-phone"
                type="tel"
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                maxLength={10}
                placeholder="9876543210"
                style={{ display: "block", width: "100%", boxSizing: "border-box", padding: 10, margin: "8px 0" }}
              />

              <button type="submit" style={{ padding: "10px 16px" }}>
                Add Partner
              </button>
            </form>

            <h3>Delivery Partners ({partners.length})</h3>
            {partners.length === 0 ? (
              <p>No partners added yet.</p>
            ) : (
              <ul>
                {partners.map((p) => (
                  <li key={p.id}>
                    {p.full_name} — {p.phone} {p.is_active ? "(Active)" : "(Inactive)"}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Customer Orders ({orders.length})</h2>

            {orders.length === 0 ? (
              <p>No orders found.</p>
            ) : (
              orders.map((order) => (
                <article
                  key={order.id}
                  style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 14 }}
                >
                  <h3>Order #{order.order_number}</h3>
                  <p><strong>Customer:</strong> {order.customer_name} ({order.customer_phone})</p>
                  <p><strong>Address:</strong> {order.delivery_address}</p>
                  <p><strong>Status:</strong> {statusOptions.find((s) => s.value === order.order_status)?.label || order.order_status}</p>
                  <p><strong>Total:</strong> ₹{Number(order.total).toFixed(2)}</p>
                  <p><strong>Placed:</strong> {new Date(order.created_at).toLocaleString("en-IN")}</p>
                  <p>
                    <strong>Assigned partner:</strong>{" "}
                    {partners.find((p) => p.id === order.assigned_partner_id)?.full_name || "Not assigned"}
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                    <select
                      aria-label={`Partner for order ${order.order_number}`}
                      value={assignments[order.id] ?? order.assigned_partner_id ?? ""}
                      onChange={(e) => setAssignments((old) => ({ ...old, [order.id]: e.target.value }))}
                      style={{ padding: 10, flex: 1, minWidth: 180 }}
                    >
                      <option value="">Select delivery partner</option>
                      {partners.filter((p) => p.is_active).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.full_name} — {p.phone}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => void assignOrder(order.id)}
                      disabled={!partners.some((p) => p.is_active)}
                      style={{ padding: "10px 16px" }}
                    >
                      Assign Order
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <select
                      aria-label={`Status for order ${order.order_number}`}
                      value={statuses[order.id] ?? order.order_status}
                      onChange={(e) => setStatuses((old) => ({ ...old, [order.id]: e.target.value }))}
                      style={{ padding: 10, flex: 1, minWidth: 180 }}
                    >
                      {statusOptions.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>

                    <button
                      onClick={() => void updateStatus(order.id)}
                      style={{ padding: "10px 16px" }}
                    >
                      Update Status
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
