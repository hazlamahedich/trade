import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { ArgumentBubble } from '../../features/debate/components/ArgumentBubble';
import { TooltipProvider } from '../../components/ui/tooltip';

jest.mock('framer-motion', () => ({
  motion: { div: (props: Record<string, unknown>) => React.createElement('div', props) },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useReducedMotion: () => false,
}));

function renderWithProvider(ui: React.ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

const defaultProps = {
  agent: 'bull' as const,
  content: 'This is a test argument.',
  timestamp: '2024-01-01T12:00:00Z',
};

const redactedContent = 'This is a [REDACTED] profit opportunity with strong fundamentals.';

describe('[2-5] ArgumentBubble — Safety Filtered Badge', () => {
  describe('[P0] Badge Rendering', () => {
    test('[2-5-COMP-001] isRedacted={true} renders "Safety Filtered" indicator with shield icon below content', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} content={redactedContent} />
      );

      const badge = screen.getByTestId('safety-filtered-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toContain('Safety Filtered');

      const svg = badge.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    test('[2-5-COMP-002] isRedacted={false} does NOT render indicator', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={false} />
      );

      expect(screen.queryByTestId('safety-filtered-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('safety-filtered-mobile')).not.toBeInTheDocument();
    });

    test('[2-5-COMP-003] No isRedacted prop (undefined) does NOT render indicator — backward compat', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} />
      );

      expect(screen.queryByTestId('safety-filtered-badge')).not.toBeInTheDocument();
      expect(screen.queryByTestId('safety-filtered-mobile')).not.toBeInTheDocument();
    });

    test('[2-5-COMP-010] isRedacted={true} but content without [REDACTED] renders badge without inline spans', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} content="Normal content with no redacted tokens" />
      );

      const badge = screen.getByTestId('safety-filtered-badge');
      expect(badge).toBeInTheDocument();

      const contentDiv = screen.getByTestId('argument-content');
      expect(contentDiv.textContent).not.toContain('[REDACTED]');
      expect(contentDiv).not.toHaveAttribute('role', 'text');
    });
  });

  describe('[P0] Accessibility', () => {
    test('[2-5-COMP-004] Badge has aria-label for screen readers, no role="status"', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} />
      );

      const badge = screen.getByTestId('safety-filtered-badge');
      expect(badge).toHaveAttribute('aria-label', 'This message was filtered by the safety system');
      expect(badge).not.toHaveAttribute('role', 'status');
    });
  });

  describe('[P0] Tooltip Behavior (Desktop)', () => {
    test('[2-5-COMP-005] Focusing badge shows tooltip with correct text', async () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} content="No redacted tokens here" />
      );

      const badge = screen.getByTestId('safety-filtered-badge');
      fireEvent.focus(badge);

      const tooltipElements = await screen.findAllByText('Part of this message was removed by our safety system.');
      expect(tooltipElements.length).toBeGreaterThanOrEqual(1);
    });

    test('[2-5-COMP-007] Tooltip dismisses on Escape key press', async () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} content="No redacted tokens here" />
      );

      const badge = screen.getByTestId('safety-filtered-badge');
      fireEvent.focus(badge);

      const tooltipElements = await screen.findAllByText('Part of this message was removed by our safety system.');
      expect(tooltipElements.length).toBeGreaterThanOrEqual(1);

      fireEvent.keyDown(badge, { key: 'Escape' });

      await screen.findByTestId('safety-filtered-mobile');
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('[P0] Mobile Inline Explanation', () => {
    test('[2-5-COMP-006] Mobile inline explanation text is present in DOM', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} />
      );

      const mobileEl = screen.getByTestId('safety-filtered-mobile');
      expect(mobileEl).toBeInTheDocument();
      expect(mobileEl.textContent).toContain('Part of this message was removed by our safety system');
      expect(mobileEl.textContent).toContain('Safety Filtered');
    });
  });

  describe('[P1] Keyboard and Focus', () => {
    test('[2-5-COMP-008] Badge is keyboard focusable with tabIndex', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} />
      );

      const badge = screen.getByTestId('safety-filtered-badge');
      expect(badge).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('[P0] Existing Redacted Content Unaffected', () => {
    test('[2-5-COMP-009] renderContent still uses string detection for [REDACTED] spans', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} content={redactedContent} />
      );

      const redactedSpan = screen.getByLabelText('filtered phrase removed for safety compliance');
      expect(redactedSpan).toBeInTheDocument();
      expect(redactedSpan.textContent).toBe('[REDACTED]');
    });
  });

  describe('[P1] Badge Placement', () => {
    test('[2-5-COMP-011] Indicator does NOT appear in the agent name/timestamp header row', () => {
      renderWithProvider(
        <ArgumentBubble {...defaultProps} isRedacted={true} />
      );

      const badge = screen.getByTestId('safety-filtered-badge');
      const badgeContainer = badge.closest('[data-testid="argument-bubble"]');

      const contentDiv = screen.getByTestId('argument-content');
      const contentParent = contentDiv.parentElement;

      if (badgeContainer && contentParent) {
        const allText = badgeContainer.textContent || '';
        expect(allText).toContain('Safety Filtered');
        expect(allText).toContain('Bull');

        const headerArea = contentParent.querySelector('.flex.items-center.gap-2.mb-1');
        if (headerArea) {
          expect(headerArea.textContent).not.toContain('Safety Filtered');
        }
      }
    });
  });
});
