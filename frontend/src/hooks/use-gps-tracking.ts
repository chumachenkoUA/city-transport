import { useEffect, useRef, useState } from 'react'
import { logDriverGps } from '@/lib/driver-api'

const GPS_LOG_INTERVAL_MS = 15000

interface GpsLocation {
  lon: number
  lat: number
  recordedAt?: string
}

interface UseGpsTrackingOptions {
  activeTripId?: number
  enabled?: boolean
}

export function useGpsTracking({ activeTripId, enabled = true }: UseGpsTrackingOptions) {
  const [currentLocation, setCurrentLocation] = useState<GpsLocation | null>(null)
  const [error, setError] = useState<string | null>(() => {
    if (typeof navigator === 'undefined') return null
    return 'geolocation' in navigator ? null : 'Геолокація недоступна у браузері.'
  })

  const lastGpsSentAtRef = useRef(0)
  const gpsInFlightRef = useRef(false)

  // Watch geolocation
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({
          lon: pos.coords.longitude,
          lat: pos.coords.latitude,
          recordedAt: new Date(pos.timestamp).toISOString(),
        })
        setError(null)
      },
      () => {
        setError('Не вдалося отримати геолокацію.')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000,
      }
    )

    return () => {
      navigator.geolocation.clearWatch(watchId)
    }
  }, [enabled])

  // Log GPS to server when active trip exists
  useEffect(() => {
    if (!activeTripId || !currentLocation || !enabled) return

    const now = Date.now()
    if (gpsInFlightRef.current) return
    if (now - lastGpsSentAtRef.current < GPS_LOG_INTERVAL_MS) return

    gpsInFlightRef.current = true
    lastGpsSentAtRef.current = now

    logDriverGps({
      lon: currentLocation.lon,
      lat: currentLocation.lat,
      recordedAt: currentLocation.recordedAt ?? new Date().toISOString(),
    })
      .catch(() => undefined)
      .finally(() => {
        gpsInFlightRef.current = false
      })
  }, [activeTripId, currentLocation, enabled])

  return {
    currentLocation,
    error,
    isTracking: !!activeTripId && !!currentLocation,
  }
}
