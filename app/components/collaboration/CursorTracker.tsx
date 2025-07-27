'use client';

import React, { useEffect, useRef } from 'react';
import { useWebSocketContext } from '@/providers/websocket-provider';
import { cn } from '@/lib/utils';

interface CursorTrackerProps {
  documentId: string;
  containerRef: React.RefObject<HTMLElement>;
  currentPage?: number;
}

interface RemoteCursor {
  userId: string;
  userName: string;
  color: string;
  x: number;
  y: number;
  page?: number;
}

export function CursorTracker({ documentId, containerRef, currentPage = 1 }: CursorTrackerProps) {
  const { activeUsers, sendCursorPosition } = useWebSocketContext();
  const cursorsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const throttleRef = useRef<NodeJS.Timeout | null>(null);

  // Handle mouse movement
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Throttle cursor updates to avoid overwhelming the server
      if (throttleRef.current) return;

      throttleRef.current = setTimeout(() => {
        throttleRef.current = null;
        
        // Only send if position changed significantly
        const dx = Math.abs(x - lastPositionRef.current.x);
        const dy = Math.abs(y - lastPositionRef.current.y);
        
        if (dx > 5 || dy > 5) {
          lastPositionRef.current = { x, y };
          sendCursorPosition(documentId, { x, y, page: currentPage });
        }
      }, 50);
    };

    const handleMouseLeave = () => {
      // Send cursor position off-screen to hide it
      sendCursorPosition(documentId, { x: -100, y: -100, page: currentPage });
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      if (throttleRef.current) {
        clearTimeout(throttleRef.current);
      }
    };
  }, [documentId, currentPage, sendCursorPosition, containerRef]);

  // Render remote cursors
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Update or create cursors for active users
    activeUsers.forEach((user) => {
      const cursorPos = user.cursor_position;
      if (!cursorPos || cursorPos.page !== currentPage) {
        // Remove cursor if not on current page
        const cursor = cursorsRef.current.get(user.user_id);
        if (cursor) {
          cursor.style.display = 'none';
        }
        return;
      }

      let cursor = cursorsRef.current.get(user.user_id);
      
      if (!cursor) {
        // Create new cursor element
        cursor = document.createElement('div');
        cursor.className = 'absolute pointer-events-none z-50 transition-all duration-100';
        cursor.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.5 3L17 14.5L10.5 15L7 19.5L5.5 3Z" fill="${user.user_color}" stroke="white" stroke-width="1"/>
          </svg>
          <div class="absolute top-5 left-2 bg-gray-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            ${user.user_name}
          </div>
        `;
        cursor.setAttribute('data-testid', `cursor-${user.user_id}`);
        container.appendChild(cursor);
        cursorsRef.current.set(user.user_id, cursor);
      }

      // Update cursor position
      cursor.style.display = 'block';
      cursor.style.left = `${cursorPos.x}px`;
      cursor.style.top = `${cursorPos.y}px`;
    });

    // Remove cursors for users who left
    cursorsRef.current.forEach((cursor, userId) => {
      if (!activeUsers.has(userId)) {
        cursor.remove();
        cursorsRef.current.delete(userId);
      }
    });

    return () => {
      // Cleanup all cursors on unmount
      cursorsRef.current.forEach(cursor => cursor.remove());
      cursorsRef.current.clear();
    };
  }, [activeUsers, currentPage, containerRef]);

  return null; // This component doesn't render anything itself
}