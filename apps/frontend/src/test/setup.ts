import "@testing-library/jest-dom/vitest";

type EventCallback = (event: MessageEvent) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  private readonly listeners = new Map<string, EventCallback[]>();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, callback: EventCallback): void {
    const next = this.listeners.get(event) ?? [];
    next.push(callback);
    this.listeners.set(event, next);
  }

  emit(event: string, payload: unknown): void {
    const callbacks = this.listeners.get(event) ?? [];
    const data = JSON.stringify(payload);
    const messageEvent = { data } as MessageEvent;
    for (const callback of callbacks) {
      callback(messageEvent);
    }
  }

  close(): void {}
}

Object.defineProperty(globalThis, "EventSource", {
  value: MockEventSource,
  writable: true
});
