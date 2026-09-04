
/**
 * Parses duration hashtags from content and returns cleaned content with extracted duration
 * Supports formats: #d15, #d15m, #d1h, #d1h15m, #d1h15
 */

export interface ParsedContent {
  content: string;
  duration?: number; // in minutes
}

/**
 * Parse duration hashtags from content
 * @param content The content string that may contain duration hashtags
 * @returns Object with cleaned content and extracted duration in minutes
 */
export function parseDurationFromContent(content: string): ParsedContent {
  // Regex to match duration patterns: #d followed by various time formats
  const durationRegex = /#d(\d+(?:h\d*m?|\d*m?|h))/gi;
  
  let extractedDuration: number | undefined;
  let cleanedContent = content;
  
  // Find and process duration hashtags
  const matches = [...content.matchAll(durationRegex)];
  
  for (const match of matches) {
    const fullMatch = match[0]; // e.g., "#d1h15m"
    const timeString = match[1]; // e.g., "1h15m"
    
    const duration = parseTimeString(timeString);
    if (duration !== null && extractedDuration === undefined) {
      extractedDuration = duration;
    }
    
    // Remove the hashtag from content (remove all valid duration tags)
    if (duration !== null) {
      cleanedContent = cleanedContent.replace(fullMatch, '').trim();
      // Remove extra spaces that might be left
      cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();
    }
  }
  
  return {
    content: cleanedContent,
    duration: extractedDuration
  };
}

/**
 * Parse a time string into minutes
 * Supports: "15", "15m", "1h", "1h15m", "1h15"
 */
function parseTimeString(timeString: string): number | null {
  // Handle pure minutes: "15" or "15m"
  const minutesOnlyMatch = timeString.match(/^(\d+)m?$/);
  if (minutesOnlyMatch) {
    return parseInt(minutesOnlyMatch[1], 10);
  }
  
  // Handle hours only: "1h"
  const hoursOnlyMatch = timeString.match(/^(\d+)h$/);
  if (hoursOnlyMatch) {
    return parseInt(hoursOnlyMatch[1], 10) * 60;
  }
  
  // Handle hours and minutes: "1h15m" or "1h15"
  const hoursMinutesMatch = timeString.match(/^(\d+)h(\d+)m?$/);
  if (hoursMinutesMatch) {
    const hours = parseInt(hoursMinutesMatch[1], 10);
    const minutes = parseInt(hoursMinutesMatch[2], 10);
    return hours * 60 + minutes;
  }
  
  return null;
}

/**
 * Get examples of supported duration formats for help text
 */
export function getDurationExamples(): string[] {
  return [
    '#d15 (15 minutes)',
    '#d15m (15 minutes)',
    '#d1h (1 hour)',
    '#d1h15m (1 hour 15 minutes)',
    '#d1h15 (1 hour 15 minutes)',
    '#d3h (3 hours)'
  ];
}
