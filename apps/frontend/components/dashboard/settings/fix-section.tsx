'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Eye, Play } from 'lucide-react';
import { useError } from '@/utils/context/ErrorContext';
import { getDecryptedBackend } from '@/utils/api/decrypted-backend';

interface FixSectionProps {
  encryptionKey: string;
}

interface FixResult {
  type: 'calendars' | 'calendar_events';
  processed: number;
  fixed: number;
  errors: number;
}

interface PreviewItem {
  id: string;
  type: 'calendar' | 'calendar_event';
  name: string;
  changes: Array<{
    field: string;
    from: any;
    to: any;
    action: 'normalize' | 'add_missing' | 'fix_type';
  }>;
}

interface PreviewResult {
  items: PreviewItem[];
  totalChanges: number;
}

export function FixSection({ encryptionKey }: FixSectionProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [fixResults, setFixResults] = useState<FixResult[]>([]);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const { setError } = useError();

  const previewChanges = async () => {
    setIsPreviewing(true);
    setPreviewResult(null);
    
    try {
      const backend = getDecryptedBackend();
      const previewItems: PreviewItem[] = [];

      // Preview calendar changes
      const { data: calendars } = await backend.calendars.getAll();
      
      if (calendars) {
        for (const calendar of calendars) {
          const changes: PreviewItem['changes'] = [];
          
          // Check for legacy camelCase properties
          if ((calendar as any).isVisible !== undefined) {
            changes.push({
              field: 'is_visible',
              from: `isVisible: ${(calendar as any).isVisible}`,
              to: `is_visible: ${(calendar as any).isVisible}`,
              action: 'normalize'
            });
          }
          
          if ((calendar as any).isDefault !== undefined) {
            changes.push({
              field: 'is_default',
              from: `isDefault: ${(calendar as any).isDefault}`,
              to: `is_default: ${(calendar as any).isDefault}`,
              action: 'normalize'
            });
          }
          
          // Check for missing essential fields
          if (!calendar.name) {
            const defaultName = `Calendar ${calendar.id.slice(0, 8)}`;
            changes.push({
              field: 'name',
              from: 'undefined/null',
              to: defaultName,
              action: 'add_missing'
            });
          }
          
          if (!calendar.color) {
            changes.push({
              field: 'color',
              from: 'undefined/null',
              to: '#3b82f6',
              action: 'add_missing'
            });
          }
          
          if (changes.length > 0) {
            previewItems.push({
              id: calendar.id,
              type: 'calendar',
              name: calendar.name || `Calendar ${calendar.id.slice(0, 8)}`,
              changes
            });
          }
        }
      }

      // Preview calendar event changes
      const { data: events } = await backend.calendarEvents.getAll();
      
      if (events) {
        for (const event of events) {
          const changes: PreviewItem['changes'] = [];
          
          // Check for legacy camelCase properties
          if ((event as any).startTime !== undefined) {
            changes.push({
              field: 'start_time',
              from: `startTime: ${(event as any).startTime}`,
              to: `start_time: ${(event as any).startTime}`,
              action: 'normalize'
            });
          }
          
          if ((event as any).endTime !== undefined) {
            changes.push({
              field: 'end_time',
              from: `endTime: ${(event as any).endTime}`,
              to: `end_time: ${(event as any).endTime}`,
              action: 'normalize'
            });
          }
          
          if ((event as any).calendarId !== undefined) {
            changes.push({
              field: 'calendar_id',
              from: `calendarId: ${(event as any).calendarId}`,
              to: `calendar_id: ${(event as any).calendarId}`,
              action: 'normalize'
            });
          }
          
          if ((event as any).isAllDay !== undefined) {
            changes.push({
              field: 'all_day',
              from: `isAllDay: ${(event as any).isAllDay}`,
              to: `all_day: ${(event as any).isAllDay}`,
              action: 'normalize'
            });
          }
          
          // Check for legacy recurrence properties that need to be consolidated into recurrence_rule
          const hasLegacyRecurrence = (event as any).recurrenceFrequency !== undefined ||
                                    (event as any).recurrenceInterval !== undefined ||
                                    (event as any).recurrenceEndDate !== undefined;
          
          if (hasLegacyRecurrence) {
            const legacyRecurrenceFields = [];
            if ((event as any).recurrenceFrequency) legacyRecurrenceFields.push(`recurrenceFrequency: ${(event as any).recurrenceFrequency}`);
            if ((event as any).recurrenceInterval) legacyRecurrenceFields.push(`recurrenceInterval: ${(event as any).recurrenceInterval}`);
            if ((event as any).recurrenceEndDate) legacyRecurrenceFields.push(`recurrenceEndDate: ${(event as any).recurrenceEndDate}`);
            
            changes.push({
              field: 'recurrence_rule',
              from: legacyRecurrenceFields.join(', '),
              to: 'Consolidated into recurrence_rule JSON',
              action: 'normalize'
            });
          }
          
          if (changes.length > 0) {
            previewItems.push({
              id: event.id,
              type: 'calendar_event',
              name: event.title || `Event ${event.id.slice(0, 8)}`,
              changes
            });
          }
        }
      }

      const totalChanges = previewItems.reduce((sum, item) => sum + item.changes.length, 0);
      
      setPreviewResult({
        items: previewItems,
        totalChanges
      });

    } catch (error) {
      console.error('Failed to preview changes:', error);
      setError('Failed to preview changes. Please try again.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const fixCalendarsAndEvents = async () => {
    setIsFixing(true);
    setFixResults([]);
    setPreviewResult(null); // Clear preview when applying fixes
    
    try {
      const backend = getDecryptedBackend();
      const results: FixResult[] = [];

      // Fix calendars
      console.log('Starting calendar data normalization...');
      const { data: calendars } = await backend.calendars.getAll();
      
      let calendarsProcessed = 0;
      let calendarsFixed = 0;
      let calendarsErrors = 0;

      if (calendars) {
        for (const calendar of calendars) {
          calendarsProcessed++;
          try {
            // Check if calendar has legacy camelCase properties that need fixing
            const hasLegacyData = (calendar as any).isVisible !== undefined || 
                                 (calendar as any).isDefault !== undefined ||
                                 !calendar.name || 
                                 !calendar.color;
            
            if (hasLegacyData) {
              // Normalize the data by updating it
              await backend.calendars.update({
                id: calendar.id,
                name: calendar.name || `Calendar ${calendar.id.slice(0, 8)}`,
                color: calendar.color || '#3b82f6',
                is_visible: calendar.is_visible ?? (calendar as any).isVisible ?? true,
                is_default: calendar.is_default ?? (calendar as any).isDefault ?? false,
                type: calendar.type,
                ics_url: calendar.ics_url,
                last_sync: calendar.last_sync,
              });
              calendarsFixed++;
            }
          } catch (error) {
            console.error(`Failed to fix calendar ${calendar.id}:`, error);
            calendarsErrors++;
          }
        }
      }

      results.push({
        type: 'calendars',
        processed: calendarsProcessed,
        fixed: calendarsFixed,
        errors: calendarsErrors
      });

      // Fix calendar events
      console.log('Starting calendar events data normalization...');
      const { data: events } = await backend.calendarEvents.getAll();
      
      let eventsProcessed = 0;
      let eventsFixed = 0;
      let eventsErrors = 0;

      if (events) {
        for (const event of events) {
          eventsProcessed++;
          try {
            // Check if event has legacy camelCase properties or recurrence data that need fixing
            const hasLegacyData = (event as any).startTime !== undefined || 
                                 (event as any).endTime !== undefined ||
                                 (event as any).calendarId !== undefined ||
                                 (event as any).isAllDay !== undefined ||
                                 (event as any).recurrenceFrequency !== undefined ||
                                 (event as any).recurrenceInterval !== undefined ||
                                 (event as any).recurrenceEndDate !== undefined;
            
            if (hasLegacyData) {
              // Build normalized recurrence rule from legacy properties
              let normalizedRecurrenceRule = event.recurrence_rule;
              
              // If we have legacy recurrence properties, consolidate them into recurrence_rule
              if ((event as any).recurrenceFrequency || (event as any).recurrenceInterval || (event as any).recurrenceEndDate) {
                const recurrenceData: any = {};
                
                if ((event as any).recurrenceFrequency) {
                  recurrenceData.frequency = (event as any).recurrenceFrequency;
                }
                if ((event as any).recurrenceInterval) {
                  recurrenceData.interval = (event as any).recurrenceInterval;
                }
                if ((event as any).recurrenceEndDate) {
                  recurrenceData.endDate = (event as any).recurrenceEndDate;
                }
                
                // If there's already a recurrenceRule (RRULE format), prefer that, otherwise create JSON
                if ((event as any).recurrenceRule && !normalizedRecurrenceRule) {
                  normalizedRecurrenceRule = (event as any).recurrenceRule;
                } else if (Object.keys(recurrenceData).length > 0) {
                  normalizedRecurrenceRule = JSON.stringify(recurrenceData);
                }
              }
              
              // Normalize the data by updating it
              await backend.calendarEvents.update({
                id: event.id,
                title: event.title,
                description: event.description,
                location: event.location,
                calendar_id: event.calendar_id || (event as any).calendarId,
                start_time: event.start_time || (event as any).startTime,
                end_time: event.end_time || (event as any).endTime,
                all_day: event.all_day ?? (event as any).isAllDay ?? false,
                recurrence_rule: normalizedRecurrenceRule,
                recurrence_exception: event.recurrence_exception,
              });
              eventsFixed++;
            }
          } catch (error) {
            console.error(`Failed to fix calendar event ${event.id}:`, error);
            eventsErrors++;
          }
        }
      }

      results.push({
        type: 'calendar_events',
        processed: eventsProcessed,
        fixed: eventsFixed,
        errors: eventsErrors
      });

      setFixResults(results);
      
      if (results.some(r => r.fixed > 0)) {
        console.log('Data normalization completed successfully');
      } else {
        console.log('No corrupted data found - all data is already normalized');
      }

    } catch (error) {
      console.error('Failed to fix data corruption:', error);
      setError('Failed to fix data corruption. Please try again.');
    } finally {
      setIsFixing(false);
    }
  };

  const getTotalStats = () => {
    return fixResults.reduce(
      (acc, result) => ({
        processed: acc.processed + result.processed,
        fixed: acc.fixed + result.fixed,
        errors: acc.errors + result.errors
      }),
      { processed: 0, fixed: 0, errors: 0 }
    );
  };

  const totals = getTotalStats();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Fix Corrupted Data
          </CardTitle>
          <CardDescription>
            Scan and fix corrupted data across calendars and calendar events. Use "Preview Changes" 
            to see exactly what would be modified before applying fixes. This will normalize 
            legacy camelCase properties to snake_case and fix missing essential fields.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <Button 
              onClick={previewChanges}
              disabled={isPreviewing || isFixing}
              variant="outline"
              className="flex items-center gap-2"
            >
              {isPreviewing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Preview Changes
                </>
              )}
            </Button>

            <Button 
              onClick={fixCalendarsAndEvents}
              disabled={isFixing || isPreviewing}
              className="flex items-center gap-2"
            >
              {isFixing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Fixing Data...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Apply Fixes
                </>
              )}
            </Button>
            
            {fixResults.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-600" />
                Fix completed
              </div>
            )}
          </div>

          {previewResult && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <h3 className="font-medium text-blue-900">Preview: Changes to be Applied</h3>
                </div>
                
                {previewResult.totalChanges === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-green-700">
                      No corrupted data found. All data is already properly normalized.
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 p-3 bg-white rounded border">
                      <div className="text-sm text-muted-foreground">
                        <strong className="text-blue-600">{previewResult.totalChanges}</strong> changes across{' '}
                        <strong className="text-blue-600">{previewResult.items.length}</strong> items
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {previewResult.items.map((item) => (
                        <div key={item.id} className="border rounded-lg p-3 bg-white">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1 bg-blue-100 rounded">
                              {item.type === 'calendar' ? (
                                <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              ) : (
                                <svg className="h-3 w-3 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                              )}
                            </div>
                            <div className="font-medium text-sm">{item.name}</div>
                            <div className="text-xs text-muted-foreground">({item.changes.length} changes)</div>
                          </div>
                          
                          <div className="space-y-1 text-xs">
                            {item.changes.map((change, index) => (
                              <div key={index} className="flex items-center gap-2">
                                <div className={`px-2 py-1 rounded text-xs font-medium ${
                                  change.action === 'normalize' ? 'bg-yellow-100 text-yellow-800' :
                                  change.action === 'add_missing' ? 'bg-green-100 text-green-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {change.action === 'normalize' ? 'Normalize' :
                                   change.action === 'add_missing' ? 'Add Missing' : 'Fix Type'}
                                </div>
                                <div className="font-mono text-xs">
                                  <span className="text-red-600">{change.from}</span>
                                  <span className="mx-1">→</span>
                                  <span className="text-green-600">{change.to}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {fixResults.length > 0 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{totals.processed}</div>
                  <div className="text-sm text-muted-foreground">Total Processed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{totals.fixed}</div>
                  <div className="text-sm text-muted-foreground">Fixed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{totals.errors}</div>
                  <div className="text-sm text-muted-foreground">Errors</div>
                </div>
              </div>

              <div className="space-y-2">
                {fixResults.map((result, index) => (
                  <div 
                    key={result.type} 
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        {result.type === 'calendars' ? (
                          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        ) : (
                          <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {result.type === 'calendars' ? 'Calendars' : 'Calendar Events'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {result.processed} processed
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        <span className="text-green-600 font-medium">{result.fixed} fixed</span>
                        {result.errors > 0 && (
                          <span className="text-red-600 font-medium ml-2">{result.errors} errors</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totals.fixed === 0 && totals.errors === 0 && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-700">
                    No corrupted data found. All data is already properly normalized.
                  </span>
                </div>
              )}

              {totals.errors > 0 && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  <span className="text-red-700">
                    Some items could not be fixed. Please check the console for details.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-muted-foreground space-y-2">
            <h4 className="font-medium text-foreground">What this fixes:</h4>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Converts legacy camelCase properties (isVisible, isDefault, startTime, calendarId, etc.) to snake_case</li>
              <li>Consolidates legacy recurrence properties (recurrenceFrequency, recurrenceInterval, recurrenceEndDate) into recurrence_rule</li>
              <li>Adds missing essential fields like calendar names and colors</li>
              <li>Normalizes calendar and event data structure</li>
              <li>Ensures data consistency across the application</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
