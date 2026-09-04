'use client';

/**
 * FlexyDND - A flexible drag and drop library
 * Context Provider
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { DragData, DragPosition, DragSource, DropZone, FlexyDNDContextValue } from './types';

const FlexyDNDContext = createContext<FlexyDNDContextValue | null>(null);

interface FlexyDNDProviderProps {
  children: React.ReactNode;
}

export function FlexyDNDProvider({ children }: FlexyDNDProviderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [currentDragData, setCurrentDragData] = useState<DragData | null>(null);
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null);
  
  const dragSourcesRef = useRef<Map<string, DragSource>>(new Map());
  const dropZonesRef = useRef<Map<string, DropZone>>(new Map());
  const currentDragSourceRef = useRef<DragSource | null>(null);
  const currentDropZoneRef = useRef<DropZone | null>(null);

  // Register a drag source
  const registerDragSource = useCallback((source: DragSource) => {
    dragSourcesRef.current.set(source.id, source);

    const handleMouseDown = (e: MouseEvent) => {
      // Only left click
      if (e.button !== 0) return;
      
      // Start tracking for potential drag
      const startX = e.clientX;
      const startY = e.clientY;
      let hasMoved = false;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = Math.abs(moveEvent.clientX - startX);
        const deltaY = Math.abs(moveEvent.clientY - startY);
        
        // Require 5px movement to start drag
        if (!hasMoved && (deltaX > 5 || deltaY > 5)) {
          hasMoved = true;
          startDrag(source, moveEvent);
        }
        
        if (hasMoved) {
          updateDragPosition(moveEvent);
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

    source.element.addEventListener('mousedown', handleMouseDown);

    // Cleanup function
    return () => {
      dragSourcesRef.current.delete(source.id);
      source.element.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  // Register a drop zone
  const registerDropZone = useCallback((zone: DropZone) => {
    dropZonesRef.current.set(zone.id, zone);

    // Cleanup function
    return () => {
      dropZonesRef.current.delete(zone.id);
    };
  }, []);

  // Start dragging
  const startDrag = (source: DragSource, event: MouseEvent) => {
    currentDragSourceRef.current = source;
    setIsDragging(true);
    setCurrentDragData(source.dragData);
    setDragPosition({ x: event.clientX, y: event.clientY });
    
    if (source.onDragStart) {
      source.onDragStart();
    }

    // Add global mouse handlers
    const handleMouseMove = (e: MouseEvent) => {
      updateDragPosition(e);
      checkDropZones(e);
    };

    const handleMouseUp = (e: MouseEvent) => {
      endDrag(e);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  };

  // Update drag position and notify current drop zone
  const updateDragPosition = (event: MouseEvent) => {
    setDragPosition({ x: event.clientX, y: event.clientY });
  };

  // Check which drop zone we're over
  const checkDropZones = (event: MouseEvent) => {
    if (!currentDragSourceRef.current) return;

    const dragData = currentDragSourceRef.current.dragData;
    let foundZone: DropZone | null = null;

    // Find drop zone under cursor
    dropZonesRef.current.forEach((zone) => {
      const rect = zone.element.getBoundingClientRect();
      const isOver = 
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (isOver) {
        // Check if drag type matches drop zone type
        const acceptedTypes: string[] = Array.isArray(zone.type) ? zone.type : [zone.type];
        if (acceptedTypes.includes(dragData.type)) {
          foundZone = zone;
        }
      }
    });

    // Store foundZone in a const to help TypeScript with type narrowing
    const currentZone: DropZone | null = foundZone;

    // Handle zone changes
    const previousZone = currentDropZoneRef.current;
    if (currentZone !== previousZone) {
      // Leave old zone
      if (previousZone?.onDragLeave) {
        previousZone.onDragLeave();
      }
      
      // Enter new zone
      if (currentZone) {
        const zone = currentZone as DropZone;
        if (zone.onDragEnter) {
          zone.onDragEnter(dragData);
        }
      }
      
      currentDropZoneRef.current = currentZone;
    }

    // Notify current zone of drag over
    if (currentZone) {
      const zone = currentZone as DropZone;
      if (zone.onDragOver) {
        const position = { x: event.clientX, y: event.clientY };
        zone.onDragOver(dragData, position);
      }
    }
  };

  // End dragging
  const endDrag = (event: MouseEvent) => {
    const source = currentDragSourceRef.current;
    const zone = currentDropZoneRef.current;
    let dropped = false;

    if (source && zone) {
      // Check if we're still over the drop zone
      const rect = zone.element.getBoundingClientRect();
      const isOver = 
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;

      if (isOver && zone.onDrop) {
        const position = { x: event.clientX, y: event.clientY };
        zone.onDrop(source.dragData, position);
        dropped = true;
      }

      // Leave drop zone
      if (zone.onDragLeave) {
        zone.onDragLeave();
      }
    }

    // Notify drag source
    if (source?.onDragEnd) {
      source.onDragEnd(dropped);
    }

    // Reset state
    setIsDragging(false);
    setCurrentDragData(null);
    setDragPosition(null);
    currentDragSourceRef.current = null;
    currentDropZoneRef.current = null;
    
    // Restore text selection
    document.body.style.userSelect = '';
  };

  const value: FlexyDNDContextValue = {
    registerDragSource,
    registerDropZone,
    isDragging,
    currentDragData,
    dragPosition,
  };

  return (
    <FlexyDNDContext.Provider value={value}>
      {children}
    </FlexyDNDContext.Provider>
  );
}

export function useFlexyDND() {
  const context = useContext(FlexyDNDContext);
  if (!context) {
    throw new Error('useFlexyDND must be used within FlexyDNDProvider');
  }
  return context;
}

