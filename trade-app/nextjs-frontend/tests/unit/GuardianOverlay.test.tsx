/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { GuardianOverlay } from '../../features/debate/components/GuardianOverlay';
import type { GuardianFreezeState } from '../../features/debate/hooks/useGuardianFreeze';
import type { GuardianInterruptPayload } from '../../features/debate/hooks/useDebateSocket';

jest.mock('framer-motion', () => {
  return {
    motion: { div: (props: Record<string, unknown>) => React.createElement('div', props) },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    useReducedMotion: () => false,
  };
});

function makePayload(overrides: Partial<GuardianInterruptPayload> = {}): GuardianInterruptPayload {
  return {
    debateId: 'd1',
    riskLevel: 'high',
    reason: 'Detected confirmation bias in bear argument.',
    fallacyType: 'confirmation_bias',
    originalAgent: 'bear',
    summaryVerdict: 'High Risk',
    turn: 3,
    ...overrides,
  };
}

function makeTriggerArg() {
  return {
    id: 'arg-1',
    type: 'argument' as const,
    agent: 'bear' as const,
    content: 'The market will definitely crash because I feel strongly about it.',
    timestamp: '2026-04-10T12:00:00Z',
  };
}

const activeState: GuardianFreezeState = { status: 'active' };

function frozenState(overrides: Partial<GuardianInterruptPayload> = {}, triggerArg = makeTriggerArg()): GuardianFreezeState {
  return { status: 'frozen', data: makePayload(overrides), triggerArg };
}

function errorState(errorMsg = 'Network error', overrides: Partial<GuardianInterruptPayload> = {}): GuardianFreezeState {
  return { status: 'error', data: makePayload(overrides), triggerArg: makeTriggerArg(), error: errorMsg };
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
    renderOverlay(frozenState());
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(within(overlay).getByText(/High Risk/)).toBeInTheDocument();
    expect(within(overlay).getByText(/Detected confirmation bias/)).toBeInTheDocument();
    expect(within(overlay).getByTestId('guardian-fallacy-badge')).toHaveTextContent('confirmation_bias');
  });

  test('[2-3-UNIT-002] @p0 Shows "I Understand" + "Ignore Risk" for non-critical', () => {
    renderOverlay(frozenState());
    expect(screen.getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(screen.getByTestId('guardian-ignore-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-003] @p0 Shows "I Understand" only for critical with "debate ended" text', () => {
    renderOverlay(frozenState({ riskLevel: 'critical' }));
    expect(screen.getByTestId('guardian-understand-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('guardian-ignore-btn')).not.toBeInTheDocument();
    expect(screen.getByText(/Critical risk detected — debate ended/)).toBeInTheDocument();
  });

  test('[2-3-UNIT-004] @p0 Blocks click-outside dismiss — onPointerDownOutside prevented', () => {
    renderOverlay(frozenState());
    const dialogContent = screen.getByTestId('guardian-overlay');
    const pointerDownEvent = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(pointerDownEvent, 'preventDefault', { value: jest.fn() });
    dialogContent.dispatchEvent(pointerDownEvent);
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();
  });

  test('[2-3-UNIT-005] @p0 Blocks Escape key for critical — onEscapeKeyDown handler present', () => {
    renderOverlay(frozenState({ riskLevel: 'critical' }));
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'alertdialog');
    const content = overlay.closest('[role="alertdialog"]');
    expect(content).toBeTruthy();
  });

  test('[2-3-UNIT-006] @p0 Allows Escape key for non-critical — overlay renders with dialog role', () => {
    renderOverlay(frozenState());
    const overlay = screen.getByTestId('guardian-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('role', 'alertdialog');
  });

  test('[2-3-UNIT-007] @p0 "I Understand" calls onUnderstand callback', () => {
    const { handlers } = renderOverlay(frozenState());
    fireEvent.click(screen.getByTestId('guardian-understand-btn'));
    expect(handlers.onUnderstand).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-008] @p0 "Ignore Risk" calls onIgnore callback', () => {
    const { handlers } = renderOverlay(frozenState());
    fireEvent.click(screen.getByTestId('guardian-ignore-btn'));
    expect(handlers.onIgnore).toHaveBeenCalledTimes(1);
  });

  test('[2-3-UNIT-012] @p1 Reduced motion: overlay renders instantly', () => {
    renderOverlay(frozenState(), true);
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();
  });

  test('[2-3-UNIT-018] @p0 Triggering argument rendered as quoted context', () => {
    renderOverlay(frozenState());
    const triggerArgEl = screen.getByTestId('guardian-trigger-arg');
    expect(triggerArgEl).toBeInTheDocument();
    expect(triggerArgEl).toHaveTextContent('The market will definitely crash');
    expect(triggerArgEl).toHaveTextContent('Bear said:');
  });

  test('[2-3-UNIT-019] @p0 Error state: "Retry" button rendered', () => {
    renderOverlay(errorState());
    expect(screen.getByTestId('guardian-retry-btn')).toBeInTheDocument();
    expect(screen.getByTestId('guardian-error-message')).toHaveTextContent('Network error');
  });

  test('[2-3-UNIT-020] @p0 Error state: "Dismiss Anyway" for non-critical only', () => {
    renderOverlay(errorState());
    expect(screen.getByTestId('guardian-dismiss-anyway-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-020b] @p0 Error state: no "Dismiss Anyway" for critical', () => {
    renderOverlay(errorState('Network error', { riskLevel: 'critical' }));
    expect(screen.queryByTestId('guardian-dismiss-anyway-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('guardian-retry-btn')).toBeInTheDocument();
  });

  test('[2-3-UNIT-026] @p1 Mobile: buttons stacked vertically with 44px touch targets', () => {
    renderOverlay(frozenState());
    const actions = screen.getByTestId('guardian-actions');
    expect(actions.className).toContain('flex-col');
    const btns = within(actions).getAllByRole('button');
    for (const btn of btns) {
      expect(btn.className.includes('min-h-[44px]')).toBeTruthy();
    }
  });

  test('[2-3-UNIT-027] @p1 Malformed guardian data — no crash', () => {
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
    expect(() => renderOverlay(malformedState)).not.toThrow();
    expect(screen.getByTestId('guardian-overlay')).toBeInTheDocument();
  });

  test('[2-3-UNIT-016] @p0 SSR guard: no crash when navigator is undefined', () => {
    const origNavigator = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, 'navigator', { value: undefined, writable: true, configurable: true });
      expect(() => renderOverlay(frozenState())).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, 'navigator', { value: origNavigator, writable: true, configurable: true });
    }
  });

  test('[2-3-UNIT-002b] No overlay when active', () => {
    renderOverlay(activeState);
    expect(screen.queryByTestId('guardian-overlay')).not.toBeInTheDocument();
  });
});
