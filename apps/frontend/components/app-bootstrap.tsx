"use client";

import { useEffect, useState } from "react";

import HeaderAuth from "@/components/auth/header-auth";
import { ThemeSwitcher } from "@/components/dashboard/theme-switcher";
import { Navbar } from "@/components/navbar";
import { Toaster } from "@/components/ui/sonner";
import { useLanguage } from "@/utils/context/LanguageContext";
import { useSettingsStore } from "@/stores/settings-store";
import "@/utils/api/init";

import { AppLoadingScreen } from "./app-loading-screen";

interface AppBootstrapProps {
  readonly children: React.ReactNode;
}

export function AppBootstrap({ children }: AppBootstrapProps) {
  const { isLoading: isLanguageLoading } = useLanguage();
  const isSettingsLoading = useSettingsStore((state) => state.loading);
  const [isMounted, setIsMounted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const isAppReady = isMounted && !isLanguageLoading && !isSettingsLoading;

  useEffect(() => {
    if (!isAppReady) {
      setShowOverlay(true);
      setIsFadingOut(false);
      return;
    }

    setIsFadingOut(true);
    const timeout = window.setTimeout(() => {
      setShowOverlay(false);
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isAppReady]);

  if (!isAppReady) {
    return <AppLoadingScreen />;
  }

  return (
    <>
      <Navbar themeSwitcher={<ThemeSwitcher />} authComponent={<HeaderAuth />} />
      <main className="flex w-full flex-col items-center gap-20">{children}</main>
      <Toaster />
      {showOverlay ? <AppLoadingScreen fadingOut={isFadingOut} /> : null}
    </>
  );
}
