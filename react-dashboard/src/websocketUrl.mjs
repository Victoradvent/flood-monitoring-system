export function createWebSocketUrl(baseUrl, token) {
  const url = new URL(baseUrl);
  url.searchParams.set("token", token || "");
  return url.toString();
}
