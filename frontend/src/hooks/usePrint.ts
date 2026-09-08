import { useCallback } from 'react';

export function usePrint() {
  /**
   * Trigger native browser window.print()
   */
  const triggerPrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  /**
   * Print an isolated HTML element or thermal receipt
   */
  const printElement = useCallback((elementId: string) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`Print element #${elementId} not found`);
      window.print();
      return;
    }

    window.print();
  }, []);

  return { triggerPrint, printElement };
}
