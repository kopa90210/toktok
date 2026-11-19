import {
  DriverApplicationStatus,
  DriverOffer,
  FareConfig,
  LatLng,
  OfferState,
  RideRequest,
  RideState,
  ServiceZone,
} from './types';

/**
 * Valid Ride State Machine Transitions
 * NOTE: Client-side validation is for UX & prototype integrity only.
 * In production, all transitions MUST be enforced atomically on the server.
 */
export const VALID_RIDE_TRANSITIONS: Record<RideState, RideState[]> = {
  requested: ['offers_open', 'no_driver', 'cancelled', 'expired'],
  offers_open: ['driver_selected', 'no_driver', 'cancelled', 'expired'],
  driver_selected: ['driver_arriving', 'cancelled'],
  driver_arriving: ['driver_arrived', 'cancelled'],
  driver_arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
  no_driver: [],
};

export const VALID_OFFER_TRANSITIONS: Record<OfferState, OfferState[]> = {
  submitted: ['selected', 'rejected', 'withdrawn', 'expired'],
  selected: [],
  rejected: [],
  withdrawn: [],
  expired: [],
};

export const VALID_DRIVER_APP_TRANSITIONS: Record<
  DriverApplicationStatus,
  DriverApplicationStatus[]
> = {
  draft: ['submitted'],
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['rejected'],
  rejected: ['under_review', 'submitted'],
};

export function canTransitionRide(from: RideState, to: RideState): boolean {
  return VALID_RIDE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionOffer(from: OfferState, to: OfferState): boolean {
  return VALID_OFFER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canDriverGoOnline(status: DriverApplicationStatus): boolean {
  return status === 'approved';
}

export function transitionRideState(
  ride: RideRequest,
  nextState: RideState,
  patch: Partial<RideRequest> = {}
): { ok: true; ride: RideRequest } | { ok: false; error: string } {
  if (!canTransitionRide(ride.state, nextState)) {
    return {
      ok: false,
      error: `لا يمكن الانتقال من حالة "${getRideStateLabel(ride.state)}" إلى "${getRideStateLabel(nextState)}".`,
    };
  }
  return {
    ok: true,
    ride: {
      ...ride,
      ...patch,
      state: nextState,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Single-process demo offer selection helper.
 * Ensures only one valid 'submitted' offer can be chosen when ride is in 'offers_open'
 * within local client state. Does NOT provide cross-device or database atomicity.
 */
export function selectOfferAtomically(
  ride: RideRequest,
  allOffers: DriverOffer[],
  offerId: string,
  now: number = Date.now()
):
  | { ok: true; ride: RideRequest; offers: DriverOffer[]; chosenOffer: DriverOffer }
  | { ok: false; error: string } {
  if (ride.state !== 'offers_open') {
    return { ok: false, error: 'الطلب لم يعد متاحاً لاختيار سائق.' };
  }
  const target = allOffers.find((o) => o.id === offerId && o.rideId === ride.id);
  if (!target) {
    return { ok: false, error: 'العرض غير موجود.' };
  }
  if (target.state !== 'submitted') {
    return { ok: false, error: 'هذا العرض لم يعد متاحاً للاختيار.' };
  }
  if (now >= target.expiresAt) {
    return { ok: false, error: 'انتهت صلاحية هذا العرض.' };
  }

  const updatedOffers = allOffers.map((offer) => {
    if (offer.rideId !== ride.id) return offer;
    if (offer.id === offerId) {
      return { ...offer, state: 'selected' as OfferState };
    }
    if (offer.state === 'submitted') {
      return { ...offer, state: 'rejected' as OfferState };
    }
    return offer;
  });

  const updatedRide: RideRequest = {
    ...ride,
    state: 'driver_selected',
    selectedDriverId: target.driverId,
    selectedOfferId: target.id,
    agreedFareEgp: target.priceEgp,
    driverProgressPct: 0,
    updatedAt: now,
  };

  return { ok: true, ride: updatedRide, offers: updatedOffers, chosenOffer: { ...target, state: 'selected' } };
}

export function normalizeArabicDigits(input: string): string {
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩';
  const easternArabic = '۰۱۲۳۴۵۶۷۸۹';
  return input
    .split('')
    .map((ch) => {
      const idx1 = arabicIndic.indexOf(ch);
      if (idx1 !== -1) return String(idx1);
      const idx2 = easternArabic.indexOf(ch);
      if (idx2 !== -1) return String(idx2);
      return ch;
    })
    .join('');
}

export function validateEgyptianPhone(raw: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const cleaned = normalizeArabicDigits(raw).replace(/[\s\-()]/g, '');
  const withoutPrefix = cleaned.startsWith('+20')
    ? '0' + cleaned.slice(3)
    : cleaned.startsWith('20') && cleaned.length === 12
    ? '0' + cleaned.slice(2)
    : cleaned;

  if (!/^01[0125]\d{8}$/.test(withoutPrefix)) {
    return {
      valid: false,
      normalized: withoutPrefix,
      error: 'أدخل رقم موبايل مصري صحيح مكون من 11 رقم (يبدأ بـ 010 أو 011 أو 012 أو 015).',
    };
  }
  return { valid: true, normalized: withoutPrefix };
}

export function haversineDistanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Number((R * c).toFixed(2));
}

export function isInsideServiceZone(coords: LatLng, zone: ServiceZone): boolean {
  return haversineDistanceKm(coords, zone.center) <= zone.radiusKm;
}

export function calculateSuggestedFare(distanceKm: number, config: FareConfig): number {
  const roadMultiplier = 1.28; // Aswan street winding factor
  const raw = config.baseFareEgp + distanceKm * roadMultiplier * config.perKmEgp;
  const rounded = Math.round(raw / 5) * 5;
  return Math.max(config.minFareEgp, Math.min(config.maxSuggestedEgp, rounded));
}

export function getRideStateLabel(state: RideState): string {
  const labels: Record<RideState, string> = {
    requested: 'تم إرسال الطلب',
    offers_open: 'في انتظار عروض السائقين',
    driver_selected: 'تم اختيار السائق',
    driver_arriving: 'السائق في الطريق إليك',
    driver_arrived: 'السائق وصل لنقطة الركوب',
    in_progress: 'الرحلة جارية',
    completed: 'اكتملت الرحلة',
    cancelled: 'تم إلغاء الرحلة',
    expired: 'انتهت مهلة الطلب',
    no_driver: 'لم يتم العثور على سائقين',
  };
  return labels[state];
}

export function getDriverAppStatusLabel(status: DriverApplicationStatus): string {
  const labels: Record<DriverApplicationStatus, string> = {
    draft: 'مسودة غير مكتملة',
    submitted: 'تم التقديم',
    under_review: 'قيد المراجعة',
    approved: 'مقبول ومفعّل',
    rejected: 'مرفوض',
  };
  return labels[status];
}
