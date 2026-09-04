'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  /** The scroll container to monitor */
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  /** Threshold in pixels before button appears (default: 200) */
  threshold?: number;
  /** Custom className for positioning and styling */
  className?: string;
  /** Size variant for different screen sizes */
  size?: 'sm' | 'md' | 'lg';
}

export function ScrollToTopButton({ 
  scrollContainerRef, 
  threshold = 200, 
  className = '',
  size = 'md'
}: ScrollToTopButtonProps) {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [buttonPosition, setButtonPosition] = useState({ top: 0, left: 0 });

  // Calculate button position relative to scroll container
  const updateButtonPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      const rect = scrollContainerRef.current.getBoundingClientRect();
      setButtonPosition({
        top: rect.top + 16, // 16px from top of scroll container
        left: rect.left + rect.width / 2 // Center horizontally
      });
    }
  }, [scrollContainerRef]);

  // Handle scroll events to show/hide button and update position
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setShowScrollTop(scrollTop > threshold);
      }
    };

    const handleResize = () => {
      updateButtonPosition();
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      window.addEventListener('resize', handleResize);
      
      // Initial position calculation
      updateButtonPosition();
      
      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleResize);
      };
    }
  }, [scrollContainerRef, threshold, updateButtonPosition]);

  // Update position when scroll container changes
  useEffect(() => {
    updateButtonPosition();
  }, [updateButtonPosition]);

  // Smooth scroll to top function
  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // Size configurations
  const sizeConfig = {
    sm: {
      button: 'w-10 h-10',
      icon: 'h-4 w-4'
    },
    md: {
      button: 'w-11 h-11',
      icon: 'h-5 w-5'
    },
    lg: {
      button: 'w-12 h-12',
      icon: 'h-6 w-6'
    }
  };

  const config = sizeConfig[size];

  return (
    <div 
      className={`fixed transform -translate-x-1/2 z-50 transition-all duration-300 ease-out ${className} ${
        showScrollTop 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 -translate-y-4 scale-95 pointer-events-none'
      }`}
      style={{
        top: `${buttonPosition.top}px`,
        left: `${buttonPosition.left}px`
      }}
    >
      <Button
        onClick={scrollToTop}
        className={`bg-muted-foreground hover:bg-muted-foreground/90 text-background rounded-full ${config.button} p-0 shadow-lg hover:shadow-xl transition-all duration-200 ease-out hover:scale-105`}
        size="sm"
        aria-label="Scroll to top"
      >
        <ChevronUp className={config.icon} />
      </Button>
    </div>
  );
}
