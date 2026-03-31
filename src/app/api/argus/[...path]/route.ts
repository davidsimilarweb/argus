import { NextRequest, NextResponse } from 'next/server';

const PROD_TARGET = process.env.ARGUS_PROD_TARGET || 'https://ios-sdk-server.42matters.com';
const STAGING_TARGET = process.env.ARGUS_STAGING_TARGET || 'https://ios-sdk-server-staging.42matters.com';
const PROD_TOKEN = process.env.ARGUS_PROD_TOKEN || '';
const STAGING_TOKEN = process.env.ARGUS_STAGING_TOKEN || '';

function pickEnv(req: NextRequest): { target: string; token: string } {
  const isStaging = req.headers.get('x-argus-env') === 'staging';
  return isStaging
    ? { target: STAGING_TARGET, token: STAGING_TOKEN }
    : { target: PROD_TARGET, token: PROD_TOKEN };
}

async function proxyRequest(req: NextRequest, params: { path: string[] }): Promise<NextResponse> {
  const { path } = await Promise.resolve(params);
  const { target, token } = pickEnv(req);
  const url = `${target}/argus/${path.join('/')}${req.nextUrl.search}`;

  const headers: Record<string, string> = {
    'Content-Type': req.headers.get('content-type') || 'application/json',
    'X-Token': token,
  };

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined;

  const upstream = await fetch(url, { method: req.method, headers, body });
  const data = await upstream.text();
  return new NextResponse(data, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
  });
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await context.params);
}
export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await context.params);
}
export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await context.params);
}
export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await context.params);
}
export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxyRequest(req, await context.params);
}
