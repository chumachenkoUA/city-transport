import React, { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Search, MapPin, Navigation, Bus, LogIn, Crosshair, X } from "lucide-react";
import { cn } from "../lib/utils";

// Geo Permission States
type GeoState = "prompt" | "denied" | "granted" | "picking_start" | "picking_end";

const GuestPage = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [geoState, setGeoState] = useState<GeoState>("prompt");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (map.current) return;
    if (!mapContainer.current) return;

    try {
        map.current = new maplibregl.Map({
          container: mapContainer.current,
          // Використовуємо надійний стиль Carto Dark Matter
          style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
          center: [24.0316, 49.8429], // Lviv Center
          zoom: 12,
          attributionControl: true,
        });

        map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        
        map.current.on('load', () => {
            console.log("Map loaded successfully");
        });

        map.current.on('error', (e) => {
            console.error("Map error:", e);
        });

    } catch (e) {
        console.error("Error initializing map:", e);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  const handleAllowGeo = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoState("granted");
          map.current?.flyTo({
            center: [position.coords.longitude, position.coords.latitude],
            zoom: 14,
          });
        },
        () => setGeoState("denied")
      );
    } else {
      setGeoState("denied");
    }
  };

  const startPickingPoint = () => setGeoState("picking_start");

  return (
    <div className="relative w-full h-full bg-background overflow-hidden font-sans text-text">
      {/* 1. Full Screen Map Container - Added bg-zinc-900 to see if container exists */}
      <div ref={mapContainer} className="absolute inset-0 w-full h-full bg-zinc-900" />

      {/* 2. Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none z-10">
        <div className="pointer-events-auto">
             <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-xl">
                <div className="bg-gradient-to-br from-violet-500 to-pink-500 w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold">
                    CT
                </div>
                <span className="font-semibold px-2 hidden sm:block">City Transport</span>
             </div>
        </div>
        
        <div className="pointer-events-auto">
            <Button variant="secondary" size="sm" className="shadow-lg" onClick={() => window.location.href = '/'}>
                <LogIn size={16} className="mr-2" />
                Вхід
            </Button>
        </div>
      </div>

      {/* 3. Floating Panel (Left) */}
      <div className="absolute top-20 left-4 bottom-8 w-full max-w-xs z-10 pointer-events-none hidden md:flex flex-col gap-4">
          <Card className="pointer-events-auto p-4 space-y-4 shadow-2xl bg-surface/60 backdrop-blur-xl border-white/10">
              <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-muted" size={18} />
                  <Input 
                    placeholder="Пошук зупинки або маршруту..." 
                    className="pl-10 bg-black/40 border-white/5"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </div>
              
              <div className="space-y-2">
                 <h3 className="text-xs font-semibold text-muted uppercase tracking-wider">Маршрути поруч</h3>
                 <RouteItem number="3A" type="bus" dest="ТЦ King Cross" time="5 хв" />
                 <RouteItem number="4" type="tram" dest="Вокзал" time="2 хв" />
                 <RouteItem number="25" type="trolley" dest="Аеропорт" time="12 хв" />
              </div>
              
              <Button variant="outline" className="w-full text-xs" size="sm">
                  <MapPin size={14} className="mr-2" />
                  Показати всі зупинки
              </Button>
          </Card>
      </div>

      {/* 4. Geo Prompt Banner (Bottom Center) */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center z-20 pointer-events-none px-4">
         <div className="pointer-events-auto">
             {geoState === 'prompt' && (
                 <Card className="flex flex-col sm:flex-row items-center p-1 pr-2 gap-4 bg-surface/80 border-accent/20 shadow-2xl shadow-accent/10">
                     <div className="bg-accent/10 p-3 rounded-2xl">
                         <Navigation className="text-accent" size={24} />
                     </div>
                     <div className="flex flex-col py-2">
                         <span className="font-medium text-sm">Де ти зараз?</span>
                         <span className="text-xs text-muted">Дозволь доступ до геолокації</span>
                     </div>
                     <div className="flex gap-2">
                         <Button size="sm" variant="ghost" onClick={() => setGeoState('denied')}>Пізніше</Button>
                         <Button size="sm" onClick={handleAllowGeo}>Дозволити</Button>
                     </div>
                 </Card>
             )}

             {geoState === 'denied' && (
                 <Card className="flex items-center p-2 gap-4 bg-surface/90 border-red-500/20 shadow-2xl">
                     <div className="pl-2">
                        <span className="text-sm text-muted">Геолокацію вимкнено.</span>
                     </div>
                     <Button size="sm" variant="outline" onClick={startPickingPoint}>
                         <Crosshair size={16} className="mr-2" />
                         Обрати на мапі
                     </Button>
                     <button onClick={() => setGeoState('prompt')} className="p-1 hover:bg-white/10 rounded-full text-muted">
                         <X size={14} />
                     </button>
                 </Card>
             )}

             {geoState.startsWith('picking') && (
                 <Card className="flex flex-col items-center p-4 gap-2 bg-surface/90 border-accent/50 shadow-2xl w-[300px]">
                     <Badge className="bg-accent text-white mb-2">
                         {geoState === 'picking_start' ? 'КРОК 1' : 'КРОК 2'}
                     </Badge>
                     <p className="text-center font-medium text-sm">
                         {geoState === 'picking_start' 
                            ? 'Клікни на мапі для точки старту' 
                            : 'Тепер обери точку призначення'}
                     </p>
                     <Button size="sm" variant="ghost" className="mt-2 text-muted" onClick={() => setGeoState('prompt')}>
                         Скасувати
                     </Button>
                 </Card>
             )}
         </div>
      </div>
    </div>
  );
};

const RouteItem = ({ number, type, dest, time }: { number: string; type: 'bus' | 'tram' | 'trolley'; dest: string; time: string }) => {
    const colors = {
        bus: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        tram: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        trolley: 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    };
    return (
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group text-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold border", colors[type])}>
                {number}
            </div>
            <div className="flex-1 truncate font-medium">{dest}</div>
            <div className="text-xs font-bold text-accent bg-accent/10 px-2 py-1 rounded-lg">{time}</div>
        </div>
    )
}

export default GuestPage;
