export type HighlightEventType = 'highlight' | 'unhighlight' | 'hover' | 'select' | 'focus';
export type HighlightSource = 'pdf' | 'content' | 'keyboard' | 'system';

export interface HighlightEvent {
  type: HighlightEventType;
  source: HighlightSource;
  targetId: string;
  multiSelect?: boolean;
  metadata?: any;
}

export interface HighlightState {
  highlighted: boolean;
  hovering?: boolean;
  source: HighlightSource;
  timestamp: number;
}

type EventHandler = (event: HighlightEvent) => void;

export class HighlightEventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private highlightState = new Map<string, HighlightState>();
  private eventQueue: HighlightEvent[] = [];
  private isProcessing = false;
  
  emit(event: HighlightEvent) {
    // Add to queue to prevent event loops
    this.eventQueue.push(event);
    
    if (!this.isProcessing) {
      this.processQueue();
    }
  }
  
  private processQueue() {
    this.isProcessing = true;
    
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift()!;
      
      // Update internal state
      this.updateHighlightState(event);
      
      // Notify listeners
      const handlers = this.listeners.get(event.type) || new Set();
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error('Error in highlight event handler:', error);
        }
      });
    }
    
    this.isProcessing = false;
  }
  
  on(eventType: HighlightEventType, handler: EventHandler): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(handler);
    };
  }
  
  private updateHighlightState(event: HighlightEvent) {
    const { type, targetId, multiSelect } = event;
    
    switch (type) {
      case 'highlight':
        if (!multiSelect) {
          // Clear existing highlights
          this.highlightState.clear();
        }
        this.highlightState.set(targetId, {
          highlighted: true,
          source: event.source,
          timestamp: Date.now()
        });
        break;
        
      case 'unhighlight':
        this.highlightState.delete(targetId);
        break;
        
      case 'hover':
        // Clear other hovers
        this.highlightState.forEach((state, id) => {
          if (state.hovering && id !== targetId) {
            state.hovering = false;
          }
        });
        
        // Set new hover
        const existingState = this.highlightState.get(targetId);
        if (existingState) {
          existingState.hovering = true;
        } else {
          this.highlightState.set(targetId, {
            highlighted: false,
            hovering: true,
            source: event.source,
            timestamp: Date.now()
          });
        }
        break;
    }
  }
  
  getHighlightedItems(): string[] {
    return Array.from(this.highlightState.entries())
      .filter(([_, state]) => state.highlighted)
      .map(([id]) => id);
  }
  
  getHoveredItem(): string | null {
    const hovered = Array.from(this.highlightState.entries())
      .find(([_, state]) => state.hovering);
    return hovered ? hovered[0] : null;
  }
  
  isHighlighted(targetId: string): boolean {
    const state = this.highlightState.get(targetId);
    return state?.highlighted || false;
  }
  
  isHovered(targetId: string): boolean {
    const state = this.highlightState.get(targetId);
    return state?.hovering || false;
  }
  
  clearAll() {
    this.highlightState.clear();
    this.emit({
      type: 'unhighlight',
      source: 'system',
      targetId: '*'
    });
  }
  
  getState(targetId: string): HighlightState | undefined {
    return this.highlightState.get(targetId);
  }
}

// Singleton instance
export const highlightEventBus = new HighlightEventBus();