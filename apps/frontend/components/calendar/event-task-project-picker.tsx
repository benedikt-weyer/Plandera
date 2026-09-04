'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProjectDecrypted } from '@/utils/api/types';
import { Inbox } from 'lucide-react';
import { cn } from '@/lib/shadcn-utils';

interface EventTaskProjectPickerProps {
  readonly isOpen: boolean;
  readonly projects: ProjectDecrypted[];
  readonly onSelect: (projectId: string | null) => void;
  readonly onCancel: () => void;
  readonly isLoading?: boolean;
}

/** Compute depth of a project in the hierarchy (0 = top-level). */
function buildDepthMap(projects: ProjectDecrypted[]): Map<string, number> {
  const map = new Map<string, number>();

  function getDepth(id: string): number {
    if (map.has(id)) return map.get(id) ?? 0;
    const project = projects.find(p => p.id === id);
    if (!project?.parent_id) {
      map.set(id, 0);
      return 0;
    }
    const depth = 1 + getDepth(project.parent_id);
    map.set(id, depth);
    return depth;
  }

  projects.forEach(p => getDepth(p.id));
  return map;
}

/** Simple fuzzy match: all query chars appear in order in the target. */
function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

export function EventTaskProjectPicker({
  isOpen,
  projects,
  onSelect,
  onCancel,
  isLoading = false,
}: EventTaskProjectPickerProps) {
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search and focus input whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const depthMap = useMemo(() => buildDepthMap(projects), [projects]);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.order - b.order),
    [projects],
  );

  const filteredProjects = useMemo(() => {
    if (!search.trim()) return sortedProjects;
    return sortedProjects.filter(p => fuzzyMatch(search.trim(), p.name));
  }, [search, sortedProjects]);

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to project</DialogTitle>
        </DialogHeader>

        <Input
          ref={inputRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search projects…"
          className="h-9"
        />

        <div className="max-h-60 overflow-y-auto space-y-0.5 -mx-1">
          {/* Inbox option — always visible when search is empty, or when it matches */}
          {(!search.trim() || fuzzyMatch(search.trim(), 'inbox')) && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => onSelect(null)}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left',
                'hover:bg-accent hover:text-accent-foreground transition-colors',
                isLoading && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Inbox className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span>Inbox</span>
            </button>
          )}

          {/* Separator between Inbox and projects when search is empty */}
          {!search.trim() && filteredProjects.length > 0 && (
            <div className="my-1 border-t mx-3" />
          )}

          {filteredProjects.length === 0 && search.trim() && (
            <p className="px-3 py-2 text-sm text-muted-foreground">No projects found.</p>
          )}

          {filteredProjects.map(project => {
            const depth = depthMap.get(project.id) ?? 0;
            return (
              <button
                key={project.id}
                type="button"
                disabled={isLoading}
                onClick={() => onSelect(project.id)}
                className={cn(
                  'w-full flex items-center gap-2.5 py-2 pr-3 rounded-md text-sm text-left',
                  'hover:bg-accent hover:text-accent-foreground transition-colors',
                  isLoading && 'opacity-50 cursor-not-allowed',
                )}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: project.color ?? '#94a3b8' }}
                />
                <span className="truncate">{project.name}</span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
