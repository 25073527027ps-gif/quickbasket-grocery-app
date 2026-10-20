
"use client";

import { useMemo, useState } from "react";

type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  unit: string;
  emoji: string;
};

const products: Product[] = [
  { id: 1, name: "Amul Taaza Milk", category: "Dairy", price: 36, unit: "500 ml", emoji: "🥛" },
  { id: 2, name: "Fresh Bread", category: "Bakery", price: 40, unit: "1 pack", emoji: "🍞" },
  { id: 3, name: "Fresh Apples", category: "Fruits", price: 120, unit: "1 kg", emoji: "🍎" },
  { id: 4, name: "Banana", category: "Fruits", price: 50, unit: "1 dozen", emoji: "🍌" },
  { id: 5, name: "Fresh Tomatoes", category: "Vegetables", price: 35, unit: "500 g", emoji: "🍅" },
  { id: 6, name: "Potatoes", category: "Vegetables", price: 30, unit: "1 kg", emoji: "🥔" },
  { id: 7, name: "Fresh Eggs", category: "Dairy", price: 72, unit: "6 pcs", emoji: "🥚" },
  { id: 8, name: "Orange Juice", category: "Beverages", price: 85, unit: "1 L", emoji: "🧃" },
];

const categories = ["All", "Fruits", "Vegetables", "Dairy", "Bakery", "Beverages"];

