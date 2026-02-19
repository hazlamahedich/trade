import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '../../features/debate/components/TypingIndicator';

describe('[1-5] TypingIndicator Component Unit Tests', () => {
  const defaultProps = {
    agent: 'bull' as const,
    isVisible: true,
  };

  describe('[P0] Critical Rendering', () => {
    test('[1-5-UNIT-005] Shows typing indicator with agent name @p0', () => {
      render(<TypingIndicator {...defaultProps} />);

      const indicator = screen.getByTestId('typing-indicator');
      expect(indicator).toBeInTheDocument();

      expect(screen.getByText(/bull.*thinking|analyzing/i)).toBeInTheDocument();
    });

    test('[1-5-UNIT-005b] Shows Bear agent in indicator @p0', () => {
      render(<TypingIndicator {...defaultProps} agent="bear" />);

      expect(screen.getByText(/bear.*thinking|analyzing/i)).toBeInTheDocument();
    });
  });

  describe('[P1] Visibility', () => {
    test('[1-5-UNIT-006] Hides when isVisible is false @p1', () => {
      render(<TypingIndicator {...defaultProps} isVisible={false} />);

      const indicator = screen.queryByTestId('typing-indicator');
      expect(indicator).not.toBeInTheDocument();
    });

    test('[1-5-UNIT-006b] Shows when isVisible is true @p1', () => {
      render(<TypingIndicator {...defaultProps} isVisible={true} />);

      const indicator = screen.getByTestId('typing-indicator');
      expect(indicator).toBeVisible();
    });
  });

  describe('[P2] Animation', () => {
    test('[1-5-UNIT-007] Animation plays when visible @p2', () => {
      render(<TypingIndicator {...defaultProps} />);

      const dots = screen.getByTestId('typing-dots');
      expect(dots).toBeInTheDocument();

      expect(dots).toHaveClass(/animate/);
    });

    test('[1-5-UNIT-007b] Respects prefers-reduced-motion @p2 @accessibility', () => {
      render(<TypingIndicator {...defaultProps} />);

      const dots = screen.getByTestId('typing-dots');
      expect(dots).toHaveClass('motion-safe:animate-pulse');
    });
  });

  describe('[P2] Accessibility', () => {
    test('[1-5-UNIT-008] Has aria-live for screen readers @p2 @accessibility', () => {
      render(<TypingIndicator {...defaultProps} />);

      const indicator = screen.getByTestId('typing-indicator');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    test('[1-5-UNIT-008b] Has accessible label @p2 @accessibility', () => {
      render(<TypingIndicator {...defaultProps} agent="bull" />);

      const indicator = screen.getByTestId('typing-indicator');
      const ariaLabel = indicator.getAttribute('aria-label');
      expect(ariaLabel).toMatch(/bull.*thinking|typing/i);
    });
  });

  describe('[P3] Edge Cases', () => {
    test('[1-5-UNIT-009] Handles null agent gracefully @p3', () => {
      render(<TypingIndicator agent={null as unknown as 'bull'} isVisible={true} />);

      const indicator = screen.getByTestId('typing-indicator');
      expect(indicator).toBeInTheDocument();
    });

    test('[1-5-UNIT-010] Custom message override @p3', () => {
      render(
        <TypingIndicator
          {...defaultProps}
          message="Custom analyzing message"
        />
      );

      expect(screen.getByText(/custom analyzing message/i)).toBeInTheDocument();
    });
  });
});
