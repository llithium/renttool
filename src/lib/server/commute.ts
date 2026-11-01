import { error } from '@sveltejs/kit';

// Public providers are for light, interactive use. Reject bursts rather than queueing them.
// This guard is per server instance; larger deployments need a shared provider quota.
const lastRequest = new Map<string, number>();
export function claimProvider(provider: string) {
  const now = Date.now();
  if (now - (lastRequest.get(provider) ?? 0) < 1100)
    error(429, 'Please wait a moment and try again.');
  lastRequest.set(provider, now);
}

export async function readCommuteBody(request: Request): Promise<unknown> {
  const body = await request.text();
  if (body.length > 8000) error(413, 'Request is too large.');
  try {
    return JSON.parse(body);
  } catch {
    error(400, 'Invalid JSON.');
  }
}
