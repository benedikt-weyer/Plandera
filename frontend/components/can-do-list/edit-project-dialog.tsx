'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { CanDoItemDecrypted, ProjectDecrypted } from '@/utils/api/types';
import { getAvailableParents, canMoveProject } from '@/utils/can-do-list/project-hierarchy';
import { Trash2, ArrowLeft } from 'lucide-react';

// Predefined color options
const PROJECT_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#6b7280', // gray-500
  '#78716c', // stone-500
] as const;

// Define schema for edit project validation
const editProjectSchema = z.object({
  name: z.string().min(1, { message: "Project name is required" }).max(50, { message: "Project name must be 50 characters or less" }),
  color: z.string().min(1, { message: "Please select a color" }),
  parentId: z.string().optional(),
});

type EditProjectFormValues = z.infer<typeof editProjectSchema>;

interface EditProjectDialogProps {
  readonly project: ProjectDecrypted | null;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSave: (id: string, name: string, color: string, parentId?: string) => Promise<boolean>;
  readonly onDelete: (id: string) => Promise<boolean>;
  readonly isLoading?: boolean;
  readonly projects?: ProjectDecrypted[];
  readonly tasks?: CanDoItemDecrypted[];
}

type DialogMode = 'edit' | 'delete-confirm';

export default function EditProjectDialog({
  project,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isLoading = false,
  projects = [],
  tasks = []
}: EditProjectDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>('edit');

  const form = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectSchema),
    defaultValues: {
      name: '',
      color: PROJECT_COLORS[0],
      parentId: undefined
    }
  });

  // Update form when project changes
  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        color: project.color || PROJECT_COLORS[0],
        parentId: project.parent_id
      });
    }
  }, [project, form]);

  // Reset states when dialog closes or opens
  useEffect(() => {
    if (!isOpen) {
      setIsDeleting(false);
      setIsSaving(false);
      setDialogMode('edit');
      form.reset();
    } else {
      setDialogMode('edit');
    }
  }, [isOpen, form]);

  const handleSubmit = async (values: EditProjectFormValues) => {
    if (!project) return;
    
    setIsSaving(true);
    try {
      const success = await onSave(project.id, (values.name || '').trim(), values.color, values.parentId);
      if (success) {
        handleClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!project || isDeleting) return;
    
    setIsDeleting(true);
    try {
      const success = await onDelete(project.id);
      if (success) {
        handleClose();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isSaving && !isDeleting) {
      setDialogMode('edit');
      form.reset();
      onClose();
    }
  };

  const handleDeleteClick = () => {
    setDialogMode('delete-confirm');
  };

  const handleBackToEdit = () => {
    if (!isDeleting) {
      setDialogMode('edit');
    }
  };

  if (!project) return null;

  const taskCount = tasks.filter(task => task.project_id === project.id).length;
  const childProjectCount = projects.filter(candidate => candidate.parent_id === project.id).length;

  const taskWarning =
    taskCount === 0
      ? 'This project has no tasks.'
      : taskCount === 1
        ? 'The 1 task in this project will be deleted.'
        : `All ${taskCount} tasks in this project will be deleted.`;

  const childProjectWarning =
    childProjectCount === 0
      ? ''
      : childProjectCount === 1
        ? ' Its child project will be moved up one level.'
        : ` Its ${childProjectCount} child projects will be moved up one level.`;

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        {dialogMode === 'edit' ? (
          <>
            <DialogHeader>
              <DialogTitle>Edit Project</DialogTitle>
              <DialogDescription>
                Update the project name and color, or delete the project.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter project name..."
                          disabled={isSaving || isLoading}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="space-y-3">
                          {/* Predefined Colors */}
                          <div>
                            <div className="text-sm text-muted-foreground mb-2">Preset Colors</div>
                            <div className="grid grid-cols-5 gap-2">
                              {PROJECT_COLORS.map(color => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => field.onChange(color)}
                                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                                    field.value === color
                                      ? 'border-foreground scale-110'
                                      : 'border-muted-foreground/30 hover:border-muted-foreground/60'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  disabled={isSaving || isLoading}
                                >
                                  <span className="sr-only">Select {color}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Custom Color Picker */}
                          <div>
                            <div className="text-sm text-muted-foreground mb-2">Custom Color</div>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={field.value}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="w-8 h-8 rounded border border-muted-foreground/30 cursor-pointer disabled:cursor-not-allowed"
                                disabled={isSaving || isLoading}
                              />
                              <Input
                                type="text"
                                value={field.value}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  // Validate hex color format
                                  if (/^#[0-9A-Fa-f]{6}$/.test(value) || value === '') {
                                    field.onChange(value);
                                  }
                                }}
                                placeholder="#000000"
                                className="w-24 text-sm font-mono"
                                disabled={isSaving || isLoading}
                              />
                              <div
                                className="w-6 h-6 rounded border border-muted-foreground/30 flex-shrink-0"
                                style={{ backgroundColor: field.value }}
                              />
                            </div>
                          </div>
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="parentId"
                  render={({ field }) => {
                    const availableParents = getAvailableParents(project.id, projects).filter(p => 
                      canMoveProject(project.id, p.id, projects)
                    );
                    return (
                      <FormItem>
                        <FormLabel>Parent Project (Optional)</FormLabel>
                        <FormControl>
                          <Select 
                            value={field.value || 'NO_PARENT'} 
                            onValueChange={(value) => field.onChange(value === 'NO_PARENT' ? undefined : value)}
                            disabled={isSaving || isLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a parent project..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="NO_PARENT">No parent (top-level project)</SelectItem>
                              {availableParents.map(parentProject => (
                                <SelectItem key={parentProject.id} value={parentProject.id}>
                                  {parentProject.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    );
                  }}
                />

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteClick}
                    disabled={isSaving || isLoading}
                    className="w-full sm:w-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Project
                  </Button>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={isSaving || isLoading}
                      className="flex-1 sm:flex-none"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSaving || isLoading}
                      className="flex-1 sm:flex-none"
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </DialogFooter>
              </form>
            </Form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Delete Project</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{project.name}"? {taskWarning}
                {childProjectWarning} This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleBackToEdit}
                disabled={isDeleting}
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Edit
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
