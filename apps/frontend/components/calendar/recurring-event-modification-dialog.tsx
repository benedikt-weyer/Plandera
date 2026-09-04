import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { CalendarEvent } from '@/utils/calendar/calendar-types';
import { Calendar, CalendarX, Edit3 } from 'lucide-react';

interface RecurringEventModificationDialogProps {
  readonly isOpen: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly selectedEvent: CalendarEvent;
  readonly onModifyThisOccurrence: (event: CalendarEvent) => Promise<void>;
  readonly onModifyThisAndFuture: (event: CalendarEvent) => Promise<void>;
  readonly onModifyAllInSeries: (event: CalendarEvent) => Promise<void>;
  readonly onModificationConfirmed: () => void;
}

export function RecurringEventModificationDialog({
  isOpen,
  onOpenChange,
  selectedEvent,
  onModifyThisOccurrence,
  onModifyThisAndFuture,
  onModifyAllInSeries,
  onModificationConfirmed,
}: RecurringEventModificationDialogProps) {
  if (!selectedEvent) return null;

  const handleThisOccurrence = async () => {
    await onModifyThisOccurrence(selectedEvent);
    setTimeout(() => {
      onOpenChange(false);
      onModificationConfirmed();
    }, 0);
  };

  const handleThisAndFuture = async () => {
    await onModifyThisAndFuture(selectedEvent);
    setTimeout(() => {
      onOpenChange(false);
      onModificationConfirmed();
    }, 0);
  };

  const handleAllInSeries = async () => {
    await onModifyAllInSeries(selectedEvent);
    setTimeout(() => {
      onOpenChange(false);
      onModificationConfirmed();
    }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Modify Recurring Event</DialogTitle>
          <DialogDescription>
            "{selectedEvent.title}" is a recurring event. How would you like to modify it?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-3 pt-4">
          <Button
            variant="outline"
            onClick={handleThisOccurrence}
            className="w-full justify-start h-auto py-3 px-4"
          >
            <Calendar className="w-5 h-5 mr-3 shrink-0" />
            <div className="text-left">
              <div className="font-medium">Just this event</div>
              <div className="text-sm text-muted-foreground">Only modify this occurrence</div>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={handleThisAndFuture}
            className="w-full justify-start h-auto py-3 px-4"
          >
            <CalendarX className="w-5 h-5 mr-3 shrink-0" />
            <div className="text-left">
              <div className="font-medium">This and future events</div>
              <div className="text-sm text-muted-foreground">Modify this and all upcoming occurrences</div>
            </div>
          </Button>
          <Button
            variant="outline"
            onClick={handleAllInSeries}
            className="w-full justify-start h-auto py-3 px-4"
          >
            <Edit3 className="w-5 h-5 mr-3 shrink-0" />
            <div className="text-left">
              <div className="font-medium">All events in series</div>
              <div className="text-sm text-muted-foreground">Modify the entire recurring event series</div>
            </div>
          </Button>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 