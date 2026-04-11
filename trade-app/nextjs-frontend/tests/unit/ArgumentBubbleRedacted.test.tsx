import { render, screen } from '@testing-library/react';
import { ArgumentBubble } from '../../features/debate/components/ArgumentBubble';

describe('[2-4] ArgumentBubble — Redacted Content Display', () => {
  const defaultProps = {
    agent: 'bull' as const,
    content: 'This is a test argument.',
    timestamp: '2024-01-01T12:00:00Z',
  };

  describe('[P0] Redacted Content Rendering', () => {
    test('[2-4-COMP-001] Renders [REDACTED] text in content @p0', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="This is a [REDACTED] profit opportunity with strong fundamentals."
        />
      );

      const content = screen.getByTestId('argument-content');
      expect(content).toBeInTheDocument();
      expect(content.textContent).toContain('[REDACTED]');
    });

    test('[2-4-COMP-002] Renders multiple [REDACTED] markers @p0', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="This is [REDACTED] and [REDACTED] investment."
        />
      );

      const content = screen.getByTestId('argument-content');
      expect(content.textContent).toMatch(/\[REDACTED\].*\[REDACTED\]/);
    });

    test('[2-4-COMP-003] Renders content that is entirely [REDACTED] @p0', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="[REDACTED]"
        />
      );

      const content = screen.getByTestId('argument-content');
      expect(content.textContent).toBe('[REDACTED]');
    });
  });

  describe('[P1] Agent Context for Redacted Content', () => {
    test('[2-4-COMP-004] Bull redacted content still shows bull styling @p1', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          agent="bull"
          content="This is a [REDACTED] profit opportunity."
        />
      );

      const bubble = screen.getByTestId('argument-bubble');
      expect(bubble).toHaveAttribute('data-agent', 'bull');
      expect(screen.getByTestId('bull-icon')).toBeInTheDocument();
    });

    test('[2-4-COMP-005] Bear redacted content still shows bear styling @p1', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          agent="bear"
          content="This is a [REDACTED] downside scenario."
        />
      );

      const bubble = screen.getByTestId('argument-bubble');
      expect(bubble).toHaveAttribute('data-agent', 'bear');
      expect(screen.getByTestId('bear-icon')).toBeInTheDocument();
    });
  });

  describe('[P2] Accessibility for Redacted Content', () => {
    test('[2-4-COMP-006] Redacted content bubble has proper ARIA role @p2', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="This is [REDACTED] investment advice."
        />
      );

      const bubble = screen.getByTestId('argument-bubble');
      expect(bubble).toHaveAttribute('role', 'article');
    });

    test('[2-4-COMP-007] Redacted spans have ARIA label for screen readers @p2', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="This is [REDACTED] investment advice."
        />
      );

      const redactedSpan = screen.getByLabelText('filtered phrase removed for safety compliance');
      expect(redactedSpan).toBeInTheDocument();
    });

    test('[2-4-COMP-008] Redacted spans have purple styling @p2', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="This is [REDACTED] investment advice."
        />
      );

      const redactedSpan = screen.getByLabelText('filtered phrase removed for safety compliance');
      expect(redactedSpan.className).toContain('bg-purple-500/20');
      expect(redactedSpan.className).toContain('border-purple-500/30');
    });

    test('[2-4-COMP-009] Content container has ARIA label when redacted @p2', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="This is [REDACTED] investment advice."
        />
      );

      const content = screen.getByTestId('argument-content');
      expect(content).toHaveAttribute('role', 'text');
      expect(content).toHaveAttribute('aria-label', 'Debate argument containing filtered phrases for safety compliance');
    });

    test('[2-4-COMP-010] Non-redacted content has no extra ARIA @p2', () => {
      render(
        <ArgumentBubble
          {...defaultProps}
          content="Bitcoin may rise based on fundamentals."
        />
      );

      const content = screen.getByTestId('argument-content');
      expect(content).not.toHaveAttribute('role');
      expect(content).not.toHaveAttribute('aria-label');
    });
  });
});
