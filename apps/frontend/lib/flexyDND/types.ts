/**
 * FlexyDND - A flexible drag and drop library
 * Types and interfaces
 */

export interface DragPosition {
  x: number;
  y: number;
}

export interface DragData {
  id: string;
  type: string;
  data: any;
}

export interface DropZone {
  id: string;
  type: string | string[];
  element: HTMLElement;
  onDrop?: (dragData: DragData, position: DragPosition) => void;
  onDragEnter?: (dragData: DragData) => void;
  onDragLeave?: () => void;
  onDragOver?: (dragData: DragData, position: DragPosition) => void;
}

export interface DragSource {
  id: string;
  element: HTMLElement;
  dragData: DragData;
  onDragStart?: () => void;
  onDragEnd?: (dropped: boolean) => void;
}

export interface FlexyDNDContextValue {
  registerDragSource: (source: DragSource) => () => void;
  registerDropZone: (zone: DropZone) => () => void;
  isDragging: boolean;
  currentDragData: DragData | null;
  dragPosition: DragPosition | null;
}

