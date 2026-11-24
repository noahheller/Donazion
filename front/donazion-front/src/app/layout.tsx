import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from 'next/link'
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Donazion",
  description: "For CS3733",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <nav>
          <Link href="/">Home</Link>&nbsp;|&nbsp;
          <Link href="/donationCenter/register">Register Donation Center</Link>&nbsp;|&nbsp;
          <Link href="/donationCenter/login">Login Donation Center</Link>&nbsp;|&nbsp;
          <Link href="/donationCenter/remove">Remove Donation Center</Link>&nbsp;|&nbsp;
          <Link href="/organization/login">Login Organization</Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
