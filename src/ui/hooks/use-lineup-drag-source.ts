import { useRef } from 'react';
import React from 'react';

// @spec LINEUI-015,GBULL-006 — one drag-source module for both the active-lineup
// table and the next-game bullpen panel; retains the dragged index because some
// browsers drop custom MIME data on drop.
export const useLineupDragSource = (mimeType: string) => {
  const draggedIndex = useRef<number | null>(null);

  return (index: number, editable: boolean, onSwap: (sourceIndex: number, targetIndex: number) => void) => ({
    draggable: editable || undefined,
    onDragStart: editable ? (event: React.DragEvent<HTMLDivElement>) => {
      draggedIndex.current = index;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(mimeType, String(index));
      event.dataTransfer.setData('text/plain', String(index));
    } : undefined,
    onDragEnd: editable ? () => { draggedIndex.current = null; } : undefined,
    onDragOver: editable ? (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    } : undefined,
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      if (!editable) return;
      event.preventDefault();
      const sourcePayload = event.dataTransfer.getData(mimeType);
      const payloadIndex = Number(sourcePayload);
      const sourceIndex = draggedIndex.current ?? (sourcePayload !== '' && Number.isInteger(payloadIndex) ? payloadIndex : null);
      draggedIndex.current = null;
      if (sourceIndex != null) onSwap(sourceIndex, index);
    },
  });
};
