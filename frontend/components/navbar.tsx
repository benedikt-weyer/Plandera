'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { NavLink } from '@/components/ui/navigation';
import Link from 'next/link';
import { Menu, X, Settings } from 'lucide-react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/shadcn-utils';
import { useSchedulerNav } from '@/contexts/scheduler-nav-context';
import { useTranslation } from '@/utils/context/LanguageContext';
import { getBackend } from '@/utils/api/backend-interface';
import { AuthUser } from '@/utils/api/types';

interface MobileNavbarProps {
  themeSwitcher: React.ReactNode;
  authComponent: React.ReactNode;
}

export function Navbar({ themeSwitcher, authComponent }: Readonly<MobileNavbarProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const pathname = usePathname();
  const isSettingsPage = pathname === '/settings';
  const isSchedulerPage = pathname === '/';
  const { schedulerNavContent, schedulerNavActions } = useSchedulerNav();
  const { t } = useTranslation();

  useEffect(() => {
    async function fetchUser() {
      try {
        const backend = getBackend();
        const { data: { user: authUser } } = await backend.auth.getUser();
        setUser(authUser);
      } catch (error) {
        console.warn('Failed to get user in navbar:', error);
      }
    }

    fetchUser();

    // Listen for auth state changes
    const backend = getBackend();
    const { data } = backend.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      if (data?.subscription?.unsubscribe) {
        data.subscription.unsubscribe();
      }
    };
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  // Get username from email (part before @)
  const username = user?.email?.split('@')[0] || 'User';

  return (
    <nav className="w-full relative">
      {/* Backdrop blur overlay - only visible on mobile when menu is open */}
      <button
        type="button"
        className={cn(
          "md:hidden fixed inset-0 top-16 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={closeMenu}
        aria-label={t('navbar.toggleMenu')}
      />
      
      {/* Desktop and Mobile Header */}
      <div className="flex items-center h-16 px-4 md:px-6 lg:px-10 border-b border-b-foreground/10 relative z-50 bg-background">
        {/* Left side - Brand (links to scheduler) */}
        <Link href="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
          <Image src="/icon.png" alt={t('navbar.appName')} width={25} height={25} />
          <span className="font-bold text-xl md:text-2xl hidden md:inline">
            {t('navbar.appName')}
          </span>
        </Link>

        {/* Center - Scheduler Navigation (only on scheduler page) */}
        {isSchedulerPage && schedulerNavContent && (
          <div className="flex-1 flex items-center justify-center">
            {schedulerNavContent}
          </div>
        )}

        {/* Right side - Settings, Theme switcher and Auth */}
        <div className={cn(
          "flex items-center gap-2 md:gap-4",
          !isSchedulerPage && "ml-auto"
        )}>
          {isSchedulerPage && schedulerNavActions}

          {/* Settings icon - Hidden on mobile */}
          <Link href={isSettingsPage ? "/" : "/settings"} className="hidden md:flex">
            <Button 
              variant="ghost" 
              size="icon" 
              aria-label={isSettingsPage ? t('navbar.backToScheduler') : t('navbar.settings')}
              className={cn(isSettingsPage && "bg-secondary")}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </Link>
          
          {/* Desktop only - theme switcher and auth */}
          <div className="hidden md:flex items-center gap-2 md:gap-4">
            {themeSwitcher}
            {authComponent}
          </div>
          
          {/* Mobile menu button - Only visible on mobile */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={toggleMenu}
            aria-label={t('navbar.toggleMenu')}
          >
            {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Menu - Slide in from top */}
      <div className={cn(
        "md:hidden border-t border-t-foreground/10 bg-background relative z-50 shadow-lg overflow-hidden transition-all duration-300 ease-in-out",
        isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="flex flex-col space-y-2 p-4">
          {/* Greeting */}
          {user && (
            <div className="px-3 py-2 text-sm font-medium text-muted-foreground">
              Hi, {username}
            </div>
          )}
          
          <div>
            <NavLink
              href={isSettingsPage ? "/" : "/settings"}
              className="w-full justify-start"
              onClick={closeMenu}
            >
              {isSettingsPage ? t('navbar.backToScheduler') : t('navbar.settings')}
            </NavLink>
          </div>
          
          {/* Theme switcher and auth in mobile menu */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            {themeSwitcher}
            {authComponent}
          </div>
        </div>
      </div>
    </nav>
  );
} 