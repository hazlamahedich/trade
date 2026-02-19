import { APIRequestContext } from '@playwright/test';
import { User, createUser, Debate, createDebate } from '../factories';

export async function seedUser(
  request: APIRequestContext,
  overrides: Partial<User> = {}
): Promise<User> {
  const user = createUser(overrides);
  const apiUrl = process.env.API_URL || 'http://localhost:8000';

  const response = await request.post(`${apiUrl}/api/users`, {
    data: user,
  });

  if (!response.ok()) {
    throw new Error(`Failed to seed user: ${response.status()}`);
  }

  return user;
}

export async function seedDebate(
  request: APIRequestContext,
  overrides: Partial<Debate> = {}
): Promise<Debate> {
  const debate = createDebate(overrides);
  const apiUrl = process.env.API_URL || 'http://localhost:8000';

  const response = await request.post(`${apiUrl}/api/debates`, {
    data: debate,
  });

  if (!response.ok()) {
    throw new Error(`Failed to seed debate: ${response.status()}`);
  }

  return (await response.json()) as Debate;
}

export async function cleanupUser(request: APIRequestContext, userId: string): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:8000';
  await request.delete(`${apiUrl}/api/users/${userId}`);
}

export async function cleanupDebate(request: APIRequestContext, debateId: string): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:8000';
  await request.delete(`${apiUrl}/api/debates/${debateId}`);
}
