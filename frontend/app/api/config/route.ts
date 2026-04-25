import { NextRequest, NextResponse } from 'next/server';

/**
 * Serves runtime configuration to the client.
 * Environment variables prefixed with PUBLIC_ are exposed here.
 * Use PUBLIC_ instead of NEXT_PUBLIC_ so they are NOT baked in at build time
 * and can be configured per-deployment via container env vars.
 */
export async function GET(request: NextRequest) {
  const { hostname, host, protocol, origin } = request.nextUrl;
  const isLocalDevelopment =
    hostname === 'localhost' || hostname === '127.0.0.1';
  const fallbackHttpUrl = isLocalDevelopment ? 'http://localhost:3001' : origin;
  const fallbackWsUrl = isLocalDevelopment
    ? 'ws://localhost:3001'
    : `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}`;

  return NextResponse.json({
    backendHttpUrl: process.env.PUBLIC_BACKEND_HTTP_URL ?? fallbackHttpUrl,
    backendWsUrl: process.env.PUBLIC_BACKEND_WS_URL ?? fallbackWsUrl,
  });
}
