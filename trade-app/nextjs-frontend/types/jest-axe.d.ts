declare module "jest-axe" {
  import type { axe as axeCore } from "axe-core";

  interface AxeResults {
    violations: Array<{
      id: string;
      impact: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: Array<unknown>;
    }>;
    passes: Array<unknown>;
    incomplete: Array<unknown>;
    inapplicable: Array<unknown>;
  }

  function axe(
    element: Element | DocumentFragment | Node,
    options?: unknown,
  ): Promise<AxeResults>;

  const toHaveNoViolations: {
    toHaveNoViolations(results: AxeResults): {
      pass: boolean;
      message(): string;
    };
  };

  export { axe, toHaveNoViolations };
}

declare namespace jest {
  interface Matchers<R> {
    toHaveNoViolations(): R;
  }
}
