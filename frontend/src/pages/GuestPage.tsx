import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { getErrorMessage } from '../lib/errors'

// Types... (same as before)
type TransportType = { id: number; name: string }
type StopRow = { id: number; name: string; lon: string; lat: string; distanceM?: number }
type RouteStopRow = { id: number; name: string; lon: string; lat: string; distanceToNextKm: number | null }
type RoutePointRow = { id: number; routeId: number; lon: string; lat: string }
type RouteSchedule = {
  route: { id: number; number: string; direction: string; transportTypeId: number; transportType: string }
  stop: { id: number; name: string | null; offsetMin: number | null } | null
  schedule: { workStartTime: string; workEndTime: string; intervalMin: number }
  departures: string[]; arrivals: string[]
}

function GuestPage() {
  const [activeMode, setActiveMode] = useState<'stops' | 'route'>('stops')
  const [geoStatus, setGeoStatus] = useState<string | null>(null)
  
  // Forms state
  const [nearForm, setNearForm] = useState({ lon: '', lat: '', radius: '600', limit: '8' })
  const [selectedStop, setSelectedStop] = useState<StopRow | null>(null)
  
  // Planner State
  const [tripForm, setTripForm] = useState({ lonA: '', latA: '', lonB: '', latB: '', radius: '1000' })
  
  // Queries & Mutations
  const stopsNearMutation = useMutation({
    mutationFn: async () => {
      const params = { lon: Number(nearForm.lon), lat: Number(nearForm.lat), radius: Number(nearForm.radius), limit: Number(nearForm.limit) }
      const response = await api.get('/guest/stops/near', { params })
      return response.data as StopRow[]
    },
  })

  const routesByStopMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStop) return []
      const response = await api.get(`/guest/stops/${selectedStop.id}/routes`)
      return response.data as Array<{ routeId: number; routeNumber: string; transportType: string; direction: string; approxArrivalMin: number | null }>
    },
  })

  const routesBetweenMutation = useMutation({
    mutationFn: async () => {
      const params = { lonA: Number(tripForm.lonA), latA: Number(tripForm.latA), lonB: Number(tripForm.lonB), latB: Number(tripForm.latB), radius: Number(tripForm.radius) }
      const response = await api.get('/guest/routes/near', { params })
      return response.data as { fromStop: StopRow; toStop: StopRow; routes: Array<{ routeId: number; routeNumber: string; transportType: string; travelMinutes: number | null }> }
    },
  })

  const handleGeolocation = () => {
    if (!navigator.geolocation) return
    setGeoStatus('Locating...')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lon = pos.coords.longitude.toFixed(6)
        const lat = pos.coords.latitude.toFixed(6)
        setNearForm(p => ({ ...p, lon, lat }))
        setTripForm(p => ({ ...p, lonA: lon, latA: lat }))
        setGeoStatus(null)
        stopsNearMutation.mutate()
      },
      () => setGeoStatus('Error')
    )
  }

  const handleSelectStop = (stop: StopRow) => {
    setSelectedStop(stop)
    routesByStopMutation.mutate()
  }

  return (
    <div className="relative w-full h-screen bg-[#f0f4f8] overflow-hidden flex flex-col md:flex-row">
      {/* Map Background Placeholder */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/World_map_blank_without_borders.svg')] bg-cover bg-center grayscale"></div>
      <div className="absolute inset-0 z-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-40"></div>

      {/* Floating Sidebar */}
      <aside className="relative z-10 w-full md:w-[450px] h-full bg-white/90 backdrop-blur-xl border-r border-slate-200 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100">
           <div className="flex items-center gap-2 mb-4">
             <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">CT</div>
             <span className="font-bold text-slate-800 tracking-tight">City Transport</span>
           </div>

           <div className="flex bg-slate-100 p-1 rounded-xl">
             <button 
               onClick={() => setActiveMode('stops')}
               className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeMode === 'stops' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Зупинки
             </button>
             <button 
               onClick={() => setActiveMode('route')}
               className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeMode === 'route' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Маршрут
             </button>
           </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
           
           {activeMode === 'stops' && (
             <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="8" r="3"/><path d="M8 11v4M8 5V1M11 8h4M5 8H1"/></svg>
                  </div>
                  <input 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Введіть координати..."
                    value={`${nearForm.lon} ${nearForm.lat}`}
                    readOnly
                  />
                  <button 
                    onClick={handleGeolocation}
                    className="absolute inset-y-1 right-1 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    {geoStatus || 'Знайти мене'}
                  </button>
                </div>

                <button 
                  onClick={() => stopsNearMutation.mutate()}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-semibold shadow-lg shadow-slate-900/10 hover:bg-slate-800 transition-all active:scale-[0.98]"
                >
                  Шукати поруч
                </button>

                <div className="space-y-2">
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Результати</h3>
                   {stopsNearMutation.data?.map(stop => (
                     <div 
                       key={stop.id}
                       onClick={() => handleSelectStop(stop)}
                       className={`group p-4 rounded-2xl border cursor-pointer transition-all ${
                         selectedStop?.id === stop.id 
                           ? 'bg-blue-50 border-blue-500 shadow-md ring-1 ring-blue-500' 
                           : 'bg-white border-slate-100 hover:border-blue-300 hover:shadow-sm'
                       }`}
                     >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors">{stop.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5 font-mono">{stop.lon.slice(0,7)}, {stop.lat.slice(0,7)}</div>
                          </div>
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-lg group-hover:scale-110 transition-transform">🚏</div>
                        </div>
                     </div>
                   ))}
                   {stopsNearMutation.data?.length === 0 && (
                     <div className="text-center py-8 text-slate-400 text-sm bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                       Зупинок не знайдено.
                     </div>
                   )}
                </div>
             </div>
           )}

           {activeMode === 'route' && (
             <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                <div className="space-y-4">
                   <div className="relative">
                     <div className="absolute left-4 top-3 bottom-3 w-0.5 bg-slate-200"></div>
                     
                     <div className="relative mb-3">
                       <div className="absolute left-2.5 top-3 w-3 h-3 bg-white border-2 border-slate-400 rounded-full z-10"></div>
                       <input 
                         placeholder="Звідки (Lon, Lat)"
                         value={`${tripForm.lonA}, ${tripForm.latA}`}
                         onChange={e => {
                           const [l, la] = e.target.value.split(','); 
                           setTripForm({...tripForm, lonA: l, latA: la})
                         }}
                         className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none shadow-sm"
                       />
                     </div>

                     <div className="relative">
                       <div className="absolute left-2.5 top-3 w-3 h-3 bg-blue-600 rounded-full z-10 shadow ring-2 ring-white"></div>
                       <input 
                         placeholder="Куди (Lon, Lat)"
                         value={`${tripForm.lonB}, ${tripForm.latB}`}
                         onChange={e => {
                           const [l, la] = e.target.value.split(','); 
                           setTripForm({...tripForm, lonB: l, latB: la})
                         }}
                         className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm focus:border-blue-500 outline-none shadow-sm"
                       />
                     </div>
                   </div>

                   <button 
                      onClick={() => routesBetweenMutation.mutate()}
                      className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all active:scale-[0.98]"
                    >
                      Побудувати маршрут
                    </button>
                </div>

                <div className="space-y-3">
                   {routesBetweenMutation.data?.routes.map(route => (
                     <div key={route.routeId} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
                        <div className="h-12 w-12 rounded-xl bg-slate-100 flex flex-col items-center justify-center">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{route.transportType.slice(0,3)}</span>
                          <span className="text-lg font-black text-slate-900">{route.routeNumber}</span>
                        </div>
                        <div className="flex-1">
                           <div className="flex justify-between items-baseline">
                             <span className="font-semibold text-slate-700">Прямий рейс</span>
                             <span className="font-bold text-green-600">{Math.round(route.travelMinutes ?? 0)} хв</span>
                           </div>
                           <div className="text-xs text-slate-400 mt-1">Оптимальний маршрут</div>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           )}

        </div>
      </aside>

      {/* Main Map Area (Mockup) */}
      <main className="flex-1 relative hidden md:block">
         {selectedStop ? (
            <div className="absolute top-8 left-8 right-8 z-20">
               <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 shadow-2xl border border-white/50 max-w-2xl animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-start mb-6">
                     <div>
                       <h2 className="text-3xl font-bold text-slate-900">{selectedStop.name}</h2>
                       <p className="text-slate-500 mt-1">Інформаційне табло</p>
                     </div>
                     <button onClick={() => setSelectedStop(null)} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors">✕</button>
                  </div>

                  <div className="grid gap-3">
                     {routesByStopMutation.isPending && <div className="text-center py-4 text-slate-400">Завантаження розкладу...</div>}
                     {routesByStopMutation.data?.map(route => (
                       <div key={route.routeId} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-4">
                             <div className="bg-white px-3 py-1 rounded-lg border border-slate-200 font-black text-xl text-slate-800 shadow-sm w-16 text-center">
                               {route.routeNumber}
                             </div>
                             <div>
                               <div className="font-semibold text-slate-700">{route.transportType}</div>
                               <div className="text-xs text-slate-400 uppercase tracking-wide">{route.direction}</div>
                             </div>
                          </div>
                          
                          <div className="text-right">
                             {route.approxArrivalMin ? (
                               <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-bold text-green-600">{route.approxArrivalMin}</span>
                                  <span className="text-sm font-medium text-slate-500">хв</span>
                               </div>
                             ) : (
                               <span className="text-sm text-slate-400">--</span>
                             )}
                          </div>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
         ) : (
           <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur px-6 py-3 rounded-full shadow-xl border border-white/50 text-slate-600 text-sm font-medium">
             Оберіть зупинку на панелі ліворуч
           </div>
         )}
         
         {/* Map Points Visualization Mockup */}
         {selectedStop && (
           <div className="absolute top-1/2 left-1/2 w-4 h-4 bg-blue-600 rounded-full shadow-[0_0_0_8px_rgba(37,99,235,0.2)] animate-pulse"></div>
         )}
      </main>
    </div>
  )
}

export default GuestPage
