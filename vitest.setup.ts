import '@testing-library/jest-dom/vitest'

// Mantine's useColorScheme relies on matchMedia; stub it for jsdom tests
if (!window.matchMedia) {
  window.matchMedia = ((query: string): MediaQueryList => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }
  }) as any
}

// Mantine ScrollArea and other components rely on ResizeObserver
if (typeof (window as any).ResizeObserver === 'undefined') {
  ;(window as any).ResizeObserver = class ResizeObserver {
    callback: ResizeObserverCallback
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}


