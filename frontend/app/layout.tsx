import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { SchedulerNavProvider } from "@/contexts/scheduler-nav-context";
import { SettingsInitializer } from "@/components/settings-initializer";
import { LanguageProvider } from "@/utils/context/LanguageContext";
import { AppBootstrap } from "@/components/app-bootstrap";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geistSans.className} suppressHydrationWarning>
      <head>
        <title>Plandera</title>
        <meta name="description" content="Open source self hostable secure calendar todolist combo" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/icon.png" />
      </head>
      <body className="bg-background text-foreground min-h-screen flex flex-col items-center">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <SettingsInitializer>
              <SchedulerNavProvider>
                <AppBootstrap>{children}</AppBootstrap>
              </SchedulerNavProvider>
            </SettingsInitializer>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
