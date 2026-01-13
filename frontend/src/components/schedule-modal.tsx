import { useQuery } from '@tanstack/react-query';
import { getRouteSchedule } from '@/lib/guest-api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Clock, Calendar, MapPin, Bus, Train } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { getTransportTypeColor } from '@/lib/map-colors';
import { useMemo } from 'react';

interface ScheduleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  routeId: number;
  routeNumber: string;
  transportTypeName: string;
  transportTypeId: number;
  direction?: string;
  stopId?: number;
  stopName?: string;
}

function formatTime(time: string): string {
  return time?.slice(0, 5) || '--:--';
}

function getTransportIcon(typeId: number, className: string = 'h-5 w-5') {
  switch (typeId) {
    case 1:
      return <Bus className={className} />;
    case 2:
      return <Train className={className} />;
    default:
      return <Bus className={className} />;
  }
}

export function ScheduleModal({
  open,
  onOpenChange,
  routeId,
  routeNumber,
  transportTypeName,
  transportTypeId,
  direction,
  stopId,
  stopName,
}: ScheduleModalProps) {
  const { data: scheduleData, isLoading } = useQuery({
    queryKey: ['route-schedule-detailed', routeId, direction, stopId],
    queryFn: () => getRouteSchedule({ routeId, direction, stopId }),
    enabled: open,
  });

  const color = getTransportTypeColor(transportTypeId);

  // Find the next departure based on current time
  const nextDepartureIndex = useMemo(() => {
    if (!scheduleData?.arrivals?.length) return -1;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const times = stopId ? scheduleData.arrivals : scheduleData.departures;

    for (let i = 0; i < times.length; i++) {
      const [hours, minutes] = times[i].split(':').map(Number);
      const timeMinutes = hours * 60 + minutes;
      if (timeMinutes >= currentMinutes) {
        return i;
      }
    }
    return -1;
  }, [scheduleData, stopId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div
              className="flex items-center justify-center h-10 w-10 rounded-lg"
              style={{ backgroundColor: `${color}20` }}
            >
              {getTransportIcon(transportTypeId, 'h-5 w-5')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="px-2 py-0.5 text-sm font-bold rounded"
                  style={{ backgroundColor: color, color: 'white' }}
                >
                  {routeNumber}
                </span>
                <span className="text-base font-medium">{transportTypeName}</span>
              </div>
              <span className="text-sm text-muted-foreground font-normal">
                {direction === 'forward' ? 'Прямий напрямок' : 'Зворотній напрямок'}
              </span>
            </div>
          </DialogTitle>
          {(stopName || scheduleData?.stop?.name) && (
            <DialogDescription className="flex items-center gap-2 mt-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>Зупинка: {stopName || scheduleData?.stop?.name}</span>
              {scheduleData?.stop?.offsetMin != null && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round(scheduleData.stop.offsetMin)} хв від початку маршруту)
                </span>
              )}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-4">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <span className="ml-2 text-muted-foreground">Завантаження розкладу...</span>
            </div>
          )}

          {!isLoading && !scheduleData && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Розклад для цього маршруту не знайдено</p>
            </div>
          )}

          {!isLoading && scheduleData && (
            <>
              {/* Schedule Info */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-muted-foreground">Початок:</span>
                    <span className="font-semibold">
                      {formatTime(scheduleData.schedule.workStartTime)}
                    </span>
                  </div>
                  <div className="flex-1 border-t border-dashed border-muted-foreground/30" />
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-muted-foreground">Кінець:</span>
                    <span className="font-semibold">
                      {formatTime(scheduleData.schedule.workEndTime)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-950/30 rounded">
                  <span className="text-sm text-muted-foreground">Інтервал:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    ~{scheduleData.schedule.intervalMin} хв
                  </span>
                </div>
              </div>

              {/* Departures/Arrivals Grid */}
              {scheduleData.departures?.length > 0 && (
                <div className="border rounded-lg p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {stopId ? 'Час прибуття на зупинку' : 'Час відправлення з початкової зупинки'}
                  </h4>

                  <div className="grid grid-cols-5 sm:grid-cols-6 gap-1.5 max-h-[300px] overflow-auto">
                    {(stopId ? scheduleData.arrivals : scheduleData.departures).map((time, idx) => {
                      const isNext = idx === nextDepartureIndex;
                      const isPast = nextDepartureIndex !== -1 && idx < nextDepartureIndex;

                      return (
                        <div
                          key={idx}
                          className={`
                            px-2 py-1.5 text-center text-sm rounded font-mono
                            ${isNext
                              ? 'bg-green-500 text-white font-bold ring-2 ring-green-300'
                              : isPast
                                ? 'bg-muted/50 text-muted-foreground'
                                : 'bg-muted hover:bg-muted/80'
                            }
                          `}
                          title={isNext ? 'Наступний рейс' : undefined}
                        >
                          {time}
                        </div>
                      );
                    })}
                  </div>

                  {nextDepartureIndex !== -1 && (
                    <div className="mt-3 flex items-center gap-2 text-sm">
                      <div className="w-3 h-3 rounded bg-green-500" />
                      <span className="text-muted-foreground">
                        Наступний рейс о{' '}
                        <span className="font-semibold text-foreground">
                          {(stopId ? scheduleData.arrivals : scheduleData.departures)[nextDepartureIndex]}
                        </span>
                      </span>
                    </div>
                  )}

                  {nextDepartureIndex === -1 && scheduleData.departures.length > 0 && (
                    <div className="mt-3 text-sm text-muted-foreground">
                      На сьогодні рейсів більше немає
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
