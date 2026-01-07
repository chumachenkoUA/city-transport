import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapProps {
  onMapLoad?: (map: maplibregl.Map) => void;
  onClick?: (ev: maplibregl.MapMouseEvent & maplibregl.EventData) => void;
  center?: [number, number];
  zoom?: number;
  markers?: Array<{ lon: number; lat: number; color?: string; title?: string }>;
}

export function Map({ 
  onMapLoad, 
  onClick,
  center = [24.03, 49.84], 
  zoom = 12,
  markers = []
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markerObjects = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    if (map.current) return;

    if (mapContainer.current) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            'osm': {
              type: 'raster',
              tiles: [
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
              ],
              tileSize: 256,
              attribution: '&copy; OpenStreetMap Contributors',
              maxzoom: 19
            }
          },
          layers: [
            {
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm',
              minzoom: 0,
              maxzoom: 19
            }
          ]
        },
        center: center,
        zoom: zoom,
      });

      map.current.on('load', () => {
        if (onMapLoad && map.current) {
          onMapLoad(map.current);
        }
      });

      map.current.on('click', (e) => {
        if (onClick) onClick(e);
      });
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers
    markerObjects.current.forEach(m => m.remove());
    markerObjects.current = [];

    // Add new markers
    markers.forEach(m => {
      const marker = new maplibregl.Marker({ color: m.color })
        .setLngLat([m.lon, m.lat])
        .addTo(map.current!);
      
      if (m.title) {
        marker.setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(`<span>${m.title}</span>`));
      }
      
      markerObjects.current.push(marker);
    });
  }, [markers]);

  return <div ref={mapContainer} className="w-full h-full" />;
}
