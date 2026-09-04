"use client";

import { useState } from "react";
import {
  Plus,
  Edit,
  Trash,
  Settings,
  Star,
  RefreshCw,
  Link,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  CalendarType,
  CalendarView,
} from "@/utils/calendar/calendar-types";
import { useTranslation } from "@/utils/context/LanguageContext";
import { MonthOverview } from "./month-overview";
import { MonthPicker } from "./month-picker";

interface CalendarSidebarProps {
  calendars: Calendar[];
  onCalendarToggle: (calendarId: string, isVisible: boolean) => void;
  onCalendarCreate: (name: string, color: string) => void;
  onICSCalendarCreate: (name: string, color: string, icsUrl: string) => void;
  onICSCalendarRefresh: (calendarId: string) => void;
  onCalendarEdit: (calendarId: string, name: string, color: string) => void;
  onCalendarDelete: (calendarId: string) => void;
  onSetDefaultCalendar: (calendarId: string) => void; // New prop for setting default calendar
  view: CalendarView;
  selectedDate?: Date;
  currentWeek?: Date;
  onDateSelect?: (date: Date) => void;
  onMonthChange?: (date: Date) => void;
}

export function CalendarSidebar({
  calendars,
  onCalendarToggle,
  onCalendarCreate,
  onICSCalendarCreate,
  onICSCalendarRefresh,
  onCalendarEdit,
  onCalendarDelete,
  onSetDefaultCalendar,
  view,
  selectedDate,
  currentWeek,
  onDateSelect,
  onMonthChange,
}: CalendarSidebarProps) {
  const { t } = useTranslation();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState("");
  const [newCalendarColor, setNewCalendarColor] = useState("#4f46e5"); // Default indigo color
  const [newCalendarICSUrl, setNewCalendarICSUrl] = useState("");
  const [selectedCalendar, setSelectedCalendar] = useState<Calendar | null>(
    null,
  );

  // Predefined color options
  const colorOptions = [
    { name: "Indigo", value: "#4f46e5" },
    { name: "Red", value: "#ef4444" },
    { name: "Green", value: "#22c55e" },
    { name: "Yellow", value: "#eab308" },
    { name: "Purple", value: "#a855f7" },
    { name: "Pink", value: "#ec4899" },
    { name: "Blue", value: "#3b82f6" },
    { name: "Orange", value: "#f97316" },
    { name: "Teal", value: "#14b8a6" },
  ];

  const handleCreateCalendar = () => {
    if (newCalendarName.trim()) {
      onCalendarCreate(newCalendarName.trim(), newCalendarColor);
      setNewCalendarName("");
      setNewCalendarColor("#4f46e5");
      setIsCreateDialogOpen(false);
    }
  };

  const handleCreateICSCalendar = () => {
    if (newCalendarName.trim() && newCalendarICSUrl.trim()) {
      onICSCalendarCreate(
        newCalendarName.trim(),
        newCalendarColor,
        newCalendarICSUrl.trim(),
      );
      setNewCalendarName("");
      setNewCalendarColor("#4f46e5");
      setNewCalendarICSUrl("");
      setIsCreateDialogOpen(false);
    }
  };

  const handleRefreshICSCalendar = (calendarId: string) => {
    onICSCalendarRefresh(calendarId);
  };

  const openEditDialog = (calendar: Calendar) => {
    setSelectedCalendar(calendar);
    setNewCalendarName(calendar.name);
    setNewCalendarColor(calendar.color || "");
    setNewCalendarICSUrl(calendar.ics_url || ""); // Set ICS URL if it exists
    setIsEditDialogOpen(true);
  };

  const handleEditCalendar = () => {
    if (selectedCalendar && newCalendarName.trim()) {
      onCalendarEdit(
        selectedCalendar.id,
        newCalendarName.trim(),
        newCalendarColor,
      );
      setSelectedCalendar(null);
      setNewCalendarName("");
      setNewCalendarColor("#4f46e5");
      setNewCalendarICSUrl("");
      setIsEditDialogOpen(false);
    }
  };

  const handleDeleteCalendar = () => {
    if (selectedCalendar) {
      onCalendarDelete(selectedCalendar.id);
      setSelectedCalendar(null);
      setNewCalendarName("");
      setNewCalendarColor("#4f46e5");
      setNewCalendarICSUrl("");
      setIsEditDialogOpen(false);
    }
  };

  const handleSetDefaultCalendar = () => {
    if (selectedCalendar && !selectedCalendar.is_default) {
      onSetDefaultCalendar(selectedCalendar.id);
      setIsEditDialogOpen(false);
    }
  };

  return (
    <div className="w-60 border-r p-2 h-full">
      {/* Month Overview */}
      <div className="mb-6">
        {view === "month" ? (
          <MonthPicker
            selectedDate={selectedDate}
            onMonthSelect={onMonthChange}
          />
        ) : (
          <MonthOverview
            selectedDate={selectedDate}
            currentWeek={currentWeek}
            onDateSelect={onDateSelect}
            onMonthChange={onMonthChange}
          />
        )}
      </div>

      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-lg">{t("calendar.myCalendars")}</h2>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          size="icon"
          variant="ghost"
          title={t("calendar.addCalendar")}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-2">
        {calendars.map((calendar) => (
          <div
            key={calendar.id}
            className="flex items-center justify-between group"
          >
            <div
              className="flex items-center gap-2 cursor-pointer flex-grow overflow-hidden"
              onClick={() => {
                onCalendarToggle(calendar.id, !calendar.is_visible);
              }}
            >
              <button
                className="rounded-full p-1 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the parent onClick
                  onCalendarToggle(calendar.id, !calendar.is_visible);
                }}
              >
                <div
                  className={`w-3 h-3 rounded-full border-2 flex items-center justify-center`}
                  style={{
                    borderColor: calendar.color,
                    backgroundColor: calendar.is_visible
                      ? calendar.color
                      : "transparent",
                  }}
                ></div>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <span
                    className={`${calendar.is_visible ? "text-foreground" : "text-gray-500"} truncate block`}
                  >
                    {calendar.name}
                  </span>
                  {calendar.type === CalendarType.ICS && (
                    <Link className="h-3 w-3 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {calendar.type === CalendarType.ICS && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRefreshICSCalendar(calendar.id);
                        }}
                        size="icon"
                        variant="ghost"
                        className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 h-8 w-8"
                        title="Refresh Calendar"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Refresh ICS Calendar</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the container's onClick
                  openEditDialog(calendar);
                }}
                size="icon"
                variant="ghost"
                className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 h-8 w-8"
                title={t("calendar.editCalendar")}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Calendar Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("calendar.createNewCalendar")}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="regular" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="regular" className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Regular
              </TabsTrigger>
              <TabsTrigger value="ics" className="flex items-center gap-2">
                <Link className="h-4 w-4" />
                ICS URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="regular" className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="calendarName" className="text-sm font-medium">
                  {t("calendar.calendarName")}
                </label>
                <Input
                  id="calendarName"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  placeholder="My Calendar"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 ${
                        newCalendarColor === color.value
                          ? "ring-2 ring-offset-2 ring-offset-gray-100 ring-blue-500"
                          : ""
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewCalendarColor(color.value)}
                      title={color.name}
                    ></button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreateCalendar}>
                  {t("common.create")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="ics" className="space-y-4">
              <div className="space-y-2">
                <label
                  htmlFor="icsCalendarName"
                  className="text-sm font-medium"
                >
                  {t("calendar.calendarName")}
                </label>
                <Input
                  id="icsCalendarName"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  placeholder="External Calendar"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="icsUrl" className="text-sm font-medium">
                  ICS URL
                </label>
                <Input
                  id="icsUrl"
                  value={newCalendarICSUrl}
                  onChange={(e) => setNewCalendarICSUrl(e.target.value)}
                  placeholder="https://calendar.example.com/calendar.ics"
                />
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Enter the URL of an ICS calendar file. Events from this
                    calendar will be read-only.
                  </p>
                  <div className="text-xs text-amber-600 bg-amber-50 rounded-md p-2">
                    <strong>Note:</strong> The calendar URL must support CORS
                    (cross-origin requests). Many calendar providers like Google
                    Calendar, Outlook, and most calendar applications provide
                    CORS-enabled URLs. If you encounter connection issues,
                    contact your calendar provider.
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 ${
                        newCalendarColor === color.value
                          ? "ring-2 ring-offset-2 ring-offset-gray-100 ring-blue-500"
                          : ""
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewCalendarColor(color.value)}
                      title={color.name}
                    ></button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button onClick={handleCreateICSCalendar}>
                  {t("common.create")}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit Calendar Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            // Clear state when dialog is closed
            setSelectedCalendar(null);
            setNewCalendarName("");
            setNewCalendarColor("#4f46e5");
            setNewCalendarICSUrl("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calendar.editCalendar")}</DialogTitle>
            {selectedCalendar?.is_default && (
              <div className="text-sm text-amber-600 mt-1 px-2 py-1 bg-amber-50 rounded-md">
                This is your default calendar. It will be pre-selected when
                creating new events.
              </div>
            )}
          </DialogHeader>
          {selectedCalendar && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label
                  htmlFor="editCalendarName"
                  className="text-sm font-medium"
                >
                  {t("calendar.calendarName")}
                </label>
                <Input
                  id="editCalendarName"
                  value={newCalendarName}
                  onChange={(e) => setNewCalendarName(e.target.value)}
                  placeholder="My Calendar"
                />
              </div>

              {/* Show ICS URL field if this is an ICS calendar */}
              {selectedCalendar.type === CalendarType.ICS && (
                <div className="space-y-2">
                  <label htmlFor="editIcsUrl" className="text-sm font-medium">
                    ICS URL
                  </label>
                  <Input
                    id="editIcsUrl"
                    value={newCalendarICSUrl}
                    onChange={(e) => setNewCalendarICSUrl(e.target.value)}
                    placeholder="https://calendar.example.com/calendar.ics"
                    disabled
                  />
                  <p className="text-xs text-muted-foreground">
                    ICS URL cannot be changed after calendar creation. To use a
                    different URL, create a new ICS calendar.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Color</label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      className={`w-8 h-8 rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-100 focus:ring-blue-500 ${
                        newCalendarColor === color.value
                          ? "ring-2 ring-offset-2 ring-offset-gray-100 ring-blue-500"
                          : ""
                      }`}
                      style={{ backgroundColor: color.value }}
                      onClick={() => setNewCalendarColor(color.value)}
                      title={color.name}
                    ></button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteCalendar}
                        disabled={
                          selectedCalendar?.is_default || calendars.length <= 1
                        }
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {(selectedCalendar?.is_default || calendars.length <= 1) && (
                    <TooltipContent>
                      {selectedCalendar?.is_default
                        ? "Default calendars cannot be deleted. Set another calendar as default first."
                        : "You must have at least one calendar."}
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              {!selectedCalendar?.is_default && (
                <Button
                  variant="outline"
                  onClick={handleSetDefaultCalendar}
                  className="flex items-center"
                >
                  <Star
                    className="h-4 w-4 mr-2 text-amber-500"
                    fill="currentColor"
                  />
                  Set as Default
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedCalendar(null);
                  setNewCalendarName("");
                  setNewCalendarColor("#4f46e5");
                  setNewCalendarICSUrl("");
                  setIsEditDialogOpen(false);
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button onClick={handleEditCalendar}>{t("common.save")}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
