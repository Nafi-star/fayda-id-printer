import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * App areas that require a session cookie. APIs still enforce active account via getUserFromSession.
 */
export function middleware(request: NextRequest) {
  if (!request.cookies.get("session")?.value) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/history",
    "/history/:path*",
    "/purchase-history",
    "/purchase-history/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
