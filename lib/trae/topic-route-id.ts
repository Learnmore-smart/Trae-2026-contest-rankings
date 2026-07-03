const NEXT_RSC_ROUTE_SUFFIX = ".rsc";

export function normalizeTopicRouteId(id: string): string {
  return id.endsWith(NEXT_RSC_ROUTE_SUFFIX) ? id.slice(0, -NEXT_RSC_ROUTE_SUFFIX.length) : id;
}
