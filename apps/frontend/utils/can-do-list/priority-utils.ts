/**
 * Utility functions for handling task priority and urgency
 */

/**
 * Calculate priority from impact and urgency
 * @param impact - 1-10 scale
 * @param urgency - 1-10 scale
 * @returns Combined priority score
 */
export function calculatePriority(impact?: number, urgency?: number): number | null {
  if (!impact && !urgency) return null;
  
  const imp = impact || 0;
  const urg = urgency || 0;
  
  if (imp === 0 && urg === 0) return null;
  
  // If both values are provided, take the average
  if (imp > 0 && urg > 0) {
    return Math.round((imp + urg) / 2);
  }
  
  // If only one value is provided, use that value directly
  return imp > 0 ? imp : urg;
}

/**
 * Get urgency-based background color for priority badge
 * @param urgency - 1-10 scale
 * @returns CSS class names for background color
 */
export function getUrgencyColorClass(urgency?: number): string {
  if (!urgency || urgency <= 0) return 'bg-gray-100 text-gray-700';
  
  if (urgency <= 3) return 'bg-green-100 text-green-700';
  if (urgency <= 6) return 'bg-yellow-100 text-yellow-700';
  if (urgency <= 8) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

/**
 * Get priority display text
 * @param priority - Calculated priority score
 * @returns Display text for priority
 */
export function getPriorityDisplayText(priority: number | null): string | null {
  if (!priority || priority <= 0) return null;
  return `P${priority}`;
}

/**
 * Parse priority hashtags from content
 * Supports formats: #p5, #i7u3 (impact 7, urgency 3)
 */
export interface ParsedPriority {
  content: string;
  impact?: number;
  urgency?: number;
}

export function parsePriorityFromContent(content: string): ParsedPriority {
  let cleanedContent = content;
  let impact: number | undefined;
  let urgency: number | undefined;

  // Parse combined format: #i7u3 (impact 7, urgency 3)
  const combinedRegex = /#i(\d)u(\d)/gi;
  const combinedMatches = [...content.matchAll(combinedRegex)];
  
  for (const match of combinedMatches) {
    const fullMatch = match[0]; // e.g., "#i7u3"
    const impValue = parseInt(match[1], 10);
    const urgValue = parseInt(match[2], 10);
    
    if (impValue >= 1 && impValue <= 10 && urgValue >= 1 && urgValue <= 10) {
      impact = impValue;
      urgency = urgValue;
      cleanedContent = cleanedContent.replace(fullMatch, '').trim();
    }
  }

  // Parse impact only format: #i7
  if (!impact) {
    const impactRegex = /#i(\d)(?!u)/gi; // Negative lookahead to avoid matching #i7u3
    const impactMatches = [...content.matchAll(impactRegex)];
    
    for (const match of impactMatches) {
      const fullMatch = match[0]; // e.g., "#i7"
      const impValue = parseInt(match[1], 10);
      
      if (impValue >= 1 && impValue <= 10) {
        impact = impValue;
        cleanedContent = cleanedContent.replace(fullMatch, '').trim();
      }
    }
  }

  // Parse urgency only format: #u5
  if (!urgency) {
    const urgencyRegex = /#u(\d)/gi;
    const urgencyMatches = [...content.matchAll(urgencyRegex)];
    
    for (const match of urgencyMatches) {
      const fullMatch = match[0]; // e.g., "#u5"
      const urgValue = parseInt(match[1], 10);
      
      if (urgValue >= 1 && urgValue <= 10) {
        urgency = urgValue;
        cleanedContent = cleanedContent.replace(fullMatch, '').trim();
      }
    }
  }

  // Parse simple priority format: #p5 (sets both impact and urgency to 5)
  if (!impact && !urgency) {
    const priorityRegex = /#p(\d)/gi;
    const priorityMatches = [...content.matchAll(priorityRegex)];
    
    for (const match of priorityMatches) {
      const fullMatch = match[0]; // e.g., "#p5"
      const priValue = parseInt(match[1], 10);
      
      if (priValue >= 1 && priValue <= 10) {
        impact = priValue;
        urgency = priValue;
        cleanedContent = cleanedContent.replace(fullMatch, '').trim();
      }
    }
  }

  // Clean up extra spaces
  cleanedContent = cleanedContent.replace(/\s+/g, ' ').trim();

  return {
    content: cleanedContent,
    impact,
    urgency
  };
}

/**
 * Get examples of supported priority formats for help text
 */
export function getPriorityExamples(): string[] {
  return [
    '#p5 (priority 5 - sets both impact and urgency to 5)',
    '#i7 (impact 7 only)',
    '#u3 (urgency 3 only)',
    '#i8u3 (impact 8, urgency 3)',
    '#i9u9 (impact 9, urgency 9 - highest priority)'
  ];
} 