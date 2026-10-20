
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;

const PRODUCTS: Record<number, { name: string; price: number }> = {
  1: { name: "Amul Taaza Milk", price: 36 },
  2: { name: "Fresh Bread", price: 40 },
  3: { name: "Fresh Apples", price: 120 },
  4: { name: "Banana", price: 50 },
  5: { name: "Fresh Tomatoes", price: 35 },
  6: { name: "Potatoes", price: 30 },
  7: { name: "Fresh Eggs", price: 72 },
  8: { name: "Orange Juice", price: 85 },
};

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Order service is not configured yet." },
        { status: 503 }
      );
    }

    const body = await request.json();
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      paymentMethod,
      items,
    } = body;

    if (
      typeof customerName !== "string" ||
      customerName.trim().length < 2 ||
      customerName.length > 100 ||
      typeof customerPhone !== "string" ||
      !/^[6-9]\d{9}$/.test(customerPhone) ||
      typeof deliveryAddress !== "string" ||
      deliveryAddress.trim().length < 8 ||
      deliveryAddress.length > 500 ||
      paymentMethod !== "cod" ||
      !Array.isArray(items) ||
      items.length < 1 ||
      items.length > 8
    ) {
      return NextResponse.json(
        { error: "Please check your details and select Cash on Delivery." },
        { status: 400 }
      );
    }

    const seen = new Set<number>();
    const orderItems = [];

    for (const item of items) {
      const id = Number(item?.id);
      const quantity = Number(item?.quantity);
      const product = PRODUCTS[id];

      if (
        !product ||
        seen.has(id) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 50
      ) {
        return NextResponse.json(
          { error: "Invalid product or quantity." },
          { status: 400 }
        );
      }

      seen.add(id);
      orderItems.push({
        id,
        name: product.name,
        price: product.price,
        quantity,
      });
    }

    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const deliveryFee = subtotal >= 499 ? 0 : 25;
    const total = subtotal + deliveryFee;
    const orderNumber = `QB${crypto.randomUUID()
      .replace(/-/g, "")
      .slice(0, 10)
      .toUpperCase()}`;

    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/orders`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_SECRET_KEY,
          Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          order_number: orderNumber,
          customer_name: customerName.trim(),
          customer_phone: customerPhone,
          delivery_address: deliveryAddress.trim(),
          payment_method: "cod",
          payment_status: "pending",
          order_status: "placed",
          subtotal,
          delivery_fee: deliveryFee,
          total,
          items: orderItems,
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("Supabase order insert failed:", response.status);
      return NextResponse.json(
        { error: "Order could not be saved. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({ orderNumber }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Please try again." },
      { status: 400 }
    );
  }
}

