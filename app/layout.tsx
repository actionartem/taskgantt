import type React from "react"
import type { Metadata } from "next"
import { Tektur, Onest, JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { AppProvider } from "@/contexts/app-context"

const onest = Onest({subsets:['latin','cyrillic'],variable:'--font-onest',display:'swap'})
const tektur = Tektur({subsets:['latin','cyrillic'],variable:'--font-tektur',display:'swap'})
const mono = JetBrains_Mono({subsets:['latin','cyrillic'],variable:'--font-jbm',display:'swap'})

export const metadata: Metadata = {
  title: "SimpleTracker",
  description: "Мониторинг задач",
  generator: "artivtw",
  icons: {
    icon: [
      { rel: "icon", url: "/favicon_cat_16.png", sizes: "16x16", type: "image/png" },
      { rel: "icon", url: "/favicon_cat_32.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", url: "/favicon_cat_48.png", sizes: "48x48", type: "image/png" },
      { rel: "icon", url: "/favicon_cat_64.png", sizes: "64x64", type: "image/png" },
      { rel: "icon", url: "/favicon_cat_128.png", sizes: "128x128", type: "image/png" },
      { rel: "icon", url: "/favicon_cat_256.png", sizes: "256x256", type: "image/png" },
      { rel: "icon", url: "/favicon_cat_512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/apple_touch_icon_180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
    shortcut: "/favicon_cat.ico",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru">
      <body className={`${onest.variable} ${tektur.variable} ${mono.variable} font-sans antialiased`}>
        <AppProvider>{children}</AppProvider>

      </body>
    </html>
  )
}
