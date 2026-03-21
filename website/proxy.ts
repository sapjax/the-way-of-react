import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOCALES, LOCALE_COOKIE, pickLocaleFromHeader, isLocale } from "./lib/i18n";

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Preserve paths that should not be localized
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/code") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Check if pathname already has a locale
  const pathnameHasLocale = LOCALES.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) return NextResponse.next();

  // Determine locale: check cookie first, then header
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  const headerLocale = pickLocaleFromHeader(request.headers.get("accept-language"));
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : headerLocale;

  // Redirect to localized path
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // Pattern to skip internal paths and specific assets
    "/((?!api|_next/static|_next/image|favicon.ico|images|code).*)",
  ],
};
