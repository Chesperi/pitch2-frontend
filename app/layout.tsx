import type { Metadata } from "next";
import "./globals.css";
import { oscine } from "./fonts";

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
    <html lang="it" className={oscine.variable}>
      <body className="bg-pitch-bg text-pitch-white font-oscine antialiased">
        {children}
      </body>
    </html>
  );
}
