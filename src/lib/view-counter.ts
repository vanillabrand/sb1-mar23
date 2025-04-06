/**
 * Utility to track how many times a user has viewed specific UI elements
 * and determine if they should be shown or hidden based on view count.
 */

const VIEW_COUNTER_KEY = 'gigantic_view_counters';

interface ViewCounters {
  [key: string]: number;
}

/**
 * Get the current view counters from localStorage
 */
export function getViewCounters(): ViewCounters {
  try {
    const counters = localStorage.getItem(VIEW_COUNTER_KEY);
    return counters ? JSON.parse(counters) : {};
  } catch (error) {
    console.error('Failed to get view counters:', error);
    return {};
  }
}

/**
 * Increment the view counter for a specific element
 * @param elementId Unique identifier for the UI element
 * @returns The updated view count
 */
export function incrementViewCounter(elementId: string): number {
  try {
    const counters = getViewCounters();
    const currentCount = counters[elementId] || 0;
    const newCount = currentCount + 1;
    
    counters[elementId] = newCount;
    localStorage.setItem(VIEW_COUNTER_KEY, JSON.stringify(counters));
    
    return newCount;
  } catch (error) {
    console.error('Failed to increment view counter:', error);
    return 0;
  }
}

/**
 * Reset the view counter for a specific element
 * @param elementId Unique identifier for the UI element
 */
export function resetViewCounter(elementId: string): void {
  try {
    const counters = getViewCounters();
    counters[elementId] = 0;
    localStorage.setItem(VIEW_COUNTER_KEY, JSON.stringify(counters));
  } catch (error) {
    console.error('Failed to reset view counter:', error);
  }
}

/**
 * Check if an element should be shown based on its view count
 * @param elementId Unique identifier for the UI element
 * @param maxViews Maximum number of times to show the element
 * @returns True if the element should be shown, false otherwise
 */
export function shouldShowElement(elementId: string, maxViews: number): boolean {
  const counters = getViewCounters();
  const currentCount = counters[elementId] || 0;
  return currentCount < maxViews;
}
