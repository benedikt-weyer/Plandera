"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/shadcn-utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useWeekStartDay } from "@/stores/settings-store"

interface DatePickerProps {
  value?: string
  onChange?: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export function DatePicker({
  value,
  onChange,
  disabled = false,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const weekStartsOn = useWeekStartDay();
  const [date, setDate] = React.useState<Date | undefined>(
    value ? new Date(value) : undefined
  )
  const [open, setOpen] = React.useState(false)

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    if (selectedDate && onChange) {
      // Format date as YYYY-MM-DD for form compatibility
      onChange(format(selectedDate, 'yyyy-MM-dd'))
      setOpen(false) // Close the popover after selection
    } else if (!selectedDate && onChange) {
      onChange('')
    }
  }

  // Update internal date when value prop changes
  React.useEffect(() => {
    if (value) {
      setDate(new Date(value))
    } else {
      setDate(undefined)
    }
  }, [value])

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setDate(undefined)
    if (onChange) {
      onChange('')
    }
    setOpen(false)
  }

  return (
    <div className={cn("flex gap-0", className)}>
      <Popover modal={true} open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !date && "text-muted-foreground",
              date && !disabled ? "rounded-r-none flex-1" : "w-full"
            )}
            disabled={disabled}
            onClick={(e) => e.stopPropagation()}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "dd.MM.yyyy") : placeholder}
          </Button>
        </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0" 
        align="start"
        side="bottom"
        sideOffset={4}
        style={{ zIndex: 99999 }}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => {
          // Only close if clicking outside the popover content
          const target = e.target as Element
          if (!target.closest('[data-radix-popper-content-wrapper]')) {
            return // Let it close normally
          }
          e.preventDefault()
        }}
      >
        <div 
          onClick={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onMouseUp={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
          className="relative bg-popover border rounded-md shadow-md"
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={(selectedDate) => {
              handleDateSelect(selectedDate)
            }}
            defaultMonth={date}
            weekStartsOn={weekStartsOn}
            initialFocus
            classNames={{
              day: cn(
                "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
              ),
              day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
              day_today: "bg-accent text-accent-foreground",
              day_outside: "text-muted-foreground opacity-50",
              day_disabled: "text-muted-foreground opacity-50",
              day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
              day_hidden: "invisible",
            }}
            components={{
              DayButton: ({ day, modifiers, ...props }) => (
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 w-9 p-0 font-normal hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer",
                    modifiers.selected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                    modifiers.today && !modifiers.selected && "bg-accent text-accent-foreground",
                    modifiers.outside && "text-muted-foreground opacity-50",
                    modifiers.disabled && "text-muted-foreground opacity-50 cursor-not-allowed"
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    // Manually trigger the date selection
                    handleDateSelect(day.date)
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  onMouseUp={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                  }}
                  type="button"
                >
                  {day.date.getDate()}
                </Button>
              )
            }}
          />
        </div>
      </PopoverContent>
    </Popover>
      {date && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleClear}
          disabled={disabled}
          className="rounded-l-none border-l-0"
          aria-label="Clear date"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}