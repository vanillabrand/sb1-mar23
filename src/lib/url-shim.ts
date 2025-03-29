export const URLSearchParams = window.URLSearchParams;
export const URL = window.URL;

export function parse(url: string) {
  const parsedUrl = new URL(url, window.location.origin);
  return {
    protocol: parsedUrl.protocol.replace(':', ''),
    hostname: parsedUrl.hostname,
    port: parsedUrl.port,
    pathname: parsedUrl.pathname,
    search: parsedUrl.search,
    hash: parsedUrl.hash,
    href: parsedUrl.href
  };
}

export default {
  URLSearchParams,
  URL,
  parse
};