import type { Lang } from "@/lib/hooks/useLang";

export function langFetch(
  url: string,
  lang: Lang,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set("Accept-Language", lang);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...options, headers });
}
