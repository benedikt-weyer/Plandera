import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TimeInput, type QuickTimeOption } from '@/components/ui/time-input';
import { DatePicker } from '@/components/ui/date-picker';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Calendar, CalendarEvent, RecurrenceFrequency } from '@/utils/calendar/calendar-types';
import { getRecurrencePattern } from '@/utils/calendar/eventDataProcessing';
import { format, parse, isValid, addMinutes } from 'date-fns';
import { Link2, ListTodo, Trash2 } from 'lucide-react';
import { ProjectDecrypted } from '@/utils/api/types';
import { EventTaskProjectPicker } from './event-task-project-picker';

import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { DeleteConfirmationDialog } from './delete-confirmation-dialog';
import { RecurringEventModificationDialog } from './recurring-event-modification-dialog';
import { useTranslation } from '@/utils/context/LanguageContext';

// Define schema for event validation
export const eventFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, { message: "Title is required" }),
  description: z.string().optional(),
  location: z.string().optional(),
  calendarId: z.string().min(1, { message: "Calendar is required" }),
  isAllDay: z.boolean().default(false),
  startDate: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed);
  }, { message: "Valid start date is required" }),
  startTime: z.string(),
  endDate: z.string().refine(value => {
    if (!value) return false;
    const parsed = parse(value, 'yyyy-MM-dd', new Date());
    return isValid(parsed);
  }, { message: "Valid end date is required" }),
  endTime: z.string(),
  // Recurrence fields
  recurrenceFrequency: z.nativeEnum(RecurrenceFrequency).default(RecurrenceFrequency.None),
  recurrenceEndDate: z.string().optional(),
  recurrenceInterval: z.coerce.number().min(1).default(1),
  daysOfWeek: z.array(z.number()).optional(),
  // Event group fields
  isGroupEvent: z.boolean().default(false),
  isTaskReservationSpace: z.boolean().default(false),
  parentGroupEventId: z.string().optional(),
  // Task linkage
  taskId: z.string().optional()
}).refine(data => {
  // For all-day events, we don't need time validation
  if (data.isAllDay) {
    // For all-day events, just validate that end date is not before start date
    const startDate = parse(data.startDate, 'yyyy-MM-dd', new Date());
    const endDate = parse(data.endDate, 'yyyy-MM-dd', new Date());
    
    if (!isValid(startDate) || !isValid(endDate)) {
      return false;
    }
    
    return endDate >= startDate;
  }
  
  // For timed events, validate both date and time
  if (!data.startTime || !data.endTime) {
    return false;
  }
  
  // Combine date and time to create complete datetime for validation
  const startDate = parse(data.startDate, 'yyyy-MM-dd', new Date());
  const startTime = parse(data.startTime, 'HH:mm', new Date());
  const endDate = parse(data.endDate, 'yyyy-MM-dd', new Date());
  const endTime = parse(data.endTime, 'HH:mm', new Date());
  
  if (!isValid(startDate) || !isValid(startTime) || !isValid(endDate) || !isValid(endTime)) {
    return false;
  }
  
  const start = new Date(
    startDate.getFullYear(), 
    startDate.getMonth(), 
    startDate.getDate(), 
    startTime.getHours(), 
    startTime.getMinutes()
  );
  
  const end = new Date(
    endDate.getFullYear(), 
    endDate.getMonth(), 
    endDate.getDate(), 
    endTime.getHours(), 
    endTime.getMinutes()
  );
  
  return end > start;
}, {
  message: "End date/time must be after start date/time",
  path: ["endTime"]
}).refine(data => {
  // Prevent nesting: A group event cannot have a parent group
  if (data.isGroupEvent && data.parentGroupEventId) {
    return false;
  }
  return true;
}, {
  message: "Group events cannot be nested inside other groups",
  path: ["isGroupEvent"]
}).refine(data => {
  if (data.isTaskReservationSpace && !data.isGroupEvent) {
    return false;
  }
  return true;
}, {
  message: "Task reservation spaces must be event groups",
  path: ["isTaskReservationSpace"]
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

interface CalendarEventDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedEvent: CalendarEvent | null;
  readonly calendars: Calendar[];
  readonly defaultCalendarId?: string;
  readonly onSubmit: (values: EventFormValues) => Promise<void>;
  readonly onDelete: (id: string) => Promise<void>;
  readonly onClone?: (event: CalendarEvent) => void;
  readonly onDeleteAllInSeries?: (event: CalendarEvent) => Promise<void>;
  readonly onDeleteThisAndFuture?: (event: CalendarEvent) => Promise<void>;
  readonly onDeleteThisOccurrence?: (event: CalendarEvent) => Promise<void>;
  readonly onModifyAllInSeries?: (event: CalendarEvent, modifiedData: any) => Promise<void>;
  readonly onModifyThisAndFuture?: (event: CalendarEvent, modifiedData: any) => Promise<void>;
  readonly onModifyThisOccurrence?: (event: CalendarEvent, modifiedData: any) => Promise<void>;
  readonly linkedTaskTitle?: string | null;
  readonly linkedTaskCompleted?: boolean | null;
  readonly onNavigateToTask?: () => void;
  readonly projects?: ProjectDecrypted[];
  readonly onCreateTaskFromEvent?: (title: string, projectId: string | null) => Promise<void>;
}

// Helper function to combine date and time into a single Date object
const combineDateAndTime = (dateStr: string, timeStr: string): Date => {
  const datePart = parse(dateStr, 'yyyy-MM-dd', new Date());
  const timePart = parse(timeStr, 'HH:mm', new Date());
  
  return new Date(
    datePart.getFullYear(),
    datePart.getMonth(),
    datePart.getDate(),
    timePart.getHours(),
    timePart.getMinutes()
  );
};

export function CalendarEventDialog({ 
  isOpen, 
  onOpenChange, 
  selectedEvent, 
  calendars,
  defaultCalendarId,
  onSubmit, 
  onDelete, 
  onClone,
  onDeleteAllInSeries, 
  onDeleteThisAndFuture, 
  onDeleteThisOccurrence,
  onModifyAllInSeries,
  onModifyThisAndFuture,
  onModifyThisOccurrence,
  linkedTaskTitle,
  linkedTaskCompleted,
  onNavigateToTask,
  projects,
  onCreateTaskFromEvent,
}: CalendarEventDialogProps) {
  const { t } = useTranslation();
  
  // Determine which calendar ID to use
  const initialCalendarId = selectedEvent?.calendar_id ?? defaultCalendarId ?? 
    (calendars.length > 0 ? calendars.find(cal => cal.is_default)?.id ?? calendars[0].id : '');

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isModificationConfirmOpen, setIsModificationConfirmOpen] = useState(false);
  const [pendingModificationData, setPendingModificationData] = useState<EventFormValues | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  
  // Check if this is an ICS event (read-only)
  const isICSEvent = selectedEvent?.id?.startsWith('ics-') ?? false;
  const selectedCalendar = calendars.find(cal => cal.id === selectedEvent?.calendar_id);
  const isReadOnly = isICSEvent;

  // Initialize form with react-hook-form and zod validation
  const form = useForm({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      id: selectedEvent?.id,
      title: selectedEvent?.title ?? '',
      description: selectedEvent?.description ?? '',
      location: selectedEvent?.location ?? '',
      taskId: selectedEvent?.task_id ?? undefined,
      calendarId: initialCalendarId,
      isAllDay: selectedEvent?.all_day ?? false,
      startDate: selectedEvent ? format(new Date(selectedEvent.start_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(new Date(selectedEvent.start_time), "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(new Date(selectedEvent.end_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(new Date(selectedEvent.end_time), "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm"),
      recurrenceFrequency: selectedEvent ? (getRecurrencePattern(selectedEvent)?.frequency ?? RecurrenceFrequency.None) : RecurrenceFrequency.None,
      recurrenceEndDate: selectedEvent && getRecurrencePattern(selectedEvent)?.endDate 
        ? format(getRecurrencePattern(selectedEvent)!.endDate!, "yyyy-MM-dd") 
        : '',
      recurrenceInterval: selectedEvent ? (getRecurrencePattern(selectedEvent)?.interval ?? 1) : 1,
      isGroupEvent: selectedEvent?.is_group_event ?? false,
      isTaskReservationSpace: selectedEvent?.is_task_reservation_space ?? false,
      parentGroupEventId: selectedEvent?.parent_group_event_id ?? undefined
    }
  });

  // Reset form when selected event changes
  useEffect(() => {
    setShowProjectPicker(false);
    setIsCreatingTask(false);

    const calendarId = selectedEvent?.calendar_id ?? defaultCalendarId ?? 
      (calendars.length > 0 ? calendars.find(cal => cal.is_default)?.id ?? calendars[0].id : '');
      
    form.reset({
      id: selectedEvent?.id,
      title: selectedEvent?.title ?? '',
      description: selectedEvent?.description ?? '',
      location: selectedEvent?.location ?? '',
      taskId: selectedEvent?.task_id ?? undefined,
      calendarId,
      isAllDay: selectedEvent?.all_day ?? false,
      startDate: selectedEvent ? format(new Date(selectedEvent.start_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      startTime: selectedEvent ? format(new Date(selectedEvent.start_time), "HH:mm") : format(new Date(), "HH:mm"),
      endDate: selectedEvent ? format(new Date(selectedEvent.end_time), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      endTime: selectedEvent ? format(new Date(selectedEvent.end_time), "HH:mm") : format(new Date(new Date().getTime() + 60 * 60 * 1000), "HH:mm"),
      recurrenceFrequency: selectedEvent ? (getRecurrencePattern(selectedEvent)?.frequency ?? RecurrenceFrequency.None) : RecurrenceFrequency.None,
      recurrenceEndDate: selectedEvent && getRecurrencePattern(selectedEvent)?.endDate 
        ? format(getRecurrencePattern(selectedEvent)!.endDate!, "yyyy-MM-dd") 
        : '',
      recurrenceInterval: selectedEvent ? (getRecurrencePattern(selectedEvent)?.interval ?? 1) : 1,
      isGroupEvent: selectedEvent?.is_group_event ?? false,
      isTaskReservationSpace: selectedEvent?.is_task_reservation_space ?? false,
      parentGroupEventId: selectedEvent?.parent_group_event_id ?? undefined
    });
  }, [selectedEvent, form, calendars, defaultCalendarId]);

  // Handle form submission
  const handleFormSubmit: SubmitHandler<EventFormValues> = async (values) => {
    try {
      // console.log("Form values:", values); // Comment out or remove this log
      
      // Ensure we have valid strings before proceeding
      if (!values.startDate || !values.endDate) {
        console.error("Missing date values:", {
          startDate: values.startDate,
          endDate: values.endDate
        });
        return;
      }

      // For all-day events, ensure we have time values
      if (values.isAllDay) {
        if (!values.startTime) {
          values.startTime = '00:00';
        }
        if (!values.endTime) {
          values.endTime = '23:59';
        }
      } else {
        // For non all-day events, ensure we have time values
        if (!values.startTime || !values.endTime) {
          console.error("Missing time values for timed event:", {
            startTime: values.startTime,
            endTime: values.endTime
          });
          return;
        }
      }
      
      // Replace empty recurrenceEndDate with undefined to avoid parsing errors
      if (values.recurrenceFrequency === RecurrenceFrequency.None || !values.recurrenceEndDate) {
        values.recurrenceEndDate = undefined;
      }

      // Check if this is a modification of a recurring event
      const recurrencePattern = selectedEvent ? getRecurrencePattern(selectedEvent) : null;
      const isRecurringEvent = recurrencePattern && 
        recurrencePattern.frequency !== RecurrenceFrequency.None;
      const isEditingExistingEvent = selectedEvent && selectedEvent.id && selectedEvent.id !== 'new';

      if (isEditingExistingEvent && isRecurringEvent && 
          (onModifyAllInSeries || onModifyThisAndFuture || onModifyThisOccurrence)) {
        
        // Check if recurrence settings have been changed
        const originalFrequency = recurrencePattern?.frequency || RecurrenceFrequency.None;
        const originalInterval = recurrencePattern?.interval || 1;
        const originalEndDate = recurrencePattern?.endDate;
        
        // Normalize end dates for comparison
        const normalizedOriginalEndDate = originalEndDate ? format(new Date(originalEndDate), "yyyy-MM-dd") : '';
        const normalizedNewEndDate = values.recurrenceEndDate || '';
        
        const hasRecurrenceChanges = 
          values.recurrenceFrequency !== originalFrequency ||
          values.recurrenceInterval !== originalInterval ||
          normalizedNewEndDate !== normalizedOriginalEndDate;
        
        if (hasRecurrenceChanges) {
          // For recurrence setting changes, automatically modify all in series
          if (onModifyAllInSeries) {
            await onModifyAllInSeries(selectedEvent, values);
            return;
          }
        }
        
        // For other changes, show the modification choice modal
        setPendingModificationData(values);
        setIsModificationConfirmOpen(true);
        return;
      }
      
      // Call the onSubmit callback with the validated form values for non-recurring events
      await onSubmit(values);
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  // Helper function to adjust time
  const adjustTime = (timeStr: string, adjustMinutes: number): string => {
    if (!timeStr) return "";
    const date = parse(timeStr, 'HH:mm', new Date());
    if (!isValid(date)) return timeStr;
    
    const adjustedDate = addMinutes(date, adjustMinutes);
    return format(adjustedDate, 'HH:mm');
  };

  // Get relative time options for end time
  const getEndTimeOptions = (): QuickTimeOption[] => {
    const startTime = form.watch('startTime');
    
    if (!startTime) {
      return [
        { value: "09:00" },
        { value: "12:00" },
        { value: "15:00" },
        { value: "18:00" }
      ];
    }
    
    return [
      { value: adjustTime(startTime, 15), label: "15m" },
      { value: adjustTime(startTime, 30), label: "30m" },
      { value: adjustTime(startTime, 60), label: "1h" },
      { value: adjustTime(startTime, 180), label: "3h" }
    ];
  };

  // Create start time quick options
  const startTimeOptions: QuickTimeOption[] = [
    { value: "09:00" },
    { value: "12:00" },
    { value: "15:00" },
    { value: "18:00" }
  ];

  // Get the end time options
  const endTimeOptions = getEndTimeOptions();

  // Handlers for recurring event modification
  const handleModifyThisOccurrenceConfirmed = async (event: CalendarEvent) => {
    if (pendingModificationData && onModifyThisOccurrence) {
      const modifiedData = {
        title: pendingModificationData.title,
        description: pendingModificationData.description,
        location: pendingModificationData.location,
        calendarId: pendingModificationData.calendarId,
        startTime: combineDateAndTime(pendingModificationData.startDate, pendingModificationData.startTime || '00:00'),
        endTime: combineDateAndTime(pendingModificationData.endDate, pendingModificationData.endTime || '23:59'),
        isGroupEvent: pendingModificationData.isGroupEvent,
        isTaskReservationSpace: pendingModificationData.isTaskReservationSpace,
        parentGroupEventId: pendingModificationData.parentGroupEventId,
        recurrenceFrequency: pendingModificationData.recurrenceFrequency,
        recurrenceEndDate: pendingModificationData.recurrenceEndDate,
        recurrenceInterval: pendingModificationData.recurrenceInterval,
        daysOfWeek: pendingModificationData.daysOfWeek
      };
      await onModifyThisOccurrence(event, modifiedData);
    }
  };

  const handleModifyThisAndFutureConfirmed = async (event: CalendarEvent) => {
    if (pendingModificationData && onModifyThisAndFuture) {
      const modifiedData = {
        title: pendingModificationData.title,
        description: pendingModificationData.description,
        location: pendingModificationData.location,
        calendarId: pendingModificationData.calendarId,
        startTime: combineDateAndTime(pendingModificationData.startDate, pendingModificationData.startTime || '00:00'),
        endTime: combineDateAndTime(pendingModificationData.endDate, pendingModificationData.endTime || '23:59'),
        isGroupEvent: pendingModificationData.isGroupEvent,
        isTaskReservationSpace: pendingModificationData.isTaskReservationSpace,
        parentGroupEventId: pendingModificationData.parentGroupEventId,
        recurrenceFrequency: pendingModificationData.recurrenceFrequency,
        recurrenceEndDate: pendingModificationData.recurrenceEndDate,
        recurrenceInterval: pendingModificationData.recurrenceInterval,
        daysOfWeek: pendingModificationData.daysOfWeek
      };
      await onModifyThisAndFuture(event, modifiedData);
    }
  };

  const handleModifyAllInSeriesConfirmed = async (event: CalendarEvent) => {
    if (pendingModificationData && onModifyAllInSeries) {
      const modifiedData = {
        title: pendingModificationData.title,
        description: pendingModificationData.description,
        location: pendingModificationData.location,
        calendarId: pendingModificationData.calendarId,
        startTime: combineDateAndTime(pendingModificationData.startDate, pendingModificationData.startTime || '00:00'),
        endTime: combineDateAndTime(pendingModificationData.endDate, pendingModificationData.endTime || '23:59'),
        isGroupEvent: pendingModificationData.isGroupEvent,
        isTaskReservationSpace: pendingModificationData.isTaskReservationSpace,
        parentGroupEventId: pendingModificationData.parentGroupEventId,
        recurrenceFrequency: pendingModificationData.recurrenceFrequency,
        recurrenceEndDate: pendingModificationData.recurrenceEndDate,
        recurrenceInterval: pendingModificationData.recurrenceInterval,
        daysOfWeek: pendingModificationData.daysOfWeek
      };
      await onModifyAllInSeries(event, modifiedData);
    }
  };

  const handleModificationConfirmed = () => {
    setPendingModificationData(null);
    onOpenChange(false);
  };

  const handleDeleteConfirmedAndCloseMainDialog = () => {
    onOpenChange(false);
  };

  const handleMainDialogInteractOutside = (event: Event) => {
    if (isDeleteConfirmOpen) {
      event.preventDefault();
    }
  };

  const handleCreateTaskProjectSelect = async (projectId: string | null) => {
    if (!onCreateTaskFromEvent) return;
    const title = form.getValues('title');
    try {
      setIsCreatingTask(true);
      await onCreateTaskFromEvent(title, projectId);
    } finally {
      setIsCreatingTask(false);
      setShowProjectPicker(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent onInteractOutside={handleMainDialogInteractOutside}>
        <DialogHeader>
          <DialogTitle>
            {isReadOnly ? t('calendar.viewEvent') : (selectedEvent ? t('calendar.editEvent') : t('calendar.addNewEvent'))}
          </DialogTitle>
          {isReadOnly && (
            <div className="mt-2 text-sm text-blue-600 bg-blue-50 p-2 rounded-md">
              <p>This event is from an ICS calendar and cannot be edited.</p>
            </div>
          )}
          {selectedEvent?.id?.includes('-recurrence-') && !isReadOnly && (
            <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-md">
              <p>This is a recurring event instance. Changes will affect the entire series.</p>
            </div>
          )}
          {linkedTaskTitle && onNavigateToTask && (
            <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm text-blue-900 dark:text-blue-100 font-medium">Linked Task:</span>
                <button
                  type="button"
                  onClick={onNavigateToTask}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
                >
                  {linkedTaskTitle}
                </button>
                <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                  linkedTaskCompleted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                }`}>
                  {linkedTaskCompleted ? t('tasks.done') : t('tasks.open')}
                </span>
              </div>
            </div>
          )}
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Event title" {...field} disabled={isReadOnly} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Event description" {...field} disabled={isReadOnly} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Event location" {...field} disabled={isReadOnly} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            {/* Calendar Selection */}
            <FormField
              control={form.control}
              name="calendarId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('calendar.calendar')}</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    value={field.value}
                    disabled={isReadOnly}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a calendar" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {calendars.map(calendar => (
                        <SelectItem key={calendar.id} value={calendar.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: calendar.color }}
                            ></div>
                            <span>{calendar.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
            
            {/* All-Day Toggle */}
            <FormField
              control={form.control}
              name="isAllDay"
              render={({ field }) => (
                <FormItem>
                  <div 
                    className="flex flex-row items-center justify-between w-full rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      if (!isReadOnly) {
                        field.onChange(!field.value);
                      }
                    }}
                  >
                    <FormLabel 
                      className="text-sm font-medium cursor-pointer select-none"
                    >
                      All Day
                    </FormLabel>
                    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                      <Checkbox
                        onCheckedChange={field.onChange}
                        checked={field.value}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                </FormItem>
              )}
            />

            {/* Start Date and Time */}
            <div className={`grid ${form.watch('isAllDay') ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('calendar.startDate')}</FormLabel>
                    <FormControl>
                      <DatePicker 
                        value={field.value} 
                        onChange={field.onChange} 
                        disabled={isReadOnly}
                        placeholder="Select start date"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {!form.watch('isAllDay') && (
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('calendar.startTime')}</FormLabel>
                      <FormControl>
                        <TimeInput 
                          {...field} 
                          quickTimeOptions={startTimeOptions} 
                          disabled={isReadOnly}
                          onChange={(value) => {
                            field.onChange(value);
                            // Force re-render of end time options when start time changes
                            form.trigger('endTime');
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            {/* End Date and Time */}
            <div className={`grid ${form.watch('isAllDay') ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('calendar.endDate')}</FormLabel>
                    <FormControl>
                      <DatePicker 
                        value={field.value} 
                        onChange={field.onChange} 
                        disabled={isReadOnly}
                        placeholder="Select end date"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {!form.watch('isAllDay') && (
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('calendar.endTime')}</FormLabel>
                      <FormControl>
                        <TimeInput 
                          {...field} 
                          quickTimeOptions={endTimeOptions}
                          disabled={isReadOnly}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* Recurrence Settings */}
            <div>
              <FormField
                control={form.control}
                name="recurrenceFrequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('calendar.recurrenceFrequency')}</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        disabled={isReadOnly}
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Reset recurrence end date if frequency is changed to none
                          if (value === RecurrenceFrequency.None) {
                            form.setValue('recurrenceEndDate', '');
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select recurrence" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={RecurrenceFrequency.None}>None</SelectItem>
                          <SelectItem value={RecurrenceFrequency.Daily}>Daily</SelectItem>
                          <SelectItem value={RecurrenceFrequency.Weekly}>Weekly</SelectItem>
                          <SelectItem value={RecurrenceFrequency.Monthly}>Monthly</SelectItem>
                          <SelectItem value={RecurrenceFrequency.Yearly}>Yearly</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {form.watch('recurrenceFrequency') !== RecurrenceFrequency.None && (
                <>
                  <FormField
                    control={form.control}
                    name="recurrenceInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Interval</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} {...field} disabled={isReadOnly} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="recurrenceEndDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('calendar.recurrenceEndDate')}</FormLabel>
                        <FormControl>
                          <DatePicker 
                            value={field.value} 
                            onChange={field.onChange} 
                            disabled={isReadOnly}
                            placeholder="Select end date"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>

            {/* Event Group Settings */}
            {!isReadOnly && (
              <div className="space-y-3 pt-2 border-t">
                <h3 className="text-sm font-medium text-muted-foreground">Event Group</h3>
                
                {/* Show parent group info if event is in a group */}
                {form.watch('parentGroupEventId') && !form.watch('isGroupEvent') && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded-md">
                    <p>This event is part of an event group.</p>
                  </div>
                )}
                
                {/* Convert to Group Toggle */}
              <FormField
                control={form.control}
                name="isGroupEvent"
                  render={({ field }) => (
                    <FormItem>
                      <div 
                        className="flex flex-row items-center justify-between w-full rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          const newValue = !field.value;
                          field.onChange(newValue);
                          // If converting to group event, clear parent group
                          if (newValue) {
                            form.setValue('parentGroupEventId', undefined);
                          } else {
                            form.setValue('isTaskReservationSpace', false);
                          }
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          <FormLabel className="text-sm font-medium cursor-pointer select-none">
                            Convert to Event Group
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Allow other events to be placed inside this event
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                          <Checkbox
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              // If converting to group event, clear parent group
                              if (checked) {
                                form.setValue('parentGroupEventId', undefined);
                              } else {
                                form.setValue('isTaskReservationSpace', false);
                              }
                            }}
                            checked={field.value}
                          />
                        </div>
                      </div>
                      {field.value && (
                        <div className="text-xs text-muted-foreground mt-1 px-3">
                          This event can now contain other events. Drag events over this one to add them.
                        </div>
                      )}
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="isTaskReservationSpace"
                  render={({ field }) => (
                    <FormItem>
                      <div
                        className="flex flex-row items-center justify-between w-full rounded-lg border bg-card p-3 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => {
                          const nextValue = !field.value;
                          field.onChange(nextValue);
                          if (nextValue) {
                            form.setValue('isGroupEvent', true);
                            form.setValue('parentGroupEventId', undefined);
                          }
                        }}
                      >
                        <div className="flex flex-col gap-1">
                          <FormLabel className="text-sm font-medium cursor-pointer select-none">
                            {t('calendar.taskReservationSpace')}
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            {t('calendar.taskReservationSpaceHelp')}
                          </p>
                        </div>
                        <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                          <Checkbox
                            onCheckedChange={(checked) => {
                              field.onChange(checked);
                              if (checked) {
                                form.setValue('isGroupEvent', true);
                                form.setValue('parentGroupEventId', undefined);
                              }
                            }}
                            checked={field.value}
                          />
                        </div>
                      </div>
                      {field.value && (
                        <div className="text-xs text-muted-foreground mt-1 px-3">
                          {t('calendar.taskReservationSpaceNote')}
                        </div>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            <DialogFooter className="flex-row items-center justify-between sm:justify-between">
              {/* Left: secondary actions */}
              <div className="flex items-center gap-2">
                {!isReadOnly && selectedEvent && onCreateTaskFromEvent && projects && !linkedTaskTitle && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowProjectPicker(true)}
                  >
                    <ListTodo className="h-4 w-4 mr-2" />
                    Create Task
                  </Button>
                )}
                {selectedEvent && onClone && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClone(selectedEvent);
                      onOpenChange(false);
                    }}
                  >
                    Clone
                  </Button>
                )}
                {selectedEvent && !isReadOnly && (() => {
                  const recurrencePattern = getRecurrencePattern(selectedEvent);
                  const isRecurring = recurrencePattern && recurrencePattern.frequency !== RecurrenceFrequency.None;
                  return (
                    <>
                      {isRecurring ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsDeleteConfirmOpen(true);
                          }}
                          aria-label="Delete event"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(selectedEvent.id);
                          }}
                          aria-label="Delete event"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  );
                })()}
              </div>
              {/* Right: primary action */}
              {!isReadOnly && (
                <Button type="submit">
                  {selectedEvent ? 'Update' : 'Add'} Event
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      {/* Project picker modal – renders on top of this dialog */}
      {!isReadOnly && selectedEvent && onCreateTaskFromEvent && projects && !linkedTaskTitle && (
        <EventTaskProjectPicker
          isOpen={showProjectPicker}
          projects={projects}
          onSelect={handleCreateTaskProjectSelect}
          onCancel={() => setShowProjectPicker(false)}
          isLoading={isCreatingTask}
        />
      )}
      {selectedEvent && onDeleteAllInSeries && onDeleteThisAndFuture && onDeleteThisOccurrence && (
        <DeleteConfirmationDialog
          isOpen={isDeleteConfirmOpen}
          onOpenChange={setIsDeleteConfirmOpen}
          selectedEvent={selectedEvent}
          onDeleteThisOccurrence={onDeleteThisOccurrence}
          onDeleteThisAndFuture={onDeleteThisAndFuture}
          onDeleteAllInSeries={onDeleteAllInSeries}
          onDeleteConfirmedAndMainDialogClose={handleDeleteConfirmedAndCloseMainDialog}
        />
      )}
      {selectedEvent && onModifyAllInSeries && onModifyThisAndFuture && onModifyThisOccurrence && (
        <RecurringEventModificationDialog
          isOpen={isModificationConfirmOpen}
          onOpenChange={setIsModificationConfirmOpen}
          selectedEvent={selectedEvent}
          onModifyThisOccurrence={handleModifyThisOccurrenceConfirmed}
          onModifyThisAndFuture={handleModifyThisAndFutureConfirmed}
          onModifyAllInSeries={handleModifyAllInSeriesConfirmed}
          onModificationConfirmed={handleModificationConfirmed}
        />
      )}
    </Dialog>
  );
}
