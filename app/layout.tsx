import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APEXTrack | Personal execution system",
  description: "A flexible daily tracker for work, training, DSA, and career growth.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
