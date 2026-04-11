import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PITCH_2",
  description: "PITCH_2 Dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="bg-pitch-bg text-pitch-white font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
