
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuickBasket - Grocery Delivery",
  description: "Fresh groceries delivered to your doorstep in Delhi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

