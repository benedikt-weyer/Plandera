'use client';

import { AuthGuard } from "@/components/auth/auth-guard";
import { ErrorProvider } from "@/utils/context/ErrorContext";
import { SettingsMain } from "@/components/dashboard/settings";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/utils/context/LanguageContext";

export default function SettingsPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <AuthGuard>
      <ErrorProvider>
        <div className="flex flex-col gap-6 mx-auto p-8 w-full max-w-4xl">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push('/')}
              aria-label="Back to scheduler"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-3xl font-bold">{t('settings.settings')}</h1>
          </div>
          
          <SettingsMain />
        </div>
      </ErrorProvider>
    </AuthGuard>
  );
} 