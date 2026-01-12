import { type Route } from '@/lib/guest-api';

export interface GroupedRoute {
  number: string;
  transportTypeId: number;
  transportTypeName: string;
  intervalMin?: number | null;
  routes: Route[];
  routeIds: number[];
}

export function groupRoutesByNumber(routes: Route[]): GroupedRoute[] {
  const groups = new Map<string, GroupedRoute>();

  for (const route of routes) {
    const routeId = route.routeId ?? route.id;
    const routeNumber = route.number ?? route.routeNumber;
    if (!routeNumber) continue;
    const key = `${routeNumber}-${route.transportTypeId}`;

    if (!groups.has(key)) {
      const transportTypeName = route.transportTypeName ?? route.transportType ?? '';
      groups.set(key, {
        number: routeNumber,
        transportTypeId: route.transportTypeId,
        transportTypeName,
        intervalMin: route.intervalMin,
        routes: [],
        routeIds: [],
      });
    }

    const group = groups.get(key)!;
    group.routes.push(route);
    if (routeId != null && !group.routeIds.includes(routeId)) {
      group.routeIds.push(routeId);
    }
    if (group.intervalMin == null && route.intervalMin != null) {
      group.intervalMin = route.intervalMin;
    }
  }

  return Array.from(groups.values());
}
