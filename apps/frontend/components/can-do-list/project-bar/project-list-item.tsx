'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectNode } from '@/utils/can-do-list/project-hierarchy';
import { Plus, Settings, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';

interface ProjectListItemProps {
  readonly projectNode: ProjectNode;
  readonly isSelected: boolean;
  readonly isExpanded?: boolean;
  readonly itemCount?: number;
  readonly onProjectSelect: (projectId: string) => void;
  readonly onToggleExpanded?: (projectId: string) => void;
  readonly onAddSubproject?: (parentId: string) => void;
  readonly onEditProject?: (projectNode: ProjectNode) => void;
  readonly children?: React.ReactNode;
}

export default function ProjectListItem({
  projectNode,
  isSelected,
  isExpanded = false,
  itemCount = 0,
  onProjectSelect,
  onToggleExpanded,
  onAddSubproject,
  onEditProject,
  children
}: ProjectListItemProps) {
  const hasChildren = projectNode.children.length > 0;
  const indentLevel = projectNode.level;

  return (
    <div className="relative w-full">
      <div 
        className="relative flex items-center w-full group"
        style={{ paddingLeft: indentLevel > 0 ? `${indentLevel * 16 + 8}px` : '0px' }}
      >
        {/* Expand/Collapse button for projects with children */}
        <div className="w-3 h-6 mr-1 flex items-center justify-center">
          {hasChildren && onToggleExpanded && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleExpanded(projectNode.id)}
              className="h-full w-full p-0 hover:bg-muted/50"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
        
        {/* Project button */}
        <button
          onClick={() => onProjectSelect(projectNode.id)}
          className={`flex-1 flex items-center justify-between p-2 text-left rounded-md transition-colors overflow-hidden ${
            isSelected
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted/50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {isSelected ? (
              <FolderOpen className="h-4 w-4 flex-shrink-0" />
            ) : (
              <Folder className="h-4 w-4 flex-shrink-0" />
            )}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: projectNode.color }}
            />
            <span className="truncate">{projectNode.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {itemCount > 0 && (
              <Badge variant="secondary" className="text-xs group-hover:opacity-0 transition-opacity">
                {itemCount}
              </Badge>
            )}
          </div>
        </button>
        
        {/* Actions dropdown */}
        {(onAddSubproject || onEditProject) && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onAddSubproject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onAddSubproject(projectNode.id);
                }}
                className={`h-6 w-6 p-0 ${isSelected ? 'hover:bg-primary-foreground/20' : ''}`}
                title="Add subproject"
              >
                <Plus className={`h-3 w-3 ${isSelected ? 'text-primary-foreground' : ''}`} />
              </Button>
            )}
            {onEditProject && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onEditProject(projectNode);
                }}
                className={`h-6 w-6 p-0 ${isSelected ? 'hover:bg-primary-foreground/20' : ''}`}
                title="Edit project"
              >
                <Settings className={`h-3 w-3 ${isSelected ? 'text-primary-foreground' : ''}`} />
              </Button>
            )}
          </div>
        )}
      </div>
      
      {/* Render children if expanded */}
      {hasChildren && isExpanded && children && (
        <div className="space-y-1 w-full">
          {children}
        </div>
      )}
    </div>
  );
}
