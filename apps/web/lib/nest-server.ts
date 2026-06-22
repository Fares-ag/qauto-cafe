import type { Express } from 'express';
import { EventEmitter } from 'events';
import { createRequest, createResponse } from 'node-mocks-http';
import type { RequestOptions } from 'node-mocks-http';

let expressApp: Express | null = null;
let bootstrapPromise: Promise<Express> | null = null;

async function loadNestExpressApp(): Promise<Express> {
  if (!bootstrapPromise) {
    bootstrapPromise = import('@qauto/api/bootstrap').then((mod) => mod.createNestExpressApp());
  }
  return bootstrapPromise;
}

export async function getNestExpressApp(): Promise<Express> {
  if (!expressApp) {
    expressApp = await loadNestExpressApp();
  }
  return expressApp;
}

function buildRequestOptions(request: Request, pathSegments: string[]): RequestOptions {
  const url = new URL(request.url);
  const apiPath = `/api/v1/${pathSegments.join('/')}${url.search}`;

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return {
    method: request.method as RequestOptions['method'],
    url: apiPath,
    headers,
  };
}

export async function dispatchNestRequest(
  request: Request,
  pathSegments: string[],
): Promise<Response> {
  const app = await getNestExpressApp();
  const options = buildRequestOptions(request, pathSegments);

  const bodyBuffer =
    request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : Buffer.from(await request.arrayBuffer());

  const contentType = request.headers.get('content-type') ?? '';
  let parsedBody: unknown = bodyBuffer;
  if (bodyBuffer && contentType.includes('application/json')) {
    try {
      parsedBody = JSON.parse(bodyBuffer.toString('utf8'));
    } catch {
      parsedBody = bodyBuffer;
    }
  }

  const req = createRequest({
    ...options,
    body: parsedBody as RequestOptions['body'],
  });

  if (bodyBuffer && !req.headers['content-type'] && request.headers.get('content-type')) {
    req.headers['content-type'] = request.headers.get('content-type')!;
  }

  const res = createResponse({ eventEmitter: EventEmitter });

  await new Promise<void>((resolve, reject) => {
    res.on('finish', () => resolve());
    res.on('error', reject);
    app(req, res);
  });

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(res.getHeaders())) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => responseHeaders.append(key, String(entry)));
    } else {
      responseHeaders.set(key, String(value));
    }
  }

  const setCookies = res.getHeader('set-cookie');
  if (setCookies) {
    const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
    cookies.forEach((cookie) => responseHeaders.append('set-cookie', String(cookie)));
  }

  return new Response(res._getData(), {
    status: res.statusCode,
    headers: responseHeaders,
  });
}
