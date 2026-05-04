import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Setwise",
  description: "Adaptive training planner and workout tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
