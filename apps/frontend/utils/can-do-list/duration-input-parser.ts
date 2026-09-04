/**
 * Duration input parsing utilities for task duration fields
 * Supports formats: "2h", "2h40m", "40m", "120" (minutes only)
 */

export interface ParsedDurationInput {
  minutes: number | null;
  isValid: boolean;
  error?: string;
}

/**
 * Parse duration input string into minutes
 * Supports formats:
 * - "2h" -> 120 minutes
 * - "2h40m" -> 160 minutes  
 * - "40m" -> 40 minutes
 * - "120" -> 120 minutes (plain number)
 */
export function parseDurationInput(input: string): ParsedDurationInput {
  if (!input || input.trim() === '') {
    return { minutes: null, isValid: true };
  }

  const trimmed = input.trim().toLowerCase();

  // Handle plain numbers (minutes only)
  const plainNumberMatch = trimmed.match(/^(\d+)$/);
  if (plainNumberMatch) {
    const minutes = parseInt(plainNumberMatch[1], 10);
    return { minutes, isValid: true };
  }

  // Handle minutes only: "40m"
  const minutesOnlyMatch = trimmed.match(/^(\d+)m$/);
  if (minutesOnlyMatch) {
    const minutes = parseInt(minutesOnlyMatch[1], 10);
    return { minutes, isValid: true };
  }

  // Handle hours only: "2h"
  const hoursOnlyMatch = trimmed.match(/^(\d+)h$/);
  if (hoursOnlyMatch) {
    const hours = parseInt(hoursOnlyMatch[1], 10);
    const minutes = hours * 60;
    return { minutes, isValid: true };
  }

  // Handle hours and minutes: "2h40m" or "2h40"
  const hoursMinutesMatch = trimmed.match(/^(\d+)h(\d+)m?$/);
  if (hoursMinutesMatch) {
    const hours = parseInt(hoursMinutesMatch[1], 10);
    const mins = parseInt(hoursMinutesMatch[2], 10);
    const totalMinutes = hours * 60 + mins;
    return { minutes: totalMinutes, isValid: true };
  }

  // If no pattern matches, it's invalid
  return { 
    minutes: null, 
    isValid: false, 
    error: 'Invalid format. Use formats like: 2h, 2h30, 2h40m, 40m, or 120' 
  };
}

/**
 * Format minutes into human-readable duration string
 * Examples: 120 -> "2h", 160 -> "2h 40m", 40 -> "40m"
 */
export function formatDurationInput(minutes: number | null | undefined): string {
  if (!minutes || minutes === 0) {
    return '';
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Get examples of supported duration formats for help text
 */
export function getDurationInputExamples(): string[] {
  return [
    '2h (2 hours)',
    '2h30 (2 hours 30 minutes)',
    '2h40m (2 hours 40 minutes)',
    '40m (40 minutes)',
    '120 (120 minutes)'
  ];
}
