import {
  calculateSuggestedFare,
  haversineDistanceKm,
  isInsideServiceZone,
} from '../domain/stateMachine';
import { FareConfig, Landmark, LatLng, MapPoint, ServiceZone } from '../domain/types';
import { IMapProvider, RouteEstimate } from './interfaces';

export const ASWAN_SAMPLE_LANDMARKS: Landmark[] = [
  {
    id: 'lm-station',
    name: 'محطة قطار أسوان',
    area: 'وسط البلد · شارع المحطة',
    coords: { lat: 24.0975, lng: 32.9001 },
    category: 'station',
    isDemoLandmark: true,
  },
  {
    id: 'lm-souq',
    name: 'السوق السياحي',
    area: 'شارع السوق · وسط أسوان',
    coords: { lat: 24.0908, lng: 32.8952 },
    category: 'market',
    isDemoLandmark: true,
  },
  {
    id: 'lm-corniche',
    name: 'كورنيش النيل (فندق كتراكت)',
    area: 'الكورنيش · جنوب وسط البلد',
    coords: { lat: 24.0792, lng: 32.8856 },
    category: 'tourism',
    isDemoLandmark: true,
  },
  {
    id: 'lm-hospital',
    name: 'مستشفى أسوان الجامعي',
    area: 'شارع كسر الحجر',
    coords: { lat: 24.0844, lng: 32.8988 },
    category: 'hospital',
    isDemoLandmark: true,
  },
  {
    id: 'lm-faryal',
    name: 'حديقة فريال التاريخية',
    area: 'الكورنيش القبلي',
    coords: { lat: 24.0825, lng: 32.8878 },
    category: 'tourism',
    isDemoLandmark: true,
  },
  {
    id: 'lm-bus',
    name: 'موقف الأقاليم (كركر / السيل)',
    area: 'السيل الجديد',
    coords: { lat: 24.1062, lng: 32.9125 },
    category: 'station',
    isDemoLandmark: true,
  },
  {
    id: 'lm-sahary',
    name: 'جامعة أسوان — صحاري',
    area: 'طريق المطار · صحاري',
    coords: { lat: 24.0398, lng: 32.8662 },
    category: 'university',
    isDemoLandmark: true,
  },
  {
    id: 'lm-philae',
    name: 'مرسى معبد فيلة',
    area: 'خزان أسوان · الشلال',
    coords: { lat: 24.0275, lng: 32.8842 },
    category: 'tourism',
    isDemoLandmark: true,
  },
  {
    id: 'lm-out-new-aswan',
    name: 'مدينة أسوان الجديدة (خارج النطاق)',
    area: 'غرب النيل · خارج منطقة الخدمة',
    coords: { lat: 24.185, lng: 32.845 },
    category: 'out_of_zone',
    isDemoLandmark: true,
  },
];

export const MAP_BOUNDS = {
  minLat: 24.015,
  maxLat: 24.13,
  minLng: 32.855,
  maxLng: 32.93,
};

export function coordsToSvgXY(coords: LatLng): { x: number; y: number } {
  const xRatio = (coords.lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  const yRatio = 1 - (coords.lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  const clampedX = Math.max(4, Math.min(96, xRatio * 100));
  const clampedY = Math.max(4, Math.min(96, yRatio * 100));
  return { x: clampedX, y: clampedY };
}

export function svgXYToCoords(xPct: number, yPct: number): LatLng {
  const lng = MAP_BOUNDS.minLng + (xPct / 100) * (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng);
  const lat = MAP_BOUNDS.minLat + (1 - yPct / 100) * (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat);
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

export class SimulatedAswanMapProvider implements IMapProvider {
  readonly providerName = 'خريطة أسوان التفاعلية (محاكاة تجريبية)';
  readonly isConfigured = false;

  getAllLandmarks(): Landmark[] {
    return ASWAN_SAMPLE_LANDMARKS;
  }

  searchLandmarks(query: string): Landmark[] {
    const q = query.trim().toLowerCase();
    if (!q) return ASWAN_SAMPLE_LANDMARKS;
    return ASWAN_SAMPLE_LANDMARKS.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.area.toLowerCase().includes(q)
    );
  }

  async getCurrentLocation(options: {
    permissionDenied: boolean;
    gpsUnavailable: boolean;
  }): Promise<
    | { ok: true; point: MapPoint }
    | { ok: false; reason: 'permission_denied' | 'gps_unavailable'; message: string }
  > {
    await new Promise((r) => setTimeout(r, 420));
    if (options.permissionDenied) {
      return {
        ok: false,
        reason: 'permission_denied',
        message: 'تم رفض إذن الوصول للموقع. يمكنك اختيار نقطة الركوب يدوياً من الخريطة أو القائمة.',
      };
    }
    if (options.gpsUnavailable) {
      return {
        ok: false,
        reason: 'gps_unavailable',
        message: 'إشارة GPS غير متوفرة حالياً. حاول مرة أخرى أو حدد موقعك على الخريطة.',
      };
    }
    return {
      ok: true,
      point: {
        id: 'gps-simulated',
        name: 'موقعك التجريبي (قرب كورنيش أسوان)',
        area: 'محاكاة GPS · وسط أسوان',
        coords: { lat: 24.0912, lng: 32.8935 },
        isDemoLandmark: true,
      },
    };
  }

  estimateRoute(pickup: MapPoint, destination: MapPoint): RouteEstimate {
    const straightKm = haversineDistanceKm(pickup.coords, destination.coords);
    const roadKm = Number((straightKm * 1.28).toFixed(1));
    const etaMinutes = Math.max(3, Math.round(roadKm * 2.6 + 2));

    const midLat = (pickup.coords.lat + destination.coords.lat) / 2 + 0.0028;
    const midLng = (pickup.coords.lng + destination.coords.lng) / 2 - 0.0022;

    return {
      distanceKm: roadKm,
      etaMinutes,
      polyline: [
        pickup.coords,
        { lat: midLat, lng: midLng },
        destination.coords,
      ],
      isSimulated: true,
    };
  }

  isWithinZone(coords: LatLng, zone: ServiceZone): boolean {
    return isInsideServiceZone(coords, zone);
  }

  getSuggestedFare(distanceKm: number, fareConfig: FareConfig): number {
    return calculateSuggestedFare(distanceKm, fareConfig);
  }

  getConfigInstructions(): string[] {
    return [
      'يعمل التطبيق حالياً بمحاكاة خريطة أسوان محلياً دون استدعاء أي مزود خرائط مدفوع.',
      'لتفعيل الخرائط الحقيقية (مثل Google Maps أو Mapbox): أضف مفتاح العميل في متغير بيئة VITE_MAPS_API_KEY أو نفّذ استدعاء المسارات عبر خادم وسيط (/api/routes) لحماية مفاتيح السيرفر.',
      'استبدل SimulatedAswanMapProvider بتطبيق فعلي لواجهة IMapProvider مع ربط Places Autocomplete و Directions API.',
      'احتفظ بقواعد التحقق من النطاق الجغرافي (ServiceZone) وحساب التسعير الاسترشادي على السيرفر.',
    ];
  }
}

export const mapProvider: IMapProvider = new SimulatedAswanMapProvider();
