/** Ignore late language-client callbacks after their output channel is disposed. */
export function guardOutputChannel<T extends { dispose(): void }>(channel: T): T {
  let disposed = false;
  return new Proxy(channel, {
    get(target, key) {
      if (key === 'dispose') {
        return () => {
          if (!disposed) {
            disposed = true;
            target.dispose();
          }
        };
      }
      const value = Reflect.get(target, key, target);
      if (typeof value !== 'function') {
        return value;
      }
      return (...args: unknown[]) => {
        if (!disposed) {
          try {
            return Reflect.apply(value, target, args);
          } catch (error) {
            // VS Code can close a channel independently of this wrapper.
            if (error instanceof Error && error.message === 'Channel has been closed') {
              disposed = true;
              return;
            }
            throw error;
          }
        }
      };
    },
  });
}
