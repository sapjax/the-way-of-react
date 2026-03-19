import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_COOKIE, isLocale, pickLocaleFromHeader } from "@/lib/i18n";

export default async function RootPage() {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : pickLocaleFromHeader(headerStore.get("accept-language"));
  redirect(`/${locale}`);
}
