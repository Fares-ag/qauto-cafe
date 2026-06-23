import { dispatchNestRequest } from '@/lib/nest-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RouteContext = { params: Promise<{ path: string[] }> };

async function handle(request: Request, context: RouteContext) {
  try {
    const { path } = await context.params;
    return await dispatchNestRequest(request, path);
  } catch (error) {
    console.error('API bootstrap or dispatch failed:', error);
    return Response.json(
      {
        type: 'server_error',
        title: 'API unavailable',
        status: 503,
        detail:
          'The server could not start. Check production environment variables (JWT secrets, CORS_ORIGIN, Supabase).',
      },
      { status: 503 },
    );
  }
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
