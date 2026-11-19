import { DEMO_IMAGES } from '../data/seedData';
import {
  canDriverGoOnline,
  selectOfferAtomically,
  transitionRideState,
} from '../domain/stateMachine';
import {
  AdminAuditEntry,
  DemoSimulationFlags,
  DemoStoreState,
  DriverApplicationStatus,
  DriverDocument,
  DriverOffer,
  DriverProfile,
  FareConfig,
  MapPoint,
  PassengerProfile,
  RideReport,
  RideRequest,
  ServiceZone,
} from '../domain/types';
import { mapProvider } from '../services/mapProvider';

export interface CreateRideInput {
  pickup: MapPoint;
  destination: MapPoint;
  passengerFareEgp: number;
  notes?: string;
}

export interface ActionResult<T = void> {
  ok: boolean;
  error?: string;
  data?: T;
}

export interface ActionOutcome<T = void> {
  nextState: DemoStoreState;
  result: ActionResult<T>;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function upsertPassengerProfileAction(
  prev: DemoStoreState,
  data: { name: string; phone: string; avatarUrl?: string }
): ActionOutcome {
  const existing = prev.passengers.find((p) => p.phone === data.phone);
  if (existing) {
    const updated = prev.passengers.map((p) =>
      p.id === existing.id
        ? { ...p, name: data.name, avatarUrl: data.avatarUrl ?? p.avatarUrl }
        : p
    );
    return {
      nextState: {
        ...prev,
        passengers: updated,
        activePassengerId: existing.id,
        passengerOnboardingStep: 'done',
      },
      result: { ok: true },
    };
  }
  const newPassenger: PassengerProfile = {
    id: makeId('pass'),
    name: data.name,
    phone: data.phone,
    city: 'أسوان',
    avatarUrl: data.avatarUrl ?? DEMO_IMAGES.passengerAvatar,
    createdAt: new Date().toISOString(),
    totalTrips: 0,
  };
  return {
    nextState: {
      ...prev,
      passengers: [newPassenger, ...prev.passengers],
      activePassengerId: newPassenger.id,
      passengerOnboardingStep: 'done',
    },
    result: { ok: true },
  };
}

export function upsertDriverApplicationAction(
  prev: DemoStoreState,
  data: {
    name: string;
    phone: string;
    vehicleCode: string;
    avatarUrl?: string;
    documents: DriverDocument[];
    submitNow: boolean;
  }
): ActionOutcome {
  const existing = prev.drivers.find((d) => d.phone === data.phone);
  const nextStatus: DriverApplicationStatus = data.submitNow ? 'submitted' : 'draft';
  if (existing) {
    const updated: DriverProfile[] = prev.drivers.map((d) =>
      d.id === existing.id
        ? {
            ...d,
            name: data.name,
            vehicleCode: data.vehicleCode,
            avatarUrl: data.avatarUrl ?? d.avatarUrl,
            documents: data.documents,
            applicationStatus: (d.applicationStatus === 'approved'
              ? 'approved'
              : nextStatus) as DriverApplicationStatus,
            rejectionReason: undefined,
          }
        : d
    );
    return {
      nextState: {
        ...prev,
        drivers: updated,
        activeDriverId: existing.id,
        driverOnboardingStep: data.submitNow ? 'status' : 'profile',
      },
      result: { ok: true },
    };
  }

  const newDriver: DriverProfile = {
    id: makeId('drv'),
    name: data.name,
    phone: data.phone,
    avatarUrl: data.avatarUrl ?? DEMO_IMAGES.driverTarek,
    vehicleType: 'توكتوك',
    vehicleCode: data.vehicleCode,
    applicationStatus: nextStatus,
    documents: data.documents,
    isOnline: false,
    rating: null,
    ratingCount: 0,
    completedTrips: 0,
    estimatedEarningsEgp: 0,
    currentCoords: { lat: 24.093, lng: 32.898 },
    createdAt: new Date().toISOString(),
  };

  return {
    nextState: {
      ...prev,
      drivers: [newDriver, ...prev.drivers],
      activeDriverId: newDriver.id,
      driverOnboardingStep: data.submitNow ? 'status' : 'profile',
    },
    result: { ok: true },
  };
}

export function toggleDriverOnlineAction(prev: DemoStoreState): ActionOutcome {
  const drv = prev.drivers.find((d) => d.id === prev.activeDriverId);
  if (!drv) {
    return { nextState: prev, result: { ok: false, error: 'السائق غير موجود.' } };
  }
  if (!canDriverGoOnline(drv.applicationStatus)) {
    return {
      nextState: prev,
      result: {
        ok: false,
        error: 'لا يمكن تفعيل الاتصال إلا بعد موافقة الإدارة على طلب السائق في وضع الديمو.',
      },
    };
  }
  return {
    nextState: {
      ...prev,
      drivers: prev.drivers.map((d) =>
        d.id === drv.id ? { ...d, isOnline: !d.isOnline } : d
      ),
    },
    result: { ok: true },
  };
}

export function createRideRequestAction(
  prev: DemoStoreState,
  input: CreateRideInput
): ActionOutcome<RideRequest> {
  if (prev.simulationFlags.networkOffline) {
    return {
      nextState: prev,
      result: {
        ok: false,
        error: 'لا يوجد اتصال بالإنترنت (محاكاة وضع عدم الاتصال). أعد تفعيل الشبكة للمتابعة.',
      },
    };
  }

  if (
    input.pickup.name === input.destination.name &&
    Math.abs(input.pickup.coords.lat - input.destination.coords.lat) < 0.0005 &&
    Math.abs(input.pickup.coords.lng - input.destination.coords.lng) < 0.0005
  ) {
    return {
      nextState: prev,
      result: {
        ok: false,
        error: 'نقطة الركوب والوجهة متطابقتان. يرجى اختيار وجهة مختلفة.',
      },
    };
  }

  if (!mapProvider.isWithinZone(input.pickup.coords, prev.serviceZone)) {
    return {
      nextState: prev,
      result: {
        ok: false,
        error: `نقطة الركوب خارج نطاق الخدمة المفعّل (${prev.serviceZone.name}).`,
      },
    };
  }

  if (!mapProvider.isWithinZone(input.destination.coords, prev.serviceZone)) {
    return {
      nextState: prev,
      result: {
        ok: false,
        error: `الوجهة المختارة خارج نطاق الخدمة المفعّل (${prev.serviceZone.name}).`,
      },
    };
  }

  if (input.passengerFareEgp < prev.fareConfig.minFareEgp) {
    return {
      nextState: prev,
      result: {
        ok: false,
        error: `الحد الأدنى للأجرة هو ${prev.fareConfig.minFareEgp} ج.م.`,
      },
    };
  }

  const activePassenger =
    prev.passengers.find((p) => p.id === prev.activePassengerId) ?? prev.passengers[0];
  if (!activePassenger) {
    return { nextState: prev, result: { ok: false, error: 'بيانات الراكب غير موجودة.' } };
  }

  const route = mapProvider.estimateRoute(input.pickup, input.destination);
  const suggestedFareEgp = mapProvider.getSuggestedFare(route.distanceKm, prev.fareConfig);
  const now = Date.now();

  const newRide: RideRequest = {
    id: makeId('ride'),
    passengerId: activePassenger.id,
    passengerName: activePassenger.name,
    passengerPhone: activePassenger.phone,
    pickup: input.pickup,
    destination: input.destination,
    distanceKm: route.distanceKm,
    estimatedMinutes: route.etaMinutes,
    suggestedFareEgp,
    passengerFareEgp: input.passengerFareEgp,
    paymentMethod: 'cash',
    notes: input.notes?.trim() || undefined,
    state: 'requested',
    tripStartOtp: makeOtp(),
    driverProgressPct: 0,
    createdAt: now,
    updatedAt: now,
  };

  return {
    nextState: {
      ...prev,
      rides: [newRide, ...prev.rides],
    },
    result: { ok: true, data: newRide },
  };
}

export function retryRideSearchAction(
  prev: DemoStoreState,
  rideId: string
): ActionOutcome<RideRequest> {
  const oldRide = prev.rides.find((r) => r.id === rideId);
  if (!oldRide) {
    return { nextState: prev, result: { ok: false, error: 'الطلب غير موجود.' } };
  }
  if (!['no_driver', 'expired'].includes(oldRide.state)) {
    return { nextState: prev, result: { ok: false, error: 'لا يمكن إعادة البحث لهذه الحالة.' } };
  }

  const now = Date.now();
  const clonedRide: RideRequest = {
    ...oldRide,
    id: makeId('ride'),
    state: 'requested',
    selectedDriverId: undefined,
    selectedOfferId: undefined,
    agreedFareEgp: undefined,
    driverProgressPct: 0,
    tripStartOtp: makeOtp(),
    createdAt: now,
    updatedAt: now,
  };

  return {
    nextState: {
      ...prev,
      rides: [clonedRide, ...prev.rides],
    },
    result: { ok: true, data: clonedRide },
  };
}

export function chooseDriverOfferAction(
  prev: DemoStoreState,
  rideId: string,
  offerId: string,
  now: number = Date.now()
): ActionOutcome {
  const ride = prev.rides.find((r) => r.id === rideId);
  if (!ride) {
    return { nextState: prev, result: { ok: false, error: 'الرحلة غير موجودة.' } };
  }

  const outcome = selectOfferAtomically(ride, prev.offers, offerId, now);
  if (!outcome.ok) {
    return { nextState: prev, result: { ok: false, error: outcome.error } };
  }

  const arrivingOutcome = transitionRideState(outcome.ride, 'driver_arriving');
  const finalRide = arrivingOutcome.ok ? arrivingOutcome.ride : outcome.ride;

  return {
    nextState: {
      ...prev,
      offers: outcome.offers,
      rides: prev.rides.map((r) => (r.id === rideId ? finalRide : r)),
    },
    result: { ok: true },
  };
}

export function cancelRideAction(
  prev: DemoStoreState,
  rideId: string,
  by: 'passenger' | 'driver' | 'admin',
  reason: string
): ActionOutcome {
  if (by === 'admin' && !reason.trim()) {
    return {
      nextState: prev,
      result: { ok: false, error: 'سبب الإلغاء إلزامي عند الإلغاء الإداري.' },
    };
  }
  const ride = prev.rides.find((r) => r.id === rideId);
  if (!ride) {
    return { nextState: prev, result: { ok: false, error: 'الرحلة غير موجودة.' } };
  }
  const res = transitionRideState(ride, 'cancelled', {
    cancelReason: reason.trim() || 'إلغاء من المستخدم',
    cancelledBy: by,
  });
  if (!res.ok) {
    return { nextState: prev, result: { ok: false, error: res.error } };
  }

  const updatedOffers = prev.offers.map((o) =>
    o.rideId === rideId && o.state === 'submitted'
      ? { ...o, state: 'withdrawn' as const }
      : o
  );
  const newAudit: AdminAuditEntry[] =
    by === 'admin'
      ? [
          {
            id: makeId('aud'),
            action: 'إلغاء رحلة يدوياً',
            targetId: rideId,
            details: `السبب: ${reason.trim()}`,
            timestamp: new Date().toISOString(),
          },
          ...prev.auditLogs,
        ]
      : prev.auditLogs;

  return {
    nextState: {
      ...prev,
      rides: prev.rides.map((r) => (r.id === rideId ? res.ride : r)),
      offers: updatedOffers,
      auditLogs: newAudit,
    },
    result: { ok: true },
  };
}

export function submitDriverOfferAction(
  prev: DemoStoreState,
  rideId: string,
  driverId: string,
  priceEgp: number,
  isCounterOffer: boolean,
  now: number = Date.now()
): ActionOutcome<DriverOffer> {
  const ride = prev.rides.find((r) => r.id === rideId);
  const driver = prev.drivers.find((d) => d.id === driverId);
  if (!ride || !driver) {
    return { nextState: prev, result: { ok: false, error: 'الطلب أو السائق غير موجود.' } };
  }
  if (!canDriverGoOnline(driver.applicationStatus) || !driver.isOnline) {
    return {
      nextState: prev,
      result: { ok: false, error: 'يجب أن يكون السائق معتمداً ومتصلاً لتقديم عرض.' },
    };
  }
  if (ride.state !== 'offers_open' && ride.state !== 'requested') {
    return {
      nextState: prev,
      result: { ok: false, error: 'هذا الطلب لم يعد يستقبل عروضاً.' },
    };
  }
  if (priceEgp < prev.fareConfig.minFareEgp) {
    return {
      nextState: prev,
      result: { ok: false, error: `الحد الأدنى للأجرة ${prev.fareConfig.minFareEgp} ج.م.` },
    };
  }

  const lifetimeMs =
    (prev.simulationFlags.fastOfferExpiry ? 14 : prev.fareConfig.offerLifetimeSeconds) * 1000;

  const newOffer: DriverOffer = {
    id: makeId('off'),
    rideId,
    driverId: driver.id,
    driverName: driver.name,
    driverAvatarUrl: driver.avatarUrl,
    driverRating: driver.rating,
    driverTripCount: driver.completedTrips,
    vehicleCode: driver.vehicleCode,
    priceEgp,
    etaMinutes: 3,
    state: 'submitted',
    isCounterOffer,
    isSimulated: false,
    createdAt: now,
    expiresAt: now + lifetimeMs,
  };

  return {
    nextState: {
      ...prev,
      rides: prev.rides.map((r) =>
        r.id === rideId && r.state === 'requested'
          ? { ...r, state: 'offers_open', updatedAt: now }
          : r
      ),
      offers: [
        newOffer,
        ...prev.offers.filter(
          (o) => !(o.rideId === rideId && o.driverId === driver.id && o.state === 'submitted')
        ),
      ],
    },
    result: { ok: true, data: newOffer },
  };
}

export function withdrawDriverOfferAction(
  prev: DemoStoreState,
  offerId: string
): ActionOutcome {
  const offer = prev.offers.find((o) => o.id === offerId);
  if (!offer) {
    return { nextState: prev, result: { ok: false, error: 'العرض غير موجود.' } };
  }
  if (offer.state !== 'submitted') {
    return {
      nextState: prev,
      result: { ok: false, error: 'لا يمكن سحب عرض لم يعد في حالة التقديم.' },
    };
  }
  return {
    nextState: {
      ...prev,
      offers: prev.offers.map((o) =>
        o.id === offerId ? { ...o, state: 'withdrawn' as const } : o
      ),
    },
    result: { ok: true },
  };
}

export function markDriverArrivingAction(
  prev: DemoStoreState,
  rideId: string
): ActionOutcome {
  const ride = prev.rides.find((r) => r.id === rideId);
  if (!ride) {
    return { nextState: prev, result: { ok: false, error: 'الرحلة غير موجودة.' } };
  }
  const res = transitionRideState(ride, 'driver_arriving');
  if (!res.ok) {
    return { nextState: prev, result: { ok: false, error: res.error } };
  }
  return {
    nextState: {
      ...prev,
      rides: prev.rides.map((r) => (r.id === rideId ? res.ride : r)),
    },
    result: { ok: true },
  };
}

export function markDriverArrivedAction(
  prev: DemoStoreState,
  rideId: string
): ActionOutcome {
  const ride = prev.rides.find((r) => r.id === rideId);
  if (!ride) {
    return { nextState: prev, result: { ok: false, error: 'الرحلة غير موجودة.' } };
  }
  const res = transitionRideState(ride, 'driver_arrived', { driverProgressPct: 100 });
  if (!res.ok) {
    return { nextState: prev, result: { ok: false, error: res.error } };
  }
  return {
    nextState: {
      ...prev,
      rides: prev.rides.map((r) => (r.id === rideId ? res.ride : r)),
    },
    result: { ok: true },
  };
}

export function startRideWithOtpAction(
  prev: DemoStoreState,
  rideId: string,
  otpInput: string
): ActionOutcome {
  const ride = prev.rides.find((r) => r.id === rideId);
  if (!ride) {
    return { nextState: prev, result: { ok: false, error: 'الرحلة غير موجودة.' } };
  }
  if (ride.state !== 'driver_arrived') {
    return {
      nextState: prev,
      result: { ok: false, error: 'يجب تأكيد الوصول لنقطة الركوب أولاً قبل بدء الرحلة.' },
    };
  }
  if (otpInput.trim() !== ride.tripStartOtp) {
    return {
      nextState: prev,
      result: {
        ok: false,
        error: 'رمز بدء الرحلة غير صحيح. اطلب الرمز الظاهر على شاشة الراكب.',
      },
    };
  }
  const res = transitionRideState(ride, 'in_progress', { driverProgressPct: 10 });
  if (!res.ok) {
    return { nextState: prev, result: { ok: false, error: res.error } };
  }
  return {
    nextState: {
      ...prev,
      rides: prev.rides.map((r) => (r.id === rideId ? res.ride : r)),
    },
    result: { ok: true },
  };
}

export function completeRideAction(prev: DemoStoreState, rideId: string): ActionOutcome {
  const ride = prev.rides.find((r) => r.id === rideId);
  if (!ride) {
    return { nextState: prev, result: { ok: false, error: 'الرحلة غير موجودة.' } };
  }
  const res = transitionRideState(ride, 'completed', { driverProgressPct: 100 });
  if (!res.ok) {
    return { nextState: prev, result: { ok: false, error: res.error } };
  }
  const fare = ride.agreedFareEgp ?? ride.passengerFareEgp;
  return {
    nextState: {
      ...prev,
      rides: prev.rides.map((r) => (r.id === rideId ? res.ride : r)),
      drivers: prev.drivers.map((d) =>
        d.id === ride.selectedDriverId
          ? {
              ...d,
              completedTrips: d.completedTrips + 1,
              estimatedEarningsEgp: d.estimatedEarningsEgp + fare,
            }
          : d
      ),
      passengers: prev.passengers.map((p) =>
        p.id === ride.passengerId ? { ...p, totalTrips: p.totalTrips + 1 } : p
      ),
    },
    result: { ok: true },
  };
}

export function rateRideAction(
  prev: DemoStoreState,
  rideId: string,
  stars: number,
  reason?: string
): ActionOutcome {
  if (stars < 1 || stars > 5) {
    return { nextState: prev, result: { ok: false, error: 'اختر تقييماً من 1 إلى 5 نجوم.' } };
  }
  const ride = prev.rides.find((r) => r.id === rideId);
  if (!ride) {
    return { nextState: prev, result: { ok: false, error: 'الرحلة غير موجودة.' } };
  }
  if (ride.state !== 'completed') {
    return { nextState: prev, result: { ok: false, error: 'لا يمكن تقييم رحلة غير مكتملة.' } };
  }
  if (ride.rating) {
    return { nextState: prev, result: { ok: false, error: 'تم تقييم هذه الرحلة مسبقاً.' } };
  }
  const updatedDrivers = prev.drivers.map((d) => {
    if (d.id !== ride.selectedDriverId) return d;
    const count = d.ratingCount + 1;
    const total = (d.rating ?? 0) * d.ratingCount + stars;
    return {
      ...d,
      ratingCount: count,
      rating: Number((total / count).toFixed(1)),
    };
  });
  return {
    nextState: {
      ...prev,
      drivers: updatedDrivers,
      rides: prev.rides.map((r) =>
        r.id === rideId
          ? {
              ...r,
              rating: {
                stars,
                reason: reason?.trim() || undefined,
                submittedAt: new Date().toISOString(),
              },
            }
          : r
      ),
    },
    result: { ok: true },
  };
}

export function submitRideReportAction(
  prev: DemoStoreState,
  data: {
    rideId: string;
    reporterRole: 'passenger' | 'driver';
    category: string;
    details: string;
  }
): ActionOutcome {
  if (!data.details.trim()) {
    return { nextState: prev, result: { ok: false, error: 'اكتب وصفاً مختصراً للمشكلة.' } };
  }
  const activePassenger =
    prev.passengers.find((p) => p.id === prev.activePassengerId) ?? prev.passengers[0];
  const activeDriver =
    prev.drivers.find((d) => d.id === prev.activeDriverId) ?? prev.drivers[0];
  const reporterName =
    data.reporterRole === 'passenger'
      ? activePassenger?.name ?? 'راكب'
      : activeDriver?.name ?? 'سائق';

  const newReport: RideReport = {
    id: makeId('rep'),
    rideId: data.rideId,
    reporterRole: data.reporterRole,
    reporterName,
    category: data.category,
    details: data.details.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  return {
    nextState: {
      ...prev,
      reports: [newReport, ...prev.reports],
    },
    result: { ok: true },
  };
}

export function adminUpdateDriverStatusAction(
  prev: DemoStoreState,
  driverId: string,
  status: DriverApplicationStatus,
  rejectionReason?: string
): ActionOutcome {
  if (status === 'rejected' && !rejectionReason?.trim()) {
    return {
      nextState: prev,
      result: { ok: false, error: 'يرجى كتابة سبب الرفض ليظهر للسائق.' },
    };
  }
  const drv = prev.drivers.find((d) => d.id === driverId);
  if (!drv) {
    return { nextState: prev, result: { ok: false, error: 'السائق غير موجود.' } };
  }
  const logEntry: AdminAuditEntry = {
    id: makeId('aud'),
    action:
      status === 'approved'
        ? 'موافقة على سائق'
        : status === 'rejected'
        ? 'رفض طلب سائق'
        : 'تحديث مراجعة سائق',
    targetId: driverId,
    details: `${drv.name} (${drv.vehicleCode})${
      rejectionReason ? ` · السبب: ${rejectionReason}` : ''
    }`,
    timestamp: new Date().toISOString(),
  };
  return {
    nextState: {
      ...prev,
      drivers: prev.drivers.map((d) =>
        d.id === driverId
          ? {
              ...d,
              applicationStatus: status,
              isOnline: status === 'approved' ? d.isOnline : false,
              rejectionReason: status === 'rejected' ? rejectionReason : undefined,
            }
          : d
      ),
      auditLogs: [logEntry, ...prev.auditLogs],
    },
    result: { ok: true },
  };
}

export function adminUpdateServiceConfigAction(
  prev: DemoStoreState,
  zone: ServiceZone,
  fare: FareConfig
): ActionOutcome {
  if (zone.radiusKm < 1 || fare.minFareEgp < 5) {
    return {
      nextState: prev,
      result: { ok: false, error: 'تحقق من صحة قيم النطاق والتسعير.' },
    };
  }
  return {
    nextState: {
      ...prev,
      serviceZone: zone,
      fareConfig: fare,
      auditLogs: [
        {
          id: makeId('aud'),
          action: 'تحديث إعدادات النطاق والتسعير',
          targetId: zone.id,
          details: `نصف القطر ${zone.radiusKm} كم · الحد الأدنى ${fare.minFareEgp} ج.م · لكل كم ${fare.perKmEgp} ج.م`,
          timestamp: new Date().toISOString(),
        },
        ...prev.auditLogs,
      ],
    },
    result: { ok: true },
  };
}

export function adminResolveReportAction(
  prev: DemoStoreState,
  reportId: string
): ActionOutcome {
  const report = prev.reports.find((r) => r.id === reportId);
  if (!report) {
    return { nextState: prev, result: { ok: false, error: 'البلاغ غير موجود.' } };
  }
  return {
    nextState: {
      ...prev,
      reports: prev.reports.map((r) =>
        r.id === reportId ? { ...r, status: 'reviewed' } : r
      ),
      auditLogs: [
        {
          id: makeId('aud'),
          action: 'مراجعة بلاغ رحلة',
          targetId: reportId,
          details: 'تم إغلاق البلاغ بعد المراجعة التجريبية.',
          timestamp: new Date().toISOString(),
        },
        ...prev.auditLogs,
      ],
    },
    result: { ok: true },
  };
}

export function updateSimulationFlagsAction(
  prev: DemoStoreState,
  patch: Partial<DemoSimulationFlags>
): DemoStoreState {
  return {
    ...prev,
    simulationFlags: { ...prev.simulationFlags, ...patch },
  };
}
