'use client';

/**
 * FlexyDND - A flexible drag and drop library
 * React hooks for drag and drop functionality
 */

import { useEffect, useRef } from 'react';
import { useFlexyDND } from './FlexyDNDProvider';
import type { DragData, DragPosition, DropZone } from './types';

interface UseDraggableOptions {
  id: string;
  type: string;
  data: any;
  onDragStart?: () => void;
  onDragEnd?: (dropped: boolean) => void;
  disabled?: boolean;
}

export function useDraggable({
  id,
  type,
  data,
  onDragStart,
  onDragEnd,
  disabled = false,
}: UseDraggableOptions) {
  const { registerDragSource } = useFlexyDND();
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (disabled || !elementRef.current) return;

    const dragData: DragData = { id, type, data };

    const unregister = registerDragSource({
      id,
      element: elementRef.current,
      dragData,
      onDragStart,
      onDragEnd,
    });

    return unregister;
  }, [id, type, data, onDragStart, onDragEnd, disabled, registerDragSource]);

  return {
    dragRef: elementRef,
    isDraggable: !disabled,
  };
}

interface UseDroppableOptions {
  id: string;
  accept: string | string[];
  onDrop?: (dragData: DragData, position: DragPosition) => void;
  onDragEnter?: (dragData: DragData) => void;
  onDragLeave?: () => void;
  onDragOver?: (dragData: DragData, position: DragPosition) => void;
  disabled?: boolean;
}

export function useDroppable({
  id,
  accept,
  onDrop,
  onDragEnter,
  onDragLeave,
  onDragOver,
  disabled = false,
}: UseDroppableOptions) {
  const { registerDropZone } = useFlexyDND();
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (disabled || !elementRef.current) return;

    const zone: DropZone = {
      id,
      type: accept,
      element: elementRef.current,
      onDrop,
      onDragEnter,
      onDragLeave,
      onDragOver,
    };

    const unregister = registerDropZone(zone);

    return unregister;
  }, [id, accept, onDrop, onDragEnter, onDragLeave, onDragOver, disabled, registerDropZone]);

  return {
    dropRef: elementRef,
    isDroppable: !disabled,
  };
}

