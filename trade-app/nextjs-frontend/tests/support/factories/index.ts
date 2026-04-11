import { faker } from '@faker-js/faker';

export type User = {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'analyst';
  createdAt: Date;
  isActive: boolean;
};

export type Debate = {
  id: string;
  ticker: string;
  title: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: Date;
  participants: {
    bull: { confidence: number; arguments: string[] };
    bear: { confidence: number; arguments: string[] };
    guardian: { riskLevel: 'low' | 'medium' | 'high'; warnings: string[] };
  };
};

export type Vote = {
  id: string;
  debateId: string;
  userId: string;
  side: 'bull' | 'bear' | 'neutral';
  createdAt: Date;
};

export const createUser = (overrides: Partial<User> = {}): User => ({
  id: faker.string.uuid(),
  email: faker.internet.email(),
  name: faker.person.fullName(),
  role: 'user',
  createdAt: new Date(),
  isActive: true,
  ...overrides,
});

export const createDebate = (overrides: Partial<Debate> = {}): Debate => ({
  id: faker.string.uuid(),
  ticker: faker.finance.currencyCode(),
  title: faker.company.catchPhrase(),
  status: 'pending',
  createdAt: new Date(),
  participants: {
    bull: {
      confidence: faker.number.int({ min: 50, max: 100 }),
      arguments: [],
    },
    bear: {
      confidence: faker.number.int({ min: 50, max: 100 }),
      arguments: [],
    },
    guardian: {
      riskLevel: faker.helpers.arrayElement(['low', 'medium', 'high']),
      warnings: [],
    },
  },
  ...overrides,
});

export const createVote = (overrides: Partial<Vote> = {}): Vote => ({
  id: faker.string.uuid(),
  debateId: faker.string.uuid(),
  userId: faker.string.uuid(),
  side: faker.helpers.arrayElement(['bull', 'bear', 'neutral']),
  createdAt: new Date(),
  ...overrides,
});

export const createAdminUser = (overrides: Partial<User> = {}): User =>
  createUser({ role: 'admin', ...overrides });

export const createAnalystUser = (overrides: Partial<User> = {}): User =>
  createUser({ role: 'analyst', ...overrides });

export const createActiveDebate = (overrides: Partial<Debate> = {}): Debate =>
  createDebate({ status: 'active', ...overrides });

export const createCompletedDebate = (overrides: Partial<Debate> = {}): Debate =>
  createDebate({ status: 'completed', ...overrides });

export type ArgumentMessage = {
  id: string;
  type: 'argument';
  agent: 'bull' | 'bear';
  content: string;
  timestamp: string;
  isRedacted?: boolean;
};

export type ArgumentPayload = {
  debateId: string;
  agent: 'bull' | 'bear';
  content: string;
  turn?: number;
  isRedacted?: boolean;
};

export const createArgumentMessage = (overrides: Partial<ArgumentMessage> = {}): ArgumentMessage => ({
  id: `msg-${faker.string.alphanumeric(8)}`,
  type: 'argument',
  agent: faker.helpers.arrayElement(['bull', 'bear']),
  content: faker.lorem.sentence(),
  timestamp: faker.date.recent().toISOString(),
  ...overrides,
});

export const createRedactedArgumentMessage = (overrides: Partial<ArgumentMessage> = {}): ArgumentMessage =>
  createArgumentMessage({
    content: `This is a [REDACTED] ${faker.lorem.words(3)}.`,
    isRedacted: true,
    ...overrides,
  });

export const createArgumentPayload = (overrides: Partial<ArgumentPayload> = {}): ArgumentPayload => ({
  debateId: faker.string.uuid(),
  agent: faker.helpers.arrayElement(['bull', 'bear']),
  content: faker.lorem.sentence(),
  turn: faker.number.int({ min: 1, max: 10 }),
  ...overrides,
});

export const createRedactedArgumentPayload = (overrides: Partial<ArgumentPayload> = {}): ArgumentPayload =>
  createArgumentPayload({
    content: `This is a [REDACTED] ${faker.lorem.words(3)}.`,
    isRedacted: true,
    ...overrides,
  });