export default function Home() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<Record<number, number>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState("cod");
  const [message, setMessage] = useState("");

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "All" || p.category === category) &&
          p.name.toLowerCase().includes(search.toLowerCase())
      ),
    [search, category]
  );

  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const subtotal = products.reduce(
    (sum, p) => sum + p.price * (cart[p.id] || 0),
    0
  );
  const delivery = subtotal === 0 || subtotal >= 499 ? 0 : 25;
  const total = subtotal + delivery;
  const money = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

  function updateCart(id: number, change: number) {
    setCart((old) => {
      const next = { ...old };
      next[id] = Math.max(0, (next[id] || 0) + change);
      if (next[id] === 0) delete next[id];
      return next;
    });
    setMessage("");
  }

  function placeOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (count === 0) {
      setMessage("Please add products to your basket first.");
      return;
    }

    const orderNumber = "QB" + Date.now().toString().slice(-8);

    const order = {
      orderNumber,
      customer: name,
      phone,
      address,
      payment,
      items: products
        .filter((p) => cart[p.id])
        .map((p) => ({
          name: p.name,
          price: p.price,
          quantity: cart[p.id],
        })),
      total,
      createdAt: new Date().toISOString(),
    };

    const oldOrders = JSON.parse(
      localStorage.getItem("quickbasket-demo-orders") || "[]"
    );
    localStorage.setItem(
      "quickbasket-demo-orders",
      JSON.stringify([...oldOrders, order])
    );

    setMessage(
      `Demo order ${orderNumber} saved on this device. The store has NOT received it.`
    );
    setCart({});
    setName("");
    setPhone("");
    setAddress("");
  }

  return (
    <main>
      <header className="topbar">
        <div className="container nav">
          <a href="#" className="logo">Quick<span>Basket</span></a>
          <div className="location">Delivering to<strong>📍 Delhi, India</strong></div>
          <button className="primary" onClick={() => document.getElementById("basket")?.scrollIntoView({ behavior: "smooth" })}>
            🛒 Basket ({count})
          </button>
        </div>
      </header>

      <div className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">FRESH PICKS, FAIR PRICES</p>
            <h1>Groceries made easy.</h1>
            <p>Fresh fruits, daily essentials and pantry favourites delivered to your doorstep across Delhi.</p>
            <button className="primary" onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}>
              Shop groceries ↓
            </button>
          </div>
          <div className="hero-art">🛍️🥬🍊</div>
        </section>

        <section id="shop">
          <div className="section-heading">
            <div>
              <h2>Shop your favourites</h2>
              <p>Everyday essentials for your basket.</p>
            </div>
            <input
              className="search"
              placeholder="🔎 Search groceries..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="categories">
            {categories.map((item) => (
              <button
                key={item}
                className={`chip ${category === item ? "active" : ""}`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="products">
            {filtered.map((p) => (
              <article className="product" key={p.id}>
                <div className="product-art">{p.emoji}</div>
                <h3>{p.name}</h3>
                <p className="muted">{p.unit} · {p.category}</p>
                <div className="price-row">
                  <strong>{money(p.price)}</strong>
                  {cart[p.id] ? (
                    <div className="quantity">
                      <button onClick={() => updateCart(p.id, -1)}>−</button>
                      <b>{cart[p.id]}</b>
                      <button onClick={() => updateCart(p.id, 1)}>+</button>
                    </div>
                  ) : (
                    <button className="add" onClick={() => updateCart(p.id, 1)}>+ Add</button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {filtered.length === 0 && <p>No products found. Try another search.</p>}
        </section>

        <section className="basket" id="basket">
          <h2>Your basket 🧺</h2>
          {count === 0 ? (
            <p className="muted">Your basket is empty. Add some groceries to get started.</p>
          ) : (
            products.filter((p) => cart[p.id]).map((p) => (
              <div className="basket-item" key={p.id}>
                <span>{p.emoji} {p.name} × {cart[p.id]}</span>
                <strong>{money(p.price * cart[p.id])}</strong>
              </div>
            ))
          )}

          <div className="totals">
            <p><span>Subtotal</span><strong>{money(subtotal)}</strong></p>
            <p><span>Delivery</span><strong>{delivery === 0 && subtotal > 0 ? "FREE" : money(delivery)}</strong></p>
            <p className="grand-total"><span>Total</span><strong>{money(total)}</strong></p>
            <small>Free delivery on orders of ₹499 or more.</small>
          </div>

          <h3>Delivery details</h3>
          <form className="checkout" onSubmit={placeOrder}>
            <input
              required
              minLength={2}
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              required
              pattern="[6-9][0-9]{9}"
              title="Enter a valid 10-digit Indian mobile number"
              placeholder="10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <textarea
              required
              minLength={8}
              placeholder="Full delivery address in Delhi"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <select value={payment} onChange={(e) => setPayment(e.target.value)}>
              <option value="cod">Cash on Delivery</option>
              <option value="upi">UPI (payment gateway not connected)</option>
            </select>
            <button className="primary" type="submit">Place demo order · {money(total)}</button>
          </form>

          {message && <p className="notice" role="status">{message}</p>}
        </section>
      </div>

      <footer>© {new Date().getFullYear()} QuickBasket · Fresh groceries across Delhi.</footer>

      <style jsx>{`
        :global(*) { box-sizing: border-box; }
        :global(html) { scroll-behavior: smooth; }
        :global(body) { margin: 0; background: #f7faf5; color: #18261d; font-family: Arial, Helvetica, sans-serif; }
        :global(button), :global(input), :global(textarea), :global(select) { font: inherit; }
        button { cursor: pointer; }
        .container { max-width: 1100px; margin: auto; padding: 0 20px; }
        .topbar { background: white; border-bottom: 1px solid #e3ebe1; position: sticky; top: 0; z-index: 5; }
        .nav { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 72px; }
        .logo { font-size: 25px; font-weight: 800; color: #16834a; text-decoration: none; }
        .logo span { color: #18261d; }
        .location { font-size: 12px; color: #69766d; }
        .location strong { display: block; color: #18261d; font-size: 14px; margin-top: 3px; }
        .primary { background: #16834a; color: white; border: 0; border-radius: 10px; padding: 12px 16px; font-weight: 700; }
        .hero { margin: 32px 0; padding: 38px; border-radius: 24px; background: linear-gradient(120deg,#e0f4d9,#f1f9e8); display: grid; grid-template-columns: 1.4fr 1fr; align-items: center; gap: 20px; }
        .eyebrow { font-size: 12px; font-weight: 800; letter-spacing: 1.5px; color: #16834a; }
        h1 { font-size: clamp(36px,6vw,58px); letter-spacing: -2px; line-height: 1.05; margin: 12px 0; }
        .hero p:not(.eyebrow) { color: #53645a; line-height: 1.7; }
        .hero-art { text-align: center; font-size: clamp(60px,10vw,105px); }
        .section-heading { display: flex; justify-content: space-between; align-items: center; gap: 15px; }
        h2 { margin-bottom: 6px; font-size: 27px; }
        .section-heading p { color: #69766d; margin-top: 0; }
        .search { width: min(100%,320px); padding: 13px; border: 1px solid #e0e9df; border-radius: 10px; background: white; }
        .categories { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0; }
        .chip { background: white; border: 1px solid #e0e9df; border-radius: 30px; padding: 9px 14px; }
        .chip.active { background: #e0f4d9; color: #16834a; border-color: #b5dfac; font-weight: 700; }
        .products { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 15px; margin-bottom: 45px; }
        .product { background: white; border: 1px solid #e3ebe1; border-radius: 16px; padding: 13px; min-width: 0; }
        .product-art { height: 125px; display: grid; place-items: center; background: #f3f8ef; border-radius: 12px; font-size: 58px; }
        .product h3 { font-size: 15px; margin-bottom: 6px; }
        .muted { color: #69766d; font-size: 13px; }
        .price-row { display: flex; align-items: center; justify-content: space-between; gap: 5px; margin-top: 14px; }
        .add,.quantity button { background: #e1f3dc; color: #16834a; border: 0; border-radius: 8px; padding: 8px 10px; font-weight: 700; }
        .quantity { display: flex; align-items: center; gap: 8px; }
        .basket { background: white; border: 1px solid #e3ebe1; border-radius: 18px; padding: 22px; margin: 35px 0 55px; }
        .basket-item { display: flex; justify-content: space-between; gap: 10px; padding: 12px 0; border-bottom: 1px solid #edf1eb; }
        .totals { max-width: 350px; margin: 20px 0 25px auto; }
        .totals p { display: flex; justify-content: space-between; }
        .totals small { color: #69766d; }
        .grand-total { font-size: 20px; border-top: 1px solid #e3ebe1; padding-top: 12px; }
        .checkout { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .checkout input,.checkout textarea,.checkout select { width: 100%; border: 1px solid #dfe8dd; border-radius: 9px; padding: 12px; background: white; }
        .checkout textarea { min-height: 75px; grid-column: 1 / -1; }
        .checkout button { grid-column: 1 / -1; }
        .notice { padding: 12px; background: #fff4d8; color: #795514; border-radius: 9px; line-height: 1.5; }
        footer { border-top: 1px solid #e3ebe1; padding: 25px 20px; text-align: center; color: #69766d; font-size: 13px; }
        @media(max-width:700px) {
          .hero { grid-template-columns: 1fr; padding: 25px; }
          .hero-art { font-size: 65px; }
          .products { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
          .product-art { height: 105px; font-size: 48px; }
          .section-heading { align-items: stretch; flex-direction: column; }
          .search { width: 100%; }
          .location { display: none; }
          .checkout { grid-template-columns: 1fr; }
          .checkout textarea,.checkout button { grid-column: auto; }
          .nav { min-height: 65px; }
        }
      `}</style>
    </main>
  );
            }
