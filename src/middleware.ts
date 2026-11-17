import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public-demo route boundary.
 *
 * Hiding admin nav is not enough — block privileged paths at the edge when
 * CIT_PUBLIC_DEMO is enabled. Commodity workspace routes remain available.
 */
export function middleware(request: NextRequest) {
  const demo =
    process.env.CIT_PUBLIC_DEMO === "1" ||
    process.env.CIT_PUBLIC_DEMO === "true";
  if (!demo) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const blocked =
    pathname.startsWith("/system") ||
    pathname.includes("/manual-input");

  if (!blocked) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/sulphur/overview";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/system/:path*", "/:commodityId/manual-input"],
};
