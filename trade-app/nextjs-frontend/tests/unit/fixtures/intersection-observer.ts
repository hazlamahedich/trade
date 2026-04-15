type IntersectionObserverInstance = {
  callback: IntersectionObserverCallback;
  observe: jest.Mock;
  disconnect: jest.Mock;
};

export function createIntersectionObserverFixture() {
  const MockIO = jest.fn((callback: IntersectionObserverCallback) => ({
    callback,
    observe: jest.fn(),
    disconnect: jest.fn(),
  }));

  (window.IntersectionObserver as unknown) = MockIO;

  return {
    MockIO,
    getLastInstance: (): IntersectionObserverInstance => {
      const calls = MockIO.mock.results;
      return calls.length > 0 ? calls[calls.length - 1].value : null;
    },
  };
}
