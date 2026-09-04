/**
 * EasySwipe - A simple swipe gesture library
 * React hook for swipe gestures
 */

import { useRef, useEffect, useCallback, useState } from 'react';
import type { SwipeDirection, SwipeCallbacks, SwipeConfig, SwipeState as SwipeStateExport } from './types';

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  currentX: number;
  currentY: number;
  isSwiping: boolean;
  lockedDirection: SwipeDirection | null; // Track locked direction
}

const DEFAULT_CONFIG: Required<SwipeConfig> = {
  threshold: 50,
  velocityThreshold: 0.3,
  preventDefaultTouchMove: false,
  direction: 'all',
  lockAfterFirstDirection: true,
  trackSwipeOffset: false,
};

export function useSwipeable(callbacks: SwipeCallbacks, config: SwipeConfig = {}) {
  const elementRef = useRef<HTMLElement | null>(null);
  const swipeStateRef = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    currentX: 0,
    currentY: 0,
    isSwiping: false,
    lockedDirection: null,
  });

  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  // Track swipe state for export if enabled
  const [swipeState, setSwipeState] = useState<SwipeStateExport>({
    isSwiping: false,
    swipeOffset: 0,
    direction: null,
  });

  const getSwipeDirection = useCallback((deltaX: number, deltaY: number): SwipeDirection | null => {
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Determine primary direction
    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (mergedConfig.direction === 'vertical') return null;
      return deltaX > 0 ? 'right' : 'left';
    } else {
      // Vertical swipe
      if (mergedConfig.direction === 'horizontal') return null;
      return deltaY > 0 ? 'down' : 'up';
    }
  }, [mergedConfig.direction]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    swipeStateRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
      currentX: touch.clientX,
      currentY: touch.clientY,
      isSwiping: false,
      lockedDirection: null,
    };

    if (mergedConfig.trackSwipeOffset) {
      setSwipeState({
        isSwiping: false,
        swipeOffset: 0,
        direction: null,
      });
    }

    if (callbacks.onSwipeStart) {
      callbacks.onSwipeStart();
    }
  }, [callbacks, mergedConfig.trackSwipeOffset]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!swipeStateRef.current) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStateRef.current.startX;
    const deltaY = touch.clientY - swipeStateRef.current.startY;

    swipeStateRef.current.currentX = touch.clientX;
    swipeStateRef.current.currentY = touch.clientY;

    // Check if we've moved enough to consider it a swipe
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 5 && !swipeStateRef.current.isSwiping) {
      swipeStateRef.current.isSwiping = true;
      
      // Lock direction on first significant movement if enabled
      if (mergedConfig.lockAfterFirstDirection) {
        const initialDirection = getSwipeDirection(deltaX, deltaY);
        if (initialDirection) {
          swipeStateRef.current.lockedDirection = initialDirection;
        }
      }
    }

    if (swipeStateRef.current.isSwiping) {
      let direction: SwipeDirection | null = null;
      let primaryDistance = 0;
      
      // Use locked direction if enabled
      if (mergedConfig.lockAfterFirstDirection && swipeStateRef.current.lockedDirection) {
        direction = swipeStateRef.current.lockedDirection;
        // Calculate distance only in the locked direction
        // If locked to left/right, only use deltaX
        // If locked to up/down, only use deltaY
        if (direction === 'left' || direction === 'right') {
          primaryDistance = deltaX;
          // Enforce direction lock: if locked right, ignore negative movement
          if (direction === 'right' && deltaX < 0) {
            primaryDistance = 0;
          } else if (direction === 'left' && deltaX > 0) {
            primaryDistance = 0;
          }
        } else {
          primaryDistance = deltaY;
          // Enforce direction lock: if locked down, ignore negative movement
          if (direction === 'down' && deltaY < 0) {
            primaryDistance = 0;
          } else if (direction === 'up' && deltaY > 0) {
            primaryDistance = 0;
          }
        }
      } else {
        // No lock, calculate direction normally
        direction = getSwipeDirection(deltaX, deltaY);
        if (direction) {
          primaryDistance = direction === 'left' || direction === 'right' ? deltaX : deltaY;
        }
      }
      
      // Update tracked state if enabled
      if (mergedConfig.trackSwipeOffset && direction) {
        setSwipeState({
          isSwiping: true,
          swipeOffset: primaryDistance,
          direction,
        });
      }

      if (callbacks.onSwipeMove && direction) {
        callbacks.onSwipeMove(primaryDistance, direction);
      }

      if (mergedConfig.preventDefaultTouchMove) {
        e.preventDefault();
      }
    }
  }, [callbacks, getSwipeDirection, mergedConfig.preventDefaultTouchMove, mergedConfig.lockAfterFirstDirection, mergedConfig.trackSwipeOffset]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!swipeStateRef.current || !swipeStateRef.current.isSwiping) {
      swipeStateRef.current.isSwiping = false;
      swipeStateRef.current.lockedDirection = null;
      
      if (mergedConfig.trackSwipeOffset) {
        setSwipeState({
          isSwiping: false,
          swipeOffset: 0,
          direction: null,
        });
      }
      
      if (callbacks.onSwipeEnd) {
        callbacks.onSwipeEnd();
      }
      return;
    }

    const deltaX = swipeStateRef.current.currentX - swipeStateRef.current.startX;
    const deltaY = swipeStateRef.current.currentY - swipeStateRef.current.startY;
    const deltaTime = Date.now() - swipeStateRef.current.startTime;
    
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const velocity = distance / deltaTime; // pixels per millisecond

    // Use locked direction if available, otherwise determine from final position
    let direction = swipeStateRef.current.lockedDirection || getSwipeDirection(deltaX, deltaY);

    // Check if swipe meets threshold requirements
    const meetsDistanceThreshold = distance >= mergedConfig.threshold;
    const meetsVelocityThreshold = velocity >= mergedConfig.velocityThreshold;

    if (direction && (meetsDistanceThreshold || meetsVelocityThreshold)) {
      // Trigger appropriate callback
      switch (direction) {
        case 'left':
          if (callbacks.onSwipeLeft) callbacks.onSwipeLeft();
          break;
        case 'right':
          if (callbacks.onSwipeRight) callbacks.onSwipeRight();
          break;
        case 'up':
          if (callbacks.onSwipeUp) callbacks.onSwipeUp();
          break;
        case 'down':
          if (callbacks.onSwipeDown) callbacks.onSwipeDown();
          break;
      }
    }

    swipeStateRef.current.isSwiping = false;
    swipeStateRef.current.lockedDirection = null;
    
    if (mergedConfig.trackSwipeOffset) {
      setSwipeState({
        isSwiping: false,
        swipeOffset: 0,
        direction: null,
      });
    }
    
    if (callbacks.onSwipeEnd) {
      callbacks.onSwipeEnd();
    }
  }, [callbacks, getSwipeDirection, mergedConfig.threshold, mergedConfig.velocityThreshold, mergedConfig.trackSwipeOffset]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: !mergedConfig.preventDefaultTouchMove });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, mergedConfig.preventDefaultTouchMove]);

  return {
    ref: elementRef,
    ...swipeState,
  };
}

