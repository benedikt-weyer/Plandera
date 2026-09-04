'use client';

import { signOutClient } from "@/utils/auth/auth-client";
import { useTranslation } from "@/utils/context/LanguageContext";
import { Button } from "../ui/button";

export default function SignOutButton() {
  const { t } = useTranslation();

  const handleSignOut = async () => {
    // signOutClient clears the stored crypt key and tokens for us.
    const result = await signOutClient();
    
    if (result.error) {
      console.error('Sign out error:', result.error);
    }
    
    // Redirect to sign-in regardless of result
    window.location.href = '/sign-in';
  };

  return (
    <Button onClick={handleSignOut} variant="outline">
      {t('auth.signOut')}
    </Button>
  );
}