import { render, screen } from '@testing-library/react';
import { ArgumentBubble } from '../../features/debate/components/ArgumentBubble';

describe('[1-5] ArgumentBubble Component Unit Tests', () => {
  const defaultProps = {
    agent: 'bull' as const,
    content: 'Test argument content',
    timestamp: '2024-01-01T12:00:00Z',
  };

  describe('[P0] Critical Rendering', () => {
    test('[1-5-UNIT-001] Renders Bull argument with correct styling @p0', () => {
      render(<ArgumentBubble {...defaultProps} agent="bull" />);

      const bubble = screen.getByTestId('argument-bubble');
      expect(bubble).toBeInTheDocument();
      expect(bubble).toHaveAttribute('data-agent', 'bull');

      expect(screen.getByText(/bull/i)).toBeInTheDocument();

      expect(bubble).toHaveClass(/emerald|green/);
    });

    test('[1-5-UNIT-002] Renders Bear argument with correct styling @p0', () => {
      render(<ArgumentBubble {...defaultProps} agent="bear" />);

      const bubble = screen.getByTestId('argument-bubble');
      expect(bubble).toBeInTheDocument();
      expect(bubble).toHaveAttribute('data-agent', 'bear');

      expect(screen.getByText(/bear/i)).toBeInTheDocument();

      expect(bubble).toHaveClass(/rose|red/);
    });
  });

  describe('[P1] Visual Elements', () => {
    test('[1-5-UNIT-003] Shows agent icon and label @p1', () => {
      render(<ArgumentBubble {...defaultProps} agent="bull" />);

      const icon = screen.getByTestId('bull-icon');
      expect(icon).toBeInTheDocument();

      const label = screen.getByText(/bull|bullish/i);
      expect(label).toBeInTheDocument();
    });

    test('[1-5-UNIT-003b] Shows Bear icon and label @p1', () => {
      render(<ArgumentBubble {...defaultProps} agent="bear" />);

      const icon = screen.getByTestId('bear-icon');
      expect(icon).toBeInTheDocument();

      const label = screen.getByText(/bear|bearish/i);
      expect(label).toBeInTheDocument();
    });
  });

  describe('[P2] Formatting', () => {
    test('[1-5-UNIT-004] Formats timestamp correctly @p2', () => {
      render(<ArgumentBubble {...defaultProps} />);

      const timestamp = screen.getByTestId('argument-timestamp');
      expect(timestamp).toBeInTheDocument();

      expect(timestamp.textContent).toMatch(/\d{1,2}:\d{2}/);
    });

    test('[1-5-UNIT-004b] Displays content correctly @p2', () => {
      const longContent = 'A'.repeat(500);
      render(<ArgumentBubble {...defaultProps} content={longContent} />);

      const content = screen.getByTestId('argument-content');
      expect(content).toBeInTheDocument();
      expect(content.textContent).toBe(longContent);
    });
  });

  describe('[P2] Accessibility', () => {
    test('[1-5-UNIT-005] Has proper ARIA attributes @p2', () => {
      render(<ArgumentBubble {...defaultProps} />);

      const bubble = screen.getByTestId('argument-bubble');
      expect(bubble).toHaveAttribute('role', 'article');
    });

    test('[1-5-UNIT-005b] Icon has accessible label @p2', () => {
      render(<ArgumentBubble {...defaultProps} agent="bull" />);

      const icon = screen.getByTestId('bull-icon');
      const ariaLabel = icon.getAttribute('aria-label');
      expect(ariaLabel).toMatch(/bull|trending up/i);
    });
  });

  describe('[P3] Edge Cases', () => {
    test('[1-5-UNIT-006] Handles empty content gracefully @p3', () => {
      render(<ArgumentBubble {...defaultProps} content="" />);

      const bubble = screen.getByTestId('argument-bubble');
      expect(bubble).toBeInTheDocument();
    });

    test('[1-5-UNIT-007] Handles streaming state @p3', () => {
      render(<ArgumentBubble {...defaultProps} isStreaming={true} />);

      const cursor = screen.getByTestId('streaming-cursor');
      expect(cursor).toBeInTheDocument();
    });
  });
});
