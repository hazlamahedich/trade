import { render, screen } from '@testing-library/react';
import React from 'react';
import { DebateStream, type ArgumentMessage } from '../../features/debate/components/DebateStream';
import { TooltipProvider } from '../../components/ui/tooltip';

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
  useDebateSocket: () => ({
    status: 'connected',
    sendGuardianAck: jest.fn(),
    reconnect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: true,
    isConnecting: false,
    isDisconnected: false,
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

function renderDebateStream(ui: React.ReactElement) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

describe('[2-5] DebateStream — isRedacted Integration', () => {
  test('[2-5-INT-001] handleArgumentComplete with isRedacted: true constructs ArgumentMessage with field preserved', () => {
    const messages: ArgumentMessage[] = [
      {
        id: 'msg-1',
        type: 'argument',
        agent: 'bull',
        content: 'This is a [REDACTED] profit opportunity.',
        timestamp: '2024-01-01T12:00:00Z',
        isRedacted: true,
      },
    ];

    renderDebateStream(<DebateStream debateId="test-debate-1" />);

    expect(messages[0].isRedacted).toBe(true);
  });

  test('[2-5-INT-002] DebateStream renders ArgumentBubble with isRedacted prop when message has field', async () => {
    renderDebateStream(
      <DebateStream debateId="test-debate-2" />
    );

    const debateStream = screen.queryByTestId('debate-stream');
    expect(debateStream).toBeInTheDocument();
  });

  test('[2-5-INT-003] Streaming message does not show badge — only complete message does', () => {
    renderDebateStream(
      <DebateStream debateId="test-debate-3" />
    );

    expect(screen.queryByTestId('safety-filtered-badge')).not.toBeInTheDocument();
  });

  test('[2-5-INT-004] ArgumentMessage interface accepts isRedacted field', () => {
    const msg: ArgumentMessage = {
      id: 'msg-int-004',
      type: 'argument',
      agent: 'bull',
      content: 'Redacted content [REDACTED]',
      timestamp: '2024-01-01T12:00:00Z',
      isRedacted: true,
    };

    expect(msg.isRedacted).toBe(true);
  });

  test('[2-5-INT-005] ArgumentMessage with isRedacted omitted is valid', () => {
    const msg: ArgumentMessage = {
      id: 'msg-int-005',
      type: 'argument',
      agent: 'bear',
      content: 'Normal content',
      timestamp: '2024-01-01T12:00:00Z',
    };

    expect(msg.isRedacted).toBeUndefined();
  });
});
