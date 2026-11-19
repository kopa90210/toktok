import React from 'react';
import { Crosshair, MapPin, Navigation } from 'lucide-react';
import { DriverProfile, LatLng, MapPoint, RideRequest, ServiceZone } from '../domain/types';
import {
  ASWAN_SAMPLE_LANDMARKS,
  coordsToSvgXY,
  svgXYToCoords,
} from '../services/mapProvider';

interface AswanInteractiveMapProps {
  pickup?: MapPoint | null;
  destination?: MapPoint | null;
  activeRide?: RideRequest | null;
  drivers?: DriverProfile[];
  serviceZone: ServiceZone;
  pickMode?: 'none' | 'pickup' | 'destination';
  onMapSelectPoint?: (point: MapPoint) => void;
  onLocateMe?: () => void;
  locating?: boolean;
  onOpenConfigGuide?: () => void;
  heightClass?: string;
}

export const AswanInteractiveMap: React.FC<AswanInteractiveMapProps> = ({
  pickup,
  destination,
  activeRide,
  drivers = [],
  serviceZone,
  pickMode = 'none',
  onMapSelectPoint,
  onLocateMe,
  locating = false,
  onOpenConfigGuide,
  heightClass = 'h-[300px] lg:h-full',
}) => {
  const effectivePickup = activeRide?.pickup ?? pickup;
  const effectiveDest = activeRide?.destination ?? destination;

  const zoneCenter = coordsToSvgXY(serviceZone.center);
  // Rough projection scale for visual radius on map
  const zoneRadiusSvg = Math.min(48, Math.max(14, serviceZone.radiusKm * 4.5));

  const pickupXY = effectivePickup ? coordsToSvgXY(effectivePickup.coords) : null;
  const destXY = effectiveDest ? coordsToSvgXY(effectiveDest.coords) : null;

  // Compute simulated driver position along route when ride is active
  const getSimulatedDriverXY = (): { x: number; y: number } | null => {
    if (!activeRide || !pickupXY) return null;
    if (activeRide.state === 'driver_arriving') {
      const start = { x: Math.min(92, pickupXY.x + 14), y: Math.max(10, pickupXY.y - 12) };
      const t = Math.min(1, activeRide.driverProgressPct / 100);
      return {
        x: start.x + (pickupXY.x - start.x) * t,
        y: start.y + (pickupXY.y - start.y) * t,
      };
    }
    if (activeRide.state === 'driver_arrived') {
      return pickupXY;
    }
    if (activeRide.state === 'in_progress' && destXY) {
      const t = Math.min(1, activeRide.driverProgressPct / 100);
      return {
        x: pickupXY.x + (destXY.x - pickupXY.x) * t,
        y: pickupXY.y + (destXY.y - pickupXY.y) * t,
      };
    }
    return null;
  };

  const activeDriverXY = getSimulatedDriverXY();

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pickMode === 'none' || !onMapSelectPoint) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const coords: LatLng = svgXYToCoords(xPct, yPct);
    onMapSelectPoint({
      name:
        pickMode === 'pickup'
          ? `دبوس الركوب (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`
          : `دبوس الوجهة (${coords.lat.toFixed(3)}, ${coords.lng.toFixed(3)})`,
      area: 'تحديد يدوي من الخريطة التجريبية',
      coords,
      isDemoLandmark: true,
    });
  };

  return (
    <div
      className={`relative w-full ${heightClass} overflow-hidden bg-[#EFECE3] border border-[#DFDBD0] rounded-2xl select-none`}
      role="region"
      aria-label="خريطة أسوان التفاعلية التجريبية"
    >
      {/* Top simulation disclaimer bar */}
      <div className="absolute top-3 right-3 left-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-sm border border-[#E2DDD2] rounded-xl px-3 py-1.5 text-xs text-slate-700 shadow-sm flex items-center gap-2">
          <span className="font-semibold text-teal-800">خريطة وموقع محاكاة تجريبية</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="hidden sm:inline text-slate-600">أسوان (لا يوجد GPS أو مزود خرائط متصل)</span>
          {onOpenConfigGuide && (
            <button
              type="button"
              onClick={onOpenConfigGuide}
              className="text-teal-700 underline underline-offset-2 font-medium hover:text-teal-900 whitespace-nowrap shrink-0"
            >
              إعداد المزود
            </button>
          )}
        </div>

        {onLocateMe && (
          <button
            type="button"
            onClick={onLocateMe}
            disabled={locating}
            aria-label="تحديد موقع تجريبي (GPS محاكى)"
            className="pointer-events-auto min-h-[44px] min-w-[44px] px-3 bg-white/95 hover:bg-white border border-[#E2DDD2] rounded-xl shadow-sm flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-800 transition-colors focus-visible:outline-2 focus-visible:outline-teal-700"
          >
            <Crosshair className={`w-4 h-4 text-teal-700 ${locating ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline whitespace-nowrap">موقعي (محاكاة)</span>
          </button>
        )}
      </div>

      {/* Pick-mode prompt */}
      {pickMode !== 'none' && (
        <div className="absolute bottom-3 right-3 left-3 z-10 flex justify-center pointer-events-none">
          <div className="bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md">
            {pickMode === 'pickup'
              ? 'اضغط على أي مكان في الخريطة لتثبيت دبوس نقطة الركوب'
              : 'اضغط على أي مكان في الخريطة لتثبيت دبوس الوجهة'}
          </div>
        </div>
      )}

      {/* SVG stylized Aswan Corniche & Nile River map */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onClick={handleSvgClick}
        className={`w-full h-full ${pickMode !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
      >
        <defs>
          <pattern id="aswanGrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#E4DFD3" strokeWidth="0.3" />
          </pattern>
        </defs>

        {/* Desert/urban terrain */}
        <rect width="100" height="100" fill="#F4F1E8" />
        <rect width="100" height="100" fill="url(#aswanGrid)" />

        {/* West Bank sand dunes hint */}
        <path d="M 0,0 L 34,0 C 30,28 24,52 20,76 L 14,100 L 0,100 Z" fill="#EAE4D3" />

        {/* Nile River curving through Aswan */}
        <path
          d="M 28,0 C 29,22 33,38 35,54 C 37,70 30,85 24,100 L 42,100 C 46,84 51,68 49,52 C 47,36 43,20 42,0 Z"
          fill="#CFE6EB"
          stroke="#A8D0DA"
          strokeWidth="0.5"
        />

        {/* Elephantine Island */}
        <ellipse cx="40" cy="43" rx="3.2" ry="7.5" fill="#DCE5D0" stroke="#BCCAA9" strokeWidth="0.4" />
        <text x="40" y="43.5" fontSize="2.2" fill="#475569" textAnchor="middle" fontWeight="600">
          جزيرة إلفنتين
        </text>

        {/* Corniche & East Bank main roads */}
        <path
          d="M 43,0 C 44,24 49,40 50,55 C 51,72 45,86 43,100"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="1.6"
        />
        <path
          d="M 43,0 C 44,24 49,40 50,55 C 51,72 45,86 43,100"
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="0.4"
          strokeDasharray="1.5 1.5"
        />
        <path d="M 48,30 L 88,24" fill="none" stroke="#FFFFFF" strokeWidth="1.2" />
        <path d="M 50,52 L 85,55" fill="none" stroke="#FFFFFF" strokeWidth="1.1" />
        <path d="M 47,72 L 80,82" fill="none" stroke="#FFFFFF" strokeWidth="1" />

        {/* Service Zone Circle */}
        <circle
          cx={zoneCenter.x}
          cy={zoneCenter.y}
          r={zoneRadiusSvg}
          fill="#0F766E"
          fillOpacity="0.06"
          stroke="#0F766E"
          strokeWidth="0.5"
          strokeDasharray="2 1.5"
        />

        {/* Sample Landmarks dots */}
        {ASWAN_SAMPLE_LANDMARKS.filter((l) => l.category !== 'out_of_zone').map((lm) => {
          const pt = coordsToSvgXY(lm.coords);
          return (
            <g
              key={lm.id}
              onClick={(e) => {
                if (pickMode !== 'none' && onMapSelectPoint) {
                  e.stopPropagation();
                  onMapSelectPoint(lm);
                }
              }}
              className={pickMode !== 'none' ? 'cursor-pointer' : ''}
            >
              <circle cx={pt.x} cy={pt.y} r="1.4" fill="#64748B" />
              <text
                x={pt.x + 2}
                y={pt.y + 0.8}
                fontSize="2.3"
                fill="#475569"
                fontWeight="600"
                className="pointer-events-none"
              >
                {lm.name.split('(')[0].trim()}
              </text>
            </g>
          );
        })}

        {/* Nearby online tuk-tuk markers (when not in active driver simulation) */}
        {!activeDriverXY &&
          drivers
            .filter((d) => d.isOnline && d.applicationStatus === 'approved')
            .map((drv) => {
              const pt = coordsToSvgXY(drv.currentCoords);
              return (
                <g key={drv.id} transform={`translate(${pt.x}, ${pt.y})`}>
                  <rect
                    x="-2.2"
                    y="-1.5"
                    width="4.4"
                    height="3"
                    rx="0.9"
                    fill="#F59E0B"
                    stroke="#78350F"
                    strokeWidth="0.35"
                  />
                  <text y="0.5" fontSize="1.7" fill="#1E293B" textAnchor="middle" fontWeight="700">
                    توك
                  </text>
                </g>
              );
            })}

        {/* Route polyline */}
        {pickupXY && destXY && (
          <path
            d={`M ${pickupXY.x},${pickupXY.y} Q ${(pickupXY.x + destXY.x) / 2 - 4},${
              (pickupXY.y + destXY.y) / 2 - 3
            } ${destXY.x},${destXY.y}`}
            fill="none"
            stroke="#0F766E"
            strokeWidth="1.2"
            strokeDasharray="2 1.2"
          />
        )}

        {/* Pickup pin */}
        {pickupXY && (
          <g transform={`translate(${pickupXY.x}, ${pickupXY.y})`}>
            <circle r="3" fill="#0F766E" fillOpacity="0.2" />
            <circle r="1.8" fill="#0F766E" stroke="#FFFFFF" strokeWidth="0.6" />
          </g>
        )}

        {/* Destination pin */}
        {destXY && (
          <g transform={`translate(${destXY.x}, ${destXY.y})`}>
            <circle r="3" fill="#D97706" fillOpacity="0.22" />
            <circle r="1.8" fill="#D97706" stroke="#FFFFFF" strokeWidth="0.6" />
          </g>
        )}

        {/* Active simulated moving tuk-tuk */}
        {activeDriverXY && (
          <g transform={`translate(${activeDriverXY.x}, ${activeDriverXY.y})`}>
            <circle r="3.4" fill="#F59E0B" fillOpacity="0.3" />
            <rect
              x="-2.6"
              y="-1.8"
              width="5.2"
              height="3.6"
              rx="1"
              fill="#F59E0B"
              stroke="#1E293B"
              strokeWidth="0.4"
            />
            <text y="0.6" fontSize="1.8" fill="#0F172A" textAnchor="middle" fontWeight="800">
              توكتوك
            </text>
          </g>
        )}
      </svg>

      {/* Bottom legend strip (unboxed clean metadata) */}
      <div className="absolute bottom-2.5 right-3 pointer-events-none flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-[#E2DDD2] rounded-lg px-2.5 py-1 text-[11px] text-slate-700">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3 text-teal-700" /> ركوب
        </span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span className="flex items-center gap-1">
          <Navigation className="w-3 h-3 text-amber-600" /> وجهة
        </span>
        <span aria-hidden="true" className="text-slate-300">·</span>
        <span>نطاق {serviceZone.radiusKm} كم</span>
      </div>
    </div>
  );
};
