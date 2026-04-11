import { render, screen, act } from '@testing-library/react';
import React from 'react';
import { DebateStream } from '../../features/debate/components/DebateStream';
import { TooltipProvider } from '../../components/ui/tooltip';
import { createRedactedArgumentPayload, createArgumentPayload } from '../support/factories';

let capturedSocketOptions: Record<string, unknown> = {};

jest.mock('framer-motion', () => ({
  motion: {
    div: (props: Record<string, unknown>) => React.createElement('div', props),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  useReducedMotion: () => false,
}));

jest.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 100,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 100,
        size: 100,
        key: `virtual-${i}`,
      })),
  }),
}));

jest.mock('../../features/debate/hooks/useDebateSocket', () => ({
  useDebateSocket: jest.fn((options: Record<string, unknown>) => {
    capturedSocketOptions = options;
    return {
      status: 'connected',
      sendGuardianAck: jest.fn(),
      reconnect: jest.fn(),
      disconnect: jest.fn(),
      isConnected: true,
      isConnecting: false,
      isDisconnected: false,
    };
  }),
}));

jest.mock('../../features/debate/hooks/useReasoningGraph', () => ({
  useReasoningGraph: () => ({
    nodes: [],
    edges: [],
    onNodesChange: jest.fn(),
    onEdgesChange: jest.fn(),
  }),
}));

jest.mock('../../features/debate/hooks/useGuardianFreeze', () => ({
  useGuardianFreeze: () => ({
    state: { status: 'active' },
    isFrozen: false,
    triggerFreeze: jest.fn(),
    acknowledgeFreeze: jest.fn(),
    ignoreFreeze: jest.fn(),
    retryAck: jest.fn(),
    clearFreeze: jest.fn(),
    handleDebateResumed: jest.fn(),
  }),
}));

function renderDebateStream(debateId = 'test-debate-1') {
  capturedSocketOptions = {};
  return render(
    <TooltipProvider delayDuration={0}>
      <DebateStream debateId={debateId} />
    </TooltipProvider>
  );
}

describe('[2-5] DebateStream — isRedacted Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedSocketOptions = {};
  });

  test('[2-5-INT-001] ArgumentComplete with isRedacted=true causes ArgumentBubble to render safety badge', () => {
    renderDebateStream();
    const onArgumentComplete = capturedSocketOptions.onArgumentComplete as (p: Record<string, unknown>) => void;

    act(() => {
      onArgumentComplete(createRedactedArgumentPayload({ isRedacted: true }));
    });

    expect(screen.getByTestId('safety-filtered-badge')).toBeInTheDocument();
  });

  test('[2-5-INT-002] ArgumentComplete with isRedacted=false does NOT render safety badge', () => {
    renderDebateStream();
    const onArgumentComplete = capturedSocketOptions.onArgumentComplete as (p: Record<string, unknown>) => void;

    act(() => {
      onArgumentComplete(createArgumentPayload({ isRedacted: false }));
    });

    expect(screen.queryByTestId('safety-filtered-badge')).not.toBeInTheDocument();
  });

  test('[2-5-INT-003] Streaming message does not show badge — only complete message does', () => {
    renderDebateStream();
    const onTokenReceived = capturedSocketOptions.onTokenReceived as (p: Record<string, unknown>) => void;

    act(() => {
      onTokenReceived({ agent: 'bull', token: 'Streaming text' });
    });

    expect(screen.queryByTestId('safety-filtered-badge')).not.toBeInTheDocument();
  });

  test('[2-5-INT-004] Multiple redacted arguments each render their own badge', () => {
    renderDebateStream();
    const onArgumentComplete = capturedSocketOptions.onArgumentComplete as (p: Record<string, unknown>) => void;

    act(() => {
      onArgumentComplete(createRedactedArgumentPayload({ agent: 'bull', isRedacted: true }));
    });
    act(() => {
      onArgumentComplete(createRedactedArgumentPayload({ agent: 'bear', isRedacted: true }));
    });

    const badges = screen.getAllByTestId('safety-filtered-badge');
    expect(badges.length).toBe(2);
  });

  test('[2-5-INT-005] Mixed redacted and clean arguments — only redacted ones show badge', () => {
    renderDebateStream();
    const onArgumentComplete = capturedSocketOptions.onArgumentComplete as (p: Record<string, unknown>) => void;

    act(() => {
      onArgumentComplete(createArgumentPayload({ isRedacted: false }));
    });
    act(() => {
      onArgumentComplete(createRedactedArgumentPayload({ isRedacted: true }));
    });

    const badges = screen.getAllByTestId('safety-filtered-badge');
    expect(badges.length).toBe(1);
  });

  test('[2-5-INT-006] Bear agent argument with isRedacted renders badge', () => {
    renderDebateStream();
    const onArgumentComplete = capturedSocketOptions.onArgumentComplete as (p: Record<string, unknown>) => void;

    act(() => {
      onArgumentComplete(createRedactedArgumentPayload({ agent: 'bear', isRedacted: true }));
    });

    const badge = screen.getByTestId('safety-filtered-badge');
    expect(badge).toBeInTheDocument();
  });

  test('[2-5-INT-007] ArgumentComplete without isRedacted field (undefined) does not render badge', () => {
    renderDebateStream();
    const onArgumentComplete = capturedSocketOptions.onArgumentComplete as (p: Record<string, unknown>) => void;

    act(() => {
      onArgumentComplete(createArgumentPayload());
    });

    expect(screen.queryByTestId('safety-filtered-badge')).not.toBeInTheDocument();
  });
});
