'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/shadcn-utils';

interface NavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function NavLink({ href, children, className, onClick }: Readonly<NavLinkProps>) {
  const pathname = usePathname();
  const isActive = pathname.startsWith(href);

  return (
    <Button 
      asChild 
      variant={isActive ? "default" : "ghost"} 
      size="sm"
      className={cn(
        isActive ? "bg-primary text-primary-foreground" : "",
        className
      )}
    >
      <Link href={href} onClick={onClick}>{children}</Link>
    </Button>
  );
} 