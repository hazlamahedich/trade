const DEFAULT_DEBATE_ID = 'test-debate-guardian-001';

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

export function argumentCompletePayload(agent: 'bull' | 'bear', turn: number) {
  return {
    type: 'DEBATE/ARGUMENT_COMPLETE',
    payload: {
      debateId: DEFAULT_DEBATE_ID,
      agent,
      content: `${agent === 'bull' ? 'Bullish' : 'Bearish'} argument for turn ${turn}.`,
      turn,
    },
    timestamp: new Date().toISOString(),
  };
}
