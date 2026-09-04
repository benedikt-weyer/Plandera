"use client";

import { Button } from "@/components/ui/button";
import { TaggedInput, Tag } from "@/components/ui/tagged-input";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { useState } from "react";
import { extractTaskDataFromTags } from "@/utils/can-do-list/hashtag-utils";
import { useTranslation } from "@/utils/context/LanguageContext";

interface AddTaskFormValues {
  content: string;
}

interface AddTaskFormProps {
  readonly form: UseFormReturn<{ content: string }>;
  readonly onSubmit: (values: {
    content: string;
    duration?: number;
    projectId?: string;
    impact?: number;
    urgency?: number;
    dueDate?: Date;
    myDay?: boolean;
  }) => Promise<void>;
  readonly isLoading: boolean;
  readonly projects?: { id: string; name: string }[];
}

export default function AddTaskForm({
  form,
  onSubmit,
  isLoading,
  projects = [],
}: AddTaskFormProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const { t } = useTranslation();

  const handleSubmit = async (values: AddTaskFormValues) => {
    // Extract task data from tags and content
    const taskData = extractTaskDataFromTags(values.content || "", tags);

    await onSubmit({
      content: taskData.content,
      duration: taskData.duration,
      projectId: taskData.projectId,
      impact: taskData.impact,
      urgency: taskData.urgency,
      dueDate: taskData.dueDate,
      myDay: taskData.myDay,
    });

    // Clear tags after successful submission
    setTags([]);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="mb-6">
        <div className="flex gap-2 items-start">
          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem className="flex-grow">
                <FormControl>
                  <TaggedInput
                    {...field}
                    placeholder={t("tasks.addTaskPlaceholder")}
                    disabled={isLoading}
                    tags={tags}
                    onTagsChange={setTags}
                    projects={projects}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isLoading} className="mt-0">
            Add
          </Button>
        </div>
      </form>
    </Form>
  );
}
