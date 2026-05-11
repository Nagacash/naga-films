import { NextResponse } from 'next/server';

export function middleware(request) {
    const url = request.nextUrl;

    const isMuApi = url.pathname.startsWith('/api/workflow') ||
                    url.pathname.startsWith('/api/app') ||
                    url.pathname.startsWith('/api/v1');

    if (isMuApi) {
        if (url.pathname.startsWith('/api/v1')) {
            const targetUrl = new URL(url.pathname + url.search, 'https://api.muapi.ai');
            const headers = new Headers(request.headers);
            headers.delete('cookie');
            headers.delete('Cookie');
            return NextResponse.rewrite(targetUrl, { request: { headers } });
        }
    }

    return NextResponse.next();
}

// Match the paths we want to proxy
export const config = {
    matcher: [
        '/api/workflow/:path*', 
        '/api/app/:path*',
        '/api/v1/:path*'
    ],
};
