import type { GuardianInterruptPayload } from '../../../features/debate/hooks/useDebateSocket';

const DEFAULT_DEBATE_ID = 'test-debate-guardian-001';

export function makeGuardianPayload(overrides: Partial<GuardianInterruptPayload> = {}): GuardianInterruptPayload {
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

export function makeTriggerArg() {
  return {
    id: 'arg-1',
    type: 'argument' as const,
    agent: 'bear' as const,
    content: 'The market will definitely crash because I feel strongly about it.',
    timestamp: '2026-04-10T12:00:00Z',
  };
}

export function guardianInterruptPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'DEBATE/GUARDIAN_INTERRUPT',
    payload: {
      debateId: DEFAULT_DEBATE_ID,
      riskLevel: 'high',
      reason: 'Detected anchoring bias in bull argument — confidence exceeds evidence.',
      fallacyType: 'anchoring_bias',
      originalAgent: 'bull',
      summaryVerdict: 'High Risk',
      turn: 2,
      ...overrides,
    },
    timestamp: new Date().toISOString(),
  };
}

export function debatePausedPayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'DEBATE/DEBATE_PAUSED',
    payload: {
      debateId: DEFAULT_DEBATE_ID,
      reason: 'Risk Guardian detected a potential cognitive bias.',
      riskLevel: 'high',
      summaryVerdict: 'High Risk',
      turn: 2,
      ...overrides,
    },
    timestamp: new Date().toISOString(),
  };
}

export function debateResumedPayload() {
  return {
    type: 'DEBATE/DEBATE_RESUMED',
    payload: {
      debateId: DEFAULT_DEBATE_ID,
      turn: 3,
    },
    timestamp: new Date().toISOString(),
  };
}

export function argumentCompletePayload(agent: 'bull' | 'bear', turn: number, overrides: Record<string, unknown> = {}) {
  return {
    type: 'DEBATE/ARGUMENT_COMPLETE',
    payload: {
      debateId: DEFAULT_DEBATE_ID,
      agent,
      content: `${agent === 'bull' ? 'Bullish' : 'Bearish'} argument for turn ${turn}.`,
      turn,
      isRedacted: false,
      ...overrides,
    },
    timestamp: new Date().toISOString(),
  };
}

export function redactedArgumentCompletePayload(agent: 'bull' | 'bear', turn: number, originalPhrase = 'guaranteed') {
  return argumentCompletePayload(agent, turn, {
    content: `This is a [REDACTED] profit opportunity with strong fundamentals.`,
    isRedacted: true,
    _originalPhrase: originalPhrase,
  });
}
