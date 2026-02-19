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
