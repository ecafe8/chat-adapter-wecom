import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chat SDK WeCom Example",
  description: "Local test app for the Chat SDK WeCom adapter",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body style={{ fontFamily: "system-ui", margin: "0 auto", maxWidth: 760, padding: 32 }}>
        {children}
      </body>
    </html>
  );
}
