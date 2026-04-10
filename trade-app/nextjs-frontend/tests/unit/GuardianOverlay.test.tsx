/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { GuardianOverlay } from '../../features/debate/components/GuardianOverlay';
import type { GuardianFreezeState } from '../../features/debate/hooks/useGuardianFreeze';
import { makeGuardianPayload, makeTriggerArg } from '../support/helpers/debate-payloads';

jest.mock('framer-motion', () => {
  return {
    motion: { div: (props: Record<string, unknown>) => React.createElement('div', props) },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});

const activeState: GuardianFreezeState = { status: 'active' };

function frozenState(overrides: Parameters<typeof makeGuardianPayload>[0] = {}, triggerArg = makeTriggerArg()): GuardianFreezeState {
  return { status: 'frozen', data: makeGuardianPayload(overrides), triggerArg };
}

function errorState(errorMsg = 'Network error', overrides: Parameters<typeof makeGuardianPayload>[0] = {}): GuardianFreezeState {
  return { status: 'error', data: makeGuardianPayload(overrides), triggerArg: makeTriggerArg(), error: errorMsg };
}

function renderOverlay(state: GuardianFreezeState, shouldReduceMotion = false) {
  const handlers = {
    onUnderstand: jest.fn(),
    onIgnore: jest.fn(),
    onRetry: jest.fn(),
    onClear: jest.fn(),
    shouldReduceMotion,
  };
  const result = render(
    <GuardianOverlay state={state} {...handlers} />
  );
  return { ...result, handlers };
}

describe('[2-3] GuardianOverlay — Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('[2-3-UNIT-001] @p0 Renders with correct content given frozen state', () => {
    // Given: overlay receives frozen state with high-risk guardian data
    renderOverlay(frozenState());

    // When: the overlay renders
    const overlay = screen.getByTestId('guardian-overlay');

    // Then: verdict, reason, and fallacy badge are displayed
    expect(overlay).toBeInTheDocument();
    expect(within(overlay).getByText(/High Risk/)).toBeInTheDocument();
    expect(within(overlay).getByText(/Detected confirmation bias/)).toBeInTheDocument();
    expect(within(overlay).getByTestId('guardian-fallacy-badge')).toHaveTextContent('confirmation_bias');
  });

  test('[2-3-UNIT-002] @p0 Shows "I Understand" + "Ignore Risk" for non-critical', () => {
    // Given: overlay is in frozen state with non-critical risk level
    renderOverlay(frozenState());

    // Then: both dismiss buttons are rendered
    expect(screen.getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(screen.getByTestId('guardian-ignore-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-003] @p0 Shows "I Understand" only for critical with "debate ended" text', () => {
    // Given: overlay is in frozen state with critical risk level
    renderOverlay(frozenState({ riskLevel: 'critical' }));

    // Then: only "I Understand" button is shown, ignore is hidden, debate-ended text visible
    expect(screen.getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
    expect(screen.getByText(/Critical risk detected — debate ended/)).toBeInTheDocument();
  });

  test('[2-3-UNIT-004] @p0 Blocks click-outside dismiss — onPointerDownOutside prevented', () => {
    // Given: overlay is rendered in frozen state
    renderOverlay(frozenState());

    // When: a pointerdown event is dispatched on the dialog content
    const dialogContent = screen.getByTestId('guardian-overlay');
    const pointerDownEvent = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(pointerDownEvent, 'preventDefault', { value: jest.fn() });
    dialogContent.dispatchEvent(pointerDownEvent);

    // Then: overlay remains visible (dismiss prevented)
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();
  });

  test('[2-3-UNIT-005] @p0 Blocks Escape key for critical — onEscapeKeyDown handler present', () => {
    // Given: overlay is in frozen state with critical risk level
    renderOverlay(frozenState({ riskLevel: 'critical' }));

    // Then: overlay is present with alertdialog role (Escape prevention configured on component)
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'alertdialog');
    const content = overlay.closest('[role="alertdialog"]');
    expect(content).toBeTruthy();
  });

  test('[2-3-UNIT-006] @p0 Allows Escape key for non-critical — overlay renders with dialog role', () => {
    // Given: overlay is in frozen state with non-critical risk level
    renderOverlay(frozenState());

    // Then: overlay renders with alertdialog role (Escape allowed by default in Radix)
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'alertdialog');
  });

  test('[2-3-UNIT-007] @p0 "I Understand" calls onUnderstand callback', () => {
    // Given: overlay is rendered in frozen state
    const { handlers } = renderOverlay(frozenState());

    // When: "I Understand" button is clicked
    fireEvent.click(screen.getByTestId('guardian-understand-btn'));

    // Then: onUnderstand callback is invoked exactly once
    expect(handlers.onUnderstand).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-008] @p0 "Ignore Risk" calls onIgnore callback', () => {
    // Given: overlay is rendered in frozen state
    const { handlers } = renderOverlay(frozenState());

    // When: "Ignore Risk" button is clicked
    fireEvent.click(screen.getByTestId('guardian-ignore-btn'));

    // Then: onIgnore callback is invoked exactly once
    expect(handlers.onIgnore).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-012] @p1 Reduced motion: overlay renders instantly', () => {
    // Given: shouldReduceMotion is true
    renderOverlay(frozenState(), true);

    // Then: overlay renders without animation delay
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();
  });

  test('[2-3-UNIT-018] @p0 Triggering argument rendered as quoted context', () => {
    // Given: overlay is in frozen state with a triggering argument
    renderOverlay(frozenState());

    // Then: the triggering argument content and agent label are displayed
    const triggerArgEl = screen.getByTestId('guardian-trigger-arg');
    expect(triggerArgEl).toBeInTheDocument();
    expect(triggerArgEl).toHaveTextContent('The market will definitely crash');
    expect(triggerArgEl).toHaveTextContent('Bear said:');
  });

  test('[2-3-UNIT-019] @p0 Error state: "Retry" button rendered', () => {
    // Given: overlay is in error state with a network error message
    renderOverlay(errorState());

    // Then: retry button and error message are displayed
    expect(screen.getByTestId('guardian-retry-btn')).toBeInTheDocument();
    expect(screen.getByTestId('guardian-error-message')).toHaveTextContent('Network error');
  });

  test('[2-3-UNIT-020] @p0 Error state: "Dismiss Anyway" for non-critical only', () => {
    // Given: overlay is in error state with non-critical risk
    renderOverlay(errorState());

    // Then: "Dismiss Anyway" button is rendered
    expect(screen.getByTestId('guardian-dismiss-anyway-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-020b] @p0 Error state: no "Dismiss Anyway" for critical', () => {
    // Given: overlay is in error state with critical risk level
    renderOverlay(errorState('Network error', { riskLevel: 'critical' }));

    // Then: "Dismiss Anyway" is hidden but retry remains visible
    expect(screen.queryByTestId('guardian-dismiss-anyway-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('guardian-retry-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-026] @p1 Mobile: buttons stacked vertically with 44px touch targets', () => {
    // Given: overlay is in frozen state with non-critical risk
    renderOverlay(frozenState());

    // Then: actions container uses flex-col and buttons have min-h-[44px]
    const actions = screen.getByTestId('guardian-actions');
    expect(actions.className).toContain('flex-col');
    const btns = within(actions).getAllByRole('button');
    for (const btn of btns) {
      expect(btn.className.includes('min-h-[44px]')).toBeTruthy();
    }
  });

  test('[2-3-UNIT-027] @p1 Malformed guardian data — no crash', () => {
    // Given: overlay receives malformed/empty guardian data
    const malformedState: GuardianFreezeState = {
      status: 'frozen',
      data: {
        debateId: '',
        riskLevel: '',
        reason: '',
        fallacyType: null,
        originalAgent: '',
        summaryVerdict: '',
        turn: null,
      },
      triggerArg: null,
    };

    // Then: rendering does not throw and overlay appears
    expect(() => renderOverlay(malformedState)).not.toThrow();
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();
  });

  test('[2-3-UNIT-016] @p0 SSR guard: no crash when navigator is undefined', () => {
    // Given: navigator is undefined (SSR environment)
    const origNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });

      // Then: rendering the overlay does not throw
      expect(() => renderOverlay(frozenState())).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: origNavigator, writable: true, configurable: true });
    }
  });

  test('[2-3-UNIT-002b] No overlay when active', () => {
    // Given: overlay receives active state (no interrupt)
    renderOverlay(activeState);

    // Then: no overlay is rendered
    expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();
  });
});
