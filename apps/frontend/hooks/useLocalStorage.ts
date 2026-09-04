'use client';

import { useState, useEffect } from 'react';

/**
 * Custom hook for persisting state in localStorage
 * @param key - The localStorage key
 * @param initialValue - The initial value if no stored value exists
 * @returns [storedValue, setValue, isHydrated] - Similar to useState but persisted, with hydration flag
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void, boolean] {
  // Always start with initialValue to ensure server/client consistency
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        if (item && item !== 'undefined' && item !== 'null') {
          const parsedValue = JSON.parse(item);
          setStoredValue(parsedValue);
        }
      } catch (error) {
        console.warn(`Error reading localStorage key "${key}":`, error);
      }
      setIsHydrated(true);
    }
  }, [key]);

  // Return a wrapped version of useState's setter function that ...
  // ... persists the new value to localStorage.
  const setValue = (value: T | ((val: T) => T)) => {
    try {
      // Allow value to be a function so we have the same API as useState
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Save state
      setStoredValue(valueToStore);
      
      // Save to local storage (only if hydrated)
      if (isHydrated && typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      // A more advanced implementation would handle the error case
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue, isHydrated];
}

/**
 * Hook for persisting Date objects in localStorage
 * Handles serialization/deserialization of Date objects
 */
export function useLocalStorageDate(
  key: string,
  initialValue: Date
): [Date, (value: Date | ((val: Date) => Date)) => void, boolean] {
  // Always start with initialValue to ensure server/client consistency
  const [storedValue, setStoredValue] = useState<Date>(initialValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage after component mounts (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key);
        if (item && item !== 'undefined' && item !== 'null') {
          const parsedDate = new Date(JSON.parse(item));
          // Validate that it's a valid date
          if (!isNaN(parsedDate.getTime())) {
            setStoredValue(parsedDate);
          }
        }
      } catch (error) {
        console.warn(`Error reading localStorage date key "${key}":`, error);
      }
      setIsHydrated(true);
    }
  }, [key]);

  const setValue = (value: Date | ((val: Date) => Date)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      
      // Validate it's a valid date
      if (isNaN(valueToStore.getTime())) {
        console.warn(`Invalid date provided to localStorage key "${key}"`);
        return;
      }
      
      setStoredValue(valueToStore);
      
      // Save to local storage (only if hydrated)
      if (isHydrated && typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore.toISOString()));
      }
    } catch (error) {
      console.warn(`Error setting localStorage date key "${key}":`, error);
    }
  };

  return [storedValue, setValue, isHydrated];
}
