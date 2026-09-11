import { useRef, useState } from 'react';
import React from 'react';

// @spec LINEUI-015,BLUX-001,BLUX-002,BLUX-003,GBULL-006 — one drag-source module for both the active-lineup
// table and the next-game bullpen panel; retains the dragged index because some
// browsers drop custom MIME data on drop.
export const useLineupDragSource = (mimeType: string) => {
  const draggedIndex = useRef<number | null>(null);
  const [sourceIndex, setSourceIndex] = useState<number | null>(null);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  // @spec BLUX-003 — all terminal drag paths discard purely presentational state.
  const clearDragState = () => { draggedIndex.current = null; setSourceIndex(null); setTargetIndex(null); };

  // @spec LINEUI-015,BLUX-001,BLUX-002,BLUX-003,GBULL-006 — valid slots share payload, swap, and feedback lifecycle.
  const dragProps = (index: number, editable: boolean, onSwap: (sourceIndex: number, targetIndex: number) => void) => ({
    draggable: editable || undefined,
    onDragStart: editable ? (event: React.DragEvent<HTMLDivElement>) => {
      draggedIndex.current = index;
      setSourceIndex(index);
      setTargetIndex(null);
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData(mimeType, String(index));
      event.dataTransfer.setData('text/plain', String(index));
    } : undefined,
    onDragEnd: editable ? clearDragState : undefined,
    onDragOver: editable ? (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (draggedIndex.current != null) setTargetIndex(draggedIndex.current === index ? null : index);
    } : undefined,
    onDragLeave: editable ? (event: React.DragEvent<HTMLDivElement>) => {
      if (event.currentTarget === event.target) setTargetIndex((current) => current === index ? null : current);
    } : undefined,
    onDrop: (event: React.DragEvent<HTMLDivElement>) => {
      if (!editable) return;
      event.preventDefault();
      const sourcePayload = event.dataTransfer.getData(mimeType);
      const payloadIndex = Number(sourcePayload);
      const sourceIndex = draggedIndex.current ?? (sourcePayload !== '' && Number.isInteger(payloadIndex) ? payloadIndex : null);
      clearDragState();
      if (sourceIndex != null) onSwap(sourceIndex, index);
    },
  });
  return { sourceIndex, targetIndex, dragProps, clearDragState };
};
