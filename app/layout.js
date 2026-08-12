import './globals.css';
import { Inter } from "next/font/google";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: 'Naga Films Studio — AI Image, Video & Cinema',
  description: 'Naga Films Studio — generate AI images, video, cinema shots and lip sync across 200+ models. Self-hostable, unrestricted, bring your own key.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
