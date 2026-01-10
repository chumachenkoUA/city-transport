export const TRANSPORT_COLORS = {
  1: { name: 'Tram', base: '#EF4444', light: '#F87171', dark: '#DC2626' },
  2: { name: 'Bus', base: '#FCD34D', light: '#FDE68A', dark: '#F59E0B' },
  3: { name: 'Trolleybus', base: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
} as const;

export function getRouteColor(transportTypeId: number, direction?: string): string {
  const colors =
    TRANSPORT_COLORS[transportTypeId as keyof typeof TRANSPORT_COLORS];
  if (!colors) return '#9CA3AF';
  if (!direction) return colors.base;
  return direction === 'forward' ? colors.light : colors.dark;
}

export function getTransportTypeColor(transportTypeId: number): string {
  return (
    TRANSPORT_COLORS[transportTypeId as keyof typeof TRANSPORT_COLORS]?.base ??
    '#9CA3AF'
  );
}
