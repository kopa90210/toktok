import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Clock,
  Flag,
  History,
  Loader2,
  MapPin,
  Minus,
  Navigation,
  PhoneCall,
  Plus,
  RefreshCw,
  Share2,
  ShieldAlert,
  Star,
  X,
} from 'lucide-react';
import {
  getRideStateLabel,
  normalizeArabicDigits,
} from '../../domain/stateMachine';
import { Landmark, MapPoint, RideRequest } from '../../domain/types';
import { ASWAN_SAMPLE_LANDMARKS, mapProvider } from '../../services/mapProvider';
import { useDemoStore } from '../../store/DemoStoreContext';
import { AswanInteractiveMap } from '../AswanInteractiveMap';
import { AvatarWithFallback } from '../AvatarWithFallback';

interface PassengerHomeAndRideProps {
  onOpenConfigGuide: () => void;
}

export const PassengerHomeAndRide: React.FC<PassengerHomeAndRideProps> = ({
  onOpenConfigGuide,
}) => {
  const {
    state,
    activePassenger,
    activePassengerRide,
    createRideRequest,
    retryRideSearch,
    chooseDriverOffer,
    cancelRide,
    rateRide,
    submitRideReport,
    setActiveRole,
  } = useDemoStore();

  const [subTab, setSubTab] = useState<'ride' | 'history'>('ride');

  // Home route selection state
  const [pickup, setPickup] = useState<MapPoint>(ASWAN_SAMPLE_LANDMARKS[0]);
  const [destination, setDestination] = useState<MapPoint>(ASWAN_SAMPLE_LANDMARKS[2]);
  const [pickupQuery, setPickupQuery] = useState(ASWAN_SAMPLE_LANDMARKS[0].name);
  const [destQuery, setDestQuery] = useState(ASWAN_SAMPLE_LANDMARKS[2].name);
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDestSuggestions, setShowDestSuggestions] = useState(false);
  const [pickMode, setPickMode] = useState<'none' | 'pickup' | 'destination'>('none');

  const [locating, setLocating] = useState(false);
  const [locationAlert, setLocationAlert] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [submittingRide, setSubmittingRide] = useState(false);

  const routeEstimate = useMemo(
    () => mapProvider.estimateRoute(pickup, destination),
    [pickup, destination]
  );

  const suggestedFare = useMemo(
    () => mapProvider.getSuggestedFare(routeEstimate.distanceKm, state.fareConfig),
    [routeEstimate.distanceKm, state.fareConfig]
  );

  const [fareInput, setFareInput] = useState<number>(suggestedFare);
  const [fareTouched, setFareTouched] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!fareTouched) {
      setFareInput(suggestedFare);
    }
  }, [suggestedFare, fareTouched]);

  // Live countdown ticker for offer expiry UI
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Rating / Report / Prototype action feedback
  const [lastCompletedToRate, setLastCompletedToRate] = useState<string | null>(null);
  const [stars, setStars] = useState(5);
  const [ratingReason, setRatingReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportRideId, setReportRideId] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState('مشكلة في الأجرة أو المسار');
  const [reportDetails, setReportDetails] = useState('');
  const [protoNotice, setProtoNotice] = useState<string | null>(null);

  // Detect newly completed ride for active passenger that hasn't been rated yet
  const unratedCompletedRide: RideRequest | undefined = useMemo(() => {
    return state.rides
      .filter(
        (r) =>
          r.passengerId === activePassenger.id &&
          r.state === 'completed' &&
          !r.rating &&
          r.id !== lastCompletedToRate
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];
  }, [activePassenger.id, lastCompletedToRate, state.rides]);

  const passengerHistory = useMemo(
    () =>
      state.rides
        .filter((r) => r.passengerId === activePassenger.id)
        .sort((a, b) => b.createdAt - a.createdAt),
    [activePassenger.id, state.rides]
  );

  const handleLocateMe = async () => {
    setLocating(true);
    setLocationAlert(null);
    const res = await mapProvider.getCurrentLocation({
      permissionDenied: state.simulationFlags.locationPermissionDenied,
      gpsUnavailable: state.simulationFlags.gpsUnavailable,
    });
    setLocating(false);
    if (!res.ok) {
      setLocationAlert(res.message);
      return;
    }
    setPickup(res.point);
    setPickupQuery(res.point.name);
    setShowPickupSuggestions(false);
  };

  const handleSelectLandmark = (target: 'pickup' | 'destination', lm: Landmark) => {
    if (target === 'pickup') {
      setPickup(lm);
      setPickupQuery(lm.name);
      setShowPickupSuggestions(false);
    } else {
      setDestination(lm);
      setDestQuery(lm.name);
      setShowDestSuggestions(false);
    }
    setFareTouched(false);
    setRequestError(null);
  };

  const handleMapSelectPoint = (point: MapPoint) => {
    if (pickMode === 'pickup') {
      setPickup(point);
      setPickupQuery(point.name);
    } else if (pickMode === 'destination') {
      setDestination(point);
      setDestQuery(point.name);
    }
    setPickMode('none');
    setFareTouched(false);
    setRequestError(null);
  };

  const handleCreateRide = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    setSubmittingRide(true);
    await new Promise((r) => setTimeout(r, 300));
    const res = createRideRequest({
      pickup,
      destination,
      passengerFareEgp: fareInput,
      notes,
    });
    setSubmittingRide(false);
    if (!res.ok) {
      setRequestError(res.error ?? 'تعذر إنشاء الطلب.');
      return;
    }
    setNotes('');
    setFareTouched(false);
  };

  const handleOpenReport = (rideId: string) => {
    setReportRideId(rideId);
    setReportDetails('');
    setShowReportModal(true);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportRideId) return;
    const res = submitRideReport({
      rideId: reportRideId,
      reporterRole: 'passenger',
      category: reportCategory,
      details: reportDetails,
    });
    if (res.ok) {
      setShowReportModal(false);
      setProtoNotice('تم حفظ البلاغ التجريبي وإرساله للوحة الإدارة للمراجعة.');
    }
  };

  // Offers for active ride
  const rideOffers = useMemo(() => {
    if (!activePassengerRide) return [];
    return state.offers
      .filter((o) => o.rideId === activePassengerRide.id)
      .sort((a, b) => a.priceEgp - b.priceEgp);
  }, [activePassengerRide, state.offers]);

  const selectedDriverDisplay = useMemo(() => {
    if (!activePassengerRide?.selectedDriverId) return null;
    const drv = state.drivers.find((d) => d.id === activePassengerRide.selectedDriverId);
    if (drv) {
      return {
        name: drv.name,
        avatarUrl: drv.avatarUrl,
        vehicleCode: drv.vehicleCode,
        rating: drv.rating,
      };
    }
    const off = rideOffers.find((o) => o.driverId === activePassengerRide.selectedDriverId);
    if (off) {
      return {
        name: off.driverName,
        avatarUrl: off.driverAvatarUrl,
        vehicleCode: off.vehicleCode,
        rating: off.driverRating,
      };
    }
    return null;
  }, [activePassengerRide, rideOffers, state.drivers]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 lg:py-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-xl">
          <button
            type="button"
            onClick={() => setSubTab('ride')}
            className={`min-h-[40px] px-4 py-1.5 text-sm font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              subTab === 'ride'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            طلب توكتوك
          </button>
          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`min-h-[40px] px-4 py-1.5 text-sm font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              subTab === 'history'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل الرحلات ({passengerHistory.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-600 flex items-center gap-2">
          <span>الراكب: <strong className="text-slate-900">{activePassenger.name}</strong></span>
          <span aria-hidden="true">·</span>
          <span>أسوان</span>
        </div>
      </div>

      {protoNotice && (
        <div className="mb-4 bg-teal-50 border border-teal-200 text-teal-950 rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3">
          <span>{protoNotice}</span>
          <button
            type="button"
            onClick={() => setProtoNotice(null)}
            className="text-teal-800 hover:text-teal-950 p-1"
            aria-label="إغلاق التنبيه"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {subTab === 'history' ? (
        <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3">
            <h2 className="text-lg font-bold text-slate-900">سجل رحلاتك السابقة</h2>
            <span className="text-xs text-slate-500">بيانات تجريبية محفوظة محلياً</span>
          </div>

          {passengerHistory.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">
              لا توجد رحلات مسجلة بعد. ابدأ بطلب أول توكتوك من الخريطة.
            </p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {passengerHistory.map((ride) => (
                <div key={ride.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-bold text-slate-800">{getRideStateLabel(ride.state)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{new Date(ride.createdAt).toLocaleString('ar-EG')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{ride.distanceKm} كم</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      من {ride.pickup.name} ← إلى {ride.destination.name}
                    </p>
                    {ride.rating && (
                      <p className="text-xs text-amber-700 flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>تقييمك: {ride.rating.stars} / 5</span>
                        {ride.rating.reason && <span>— {ride.rating.reason}</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-left">
                      <div className="text-base font-extrabold text-slate-900 tabular-nums">
                        {ride.agreedFareEgp ?? ride.passengerFareEgp} ج.م
                      </div>
                      <div className="text-[11px] text-slate-500">كاش</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenReport(ride.id)}
                      className="min-h-[40px] px-3 py-1.5 text-xs font-semibold border border-[#E5E1D8] rounded-xl text-slate-700 hover:bg-stone-50 flex items-center gap-1"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>إبلاغ</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Map column (Map-first on mobile top, full height left/right on desktop) */}
          <div className="lg:col-span-7 min-h-[290px] lg:min-h-[600px]">
            <AswanInteractiveMap
              pickup={pickup}
              destination={destination}
              activeRide={activePassengerRide}
              drivers={state.drivers}
              serviceZone={state.serviceZone}
              pickMode={pickMode}
              onMapSelectPoint={handleMapSelectPoint}
              onLocateMe={activePassengerRide ? undefined : handleLocateMe}
              locating={locating}
              onOpenConfigGuide={onOpenConfigGuide}
              heightClass="h-[290px] sm:h-[340px] lg:h-full"
            />
          </div>

          {/* Control / Flow sheet column */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Unrated just-completed ride summary & rating card */}
            {!activePassengerRide && unratedCompletedRide && (
              <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-[#EFECE4] pb-3">
                  <div>
                    <p className="text-xs text-teal-800 font-bold">وصلت بالسلامة</p>
                    <h2 className="text-lg font-extrabold text-slate-900">ملخص الرحلة والتقييم</h2>
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                      {unratedCompletedRide.agreedFareEgp ?? unratedCompletedRide.passengerFareEgp} ج.م
                    </div>
                    <div className="text-xs text-slate-500">الدفع نقداً (كاش)</div>
                  </div>
                </div>

                <p className="text-sm text-slate-700">
                  من <strong>{unratedCompletedRide.pickup.name}</strong> إلى{' '}
                  <strong>{unratedCompletedRide.destination.name}</strong>
                </p>

                <div className="space-y-2">
                  <span className="block text-sm font-semibold text-slate-800">قيّم السائق</span>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setStars(n)}
                        aria-label={`${n} نجوم`}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E5E1D8] hover:bg-amber-50"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            n <= stars ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="rate-reason" className="block text-xs font-semibold text-slate-700">
                    ملاحظة اختيارية (مثلاً: التزام بالموعد، أسلوب لطيف)
                  </label>
                  <input
                    id="rate-reason"
                    type="text"
                    value={ratingReason}
                    onChange={(e) => setRatingReason(e.target.value)}
                    placeholder="اكتب رأيك باختصار..."
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      rateRide(unratedCompletedRide.id, stars, ratingReason);
                      setLastCompletedToRate(unratedCompletedRide.id);
                      setRatingReason('');
                      setProtoNotice('شكراً لتقييمك! تم تحديث تقييم السائق في الديمو.');
                    }}
                    className="flex-1 min-h-[48px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl px-4 py-2.5 text-sm"
                  >
                    إرسال التقييم
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenReport(unratedCompletedRide.id)}
                    className="min-h-[48px] px-4 py-2.5 border border-red-200 text-red-700 hover:bg-red-50 font-semibold rounded-xl text-sm flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Flag className="w-4 h-4" />
                    <span>الإبلاغ عن مشكلة</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1. No active ride: Request builder */}
            {!activePassengerRide && (
              <form
                onSubmit={handleCreateRide}
                className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-extrabold text-slate-900">اطلب توكتوك الآن</h2>
                  <span className="text-xs text-slate-500">محاكاة التفاوض المباشر</span>
                </div>

                {locationAlert && (
                  <div
                    role="alert"
                    className="bg-amber-50 border border-amber-200 text-amber-950 rounded-xl p-3 text-xs flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <span>{locationAlert}</span>
                  </div>
                )}

                {state.simulationFlags.networkOffline && (
                  <div
                    role="alert"
                    className="bg-red-50 border border-red-200 text-red-900 rounded-xl p-3 text-xs font-medium"
                  >
                    لا يوجد اتصال بالإنترنت (وضع المحاكاة). أعد تفعيل الشبكة من إعدادات الاختبار بالأسفل أو الأعلى.
                  </div>
                )}

                {/* Pickup */}
                <div className="relative space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="pickup-input" className="text-xs font-bold text-slate-700">
                      نقطة الركوب
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPickMode((m) => (m === 'pickup' ? 'none' : 'pickup'))
                      }
                      className={`text-xs font-semibold underline underline-offset-2 ${
                        pickMode === 'pickup' ? 'text-teal-800' : 'text-slate-600'
                      }`}
                    >
                      {pickMode === 'pickup' ? 'إلغاء تحديد الخريطة' : 'تحديد بدبوس على الخريطة'}
                    </button>
                  </div>

                  <div className="relative flex items-center">
                    <MapPin className="w-4 h-4 text-teal-700 absolute right-3 pointer-events-none" />
                    <input
                      id="pickup-input"
                      type="text"
                      value={pickupQuery}
                      onFocus={() => {
                        setShowPickupSuggestions(true);
                        setShowDestSuggestions(false);
                      }}
                      onChange={(e) => {
                        setPickupQuery(e.target.value);
                        setShowPickupSuggestions(true);
                      }}
                      placeholder="ابحث عن معلم تجريبي في أسوان..."
                      className="w-full min-h-[46px] pr-9 pl-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  {showPickupSuggestions && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D8D3C8] rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-[#EFECE4]">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 bg-stone-50">
                        معالم تجريبية في أسوان (بيانات ديمو)
                      </div>
                      {mapProvider.searchLandmarks(pickupQuery).map((lm) => (
                        <button
                          key={lm.id}
                          type="button"
                          onClick={() => handleSelectLandmark('pickup', lm)}
                          className="w-full text-right px-3 py-2.5 hover:bg-teal-50 flex flex-col gap-0.5"
                        >
                          <span className="text-sm font-semibold text-slate-900">{lm.name}</span>
                          <span className="text-[11px] text-slate-500">{lm.area}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Destination */}
                <div className="relative space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="dest-input" className="text-xs font-bold text-slate-700">
                      الوجهة المطلوبة
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setPickMode((m) => (m === 'destination' ? 'none' : 'destination'))
                      }
                      className={`text-xs font-semibold underline underline-offset-2 ${
                        pickMode === 'destination' ? 'text-amber-700' : 'text-slate-600'
                      }`}
                    >
                      {pickMode === 'destination' ? 'إلغاء تحديد الخريطة' : 'تحديد بدبوس على الخريطة'}
                    </button>
                  </div>

                  <div className="relative flex items-center">
                    <Navigation className="w-4 h-4 text-amber-600 absolute right-3 pointer-events-none" />
                    <input
                      id="dest-input"
                      type="text"
                      value={destQuery}
                      onFocus={() => {
                        setShowDestSuggestions(true);
                        setShowPickupSuggestions(false);
                      }}
                      onChange={(e) => {
                        setDestQuery(e.target.value);
                        setShowDestSuggestions(true);
                      }}
                      placeholder="رايح على فين؟"
                      className="w-full min-h-[46px] pr-9 pl-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  {showDestSuggestions && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-[#D8D3C8] rounded-xl shadow-lg max-h-52 overflow-y-auto divide-y divide-[#EFECE4]">
                      <div className="px-3 py-1.5 text-[11px] font-bold text-slate-500 bg-stone-50">
                        معالم تجريبية في أسوان (بيانات ديمو)
                      </div>
                      {mapProvider.searchLandmarks(destQuery).map((lm) => (
                        <button
                          key={lm.id}
                          type="button"
                          onClick={() => handleSelectLandmark('destination', lm)}
                          className="w-full text-right px-3 py-2.5 hover:bg-amber-50 flex flex-col gap-0.5"
                        >
                          <span className="text-sm font-semibold text-slate-900">{lm.name}</span>
                          <span className="text-[11px] text-slate-500">{lm.area}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Simulated route estimate */}
                <div className="bg-[#F6F4EE] border border-[#E5E1D8] rounded-xl px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 tabular-nums">
                      {routeEstimate.distanceKm} كم
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">حوالي {routeEstimate.etaMinutes} دقيقة</span>
                  </div>
                  <span className="text-[11px] text-slate-500">تقدير محاكاة</span>
                </div>

                {/* Suggested & editable fare */}
                <div className="border-t border-[#EFECE4] pt-3 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-slate-800">أجرتك المقترحة</span>
                    <span className="text-xs text-slate-600 tabular-nums">
                      سعر استرشادي: <strong>{suggestedFare} ج.م</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFareTouched(true);
                        setFareInput((v) => Math.max(state.fareConfig.minFareEgp, v - 5));
                      }}
                      aria-label="تقليل الأجرة 5 جنيه"
                      className="min-h-[48px] min-w-[48px] rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] hover:bg-stone-100 flex items-center justify-center text-slate-800"
                    >
                      <Minus className="w-4 h-4" />
                    </button>

                    <div className="flex-1 relative flex items-center">
                      <input
                        type="number"
                        min={state.fareConfig.minFareEgp}
                        max={500}
                        value={fareInput}
                        onChange={(e) => {
                          setFareTouched(true);
                          setFareInput(Number(normalizeArabicDigits(e.target.value)) || 0);
                        }}
                        aria-label="قيمة الأجرة بالجنيه المصري"
                        className="w-full min-h-[48px] px-4 rounded-xl border border-[#D8D3C8] bg-white text-center font-mono-num text-xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                      />
                      <span className="absolute left-3 text-xs font-bold text-slate-500">ج.م</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setFareTouched(true);
                        setFareInput((v) => v + 5);
                      }}
                      aria-label="زيادة الأجرة 5 جنيه"
                      className="min-h-[48px] min-w-[48px] rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] hover:bg-stone-100 flex items-center justify-center text-slate-800"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Notes & cash payment */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="ملاحظات للسائق (اختياري: معي شنط، أمام بوابة...)"
                    className="w-full min-h-[44px] px-3.5 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />

                  <div className="flex items-center justify-between text-xs text-slate-600 px-1">
                    <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                      <Banknote className="w-4 h-4 text-teal-700" />
                      طريقة الدفع: الدفع نقداً (كاش) للسائق
                    </span>
                    <span className="text-slate-500">الحد الأدنى {state.fareConfig.minFareEgp} ج.م</span>
                  </div>
                </div>

                {requestError && (
                  <div
                    role="alert"
                    className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-xs font-semibold"
                  >
                    {requestError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingRide}
                  className="w-full min-h-[50px] bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold text-base rounded-xl px-5 py-3 flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  {submittingRide && <Loader2 className="w-5 h-5 animate-spin" />}
                  <span>ابحث عن توكتوك</span>
                </button>
              </form>
            )}

            {/* 2. Searching & Driver Offers */}
            {activePassengerRide &&
              ['requested', 'offers_open', 'no_driver', 'expired'].includes(
                activePassengerRide.state
              ) && (
                <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-[#EFECE4] pb-3">
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">
                        {activePassengerRide.state === 'no_driver'
                          ? 'لم يتم العثور على سائقين'
                          : activePassengerRide.state === 'expired'
                          ? 'انتهت مهلة العروض'
                          : 'جارٍ البحث عن سائقين'}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        أجرتك المعروضة:{' '}
                        <strong className="tabular-nums text-slate-900">
                          {activePassengerRide.passengerFareEgp} ج.م
                        </strong>{' '}
                        · {activePassengerRide.pickup.name} ← {activePassengerRide.destination.name}
                      </p>
                    </div>
                    {(activePassengerRide.state === 'requested' ||
                      activePassengerRide.state === 'offers_open') && (
                      <Loader2 className="w-5 h-5 text-teal-700 animate-spin shrink-0 mt-1" />
                    )}
                  </div>

                  {/* Explicit simulation disclosure */}
                  <div className="bg-stone-50 border border-[#E5E1D8] rounded-xl p-3 text-xs text-slate-600 leading-relaxed">
                    عروض السائقين الظاهرة بالأسفل <strong>محاكاة تجريبية</strong>. لاختبار التفاوض الحقيقي داخل النموذج، يمكنك التبديل إلى دور <strong>السائق</strong> من الأعلى لتقديم عرض مضاد وسيظهر هنا فوراً.
                  </div>

                  {/* Error / Empty states */}
                  {(activePassengerRide.state === 'no_driver' ||
                    activePassengerRide.state === 'expired') && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3 text-sm text-amber-950">
                      <p className="font-semibold">
                        {activePassengerRide.state === 'no_driver'
                          ? 'لا يوجد سائقون متاحون حالياً لهذه الأجرة أو تم تفعيل محاكاة عدم وجود سائقين.'
                          : 'انتهت صلاحية جميع العروض الواردة قبل اختيار سائق.'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => retryRideSearch(activePassengerRide.id)}
                          className="min-h-[44px] px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span>إعادة البحث عن سائقين</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            cancelRide(activePassengerRide.id, 'passenger', 'تعديل الطلب')
                          }
                          className="min-h-[44px] px-4 py-2 border border-stone-300 bg-white text-slate-800 font-semibold rounded-xl text-xs"
                        >
                          رجوع لتعديل الأجرة
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Incoming offers list */}
                  {rideOffers.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>العروض الواردة ({rideOffers.length})</span>
                        <span>محاكاة محلية · يتطلب قاعدة بيانات للتزامن الفعلي</span>
                      </div>

                      {rideOffers.map((offer) => {
                        const secsLeft = Math.max(0, Math.ceil((offer.expiresAt - nowTs) / 1000));
                        const isExpired = offer.state === 'expired' || secsLeft === 0;
                        const isSelectable =
                          offer.state === 'submitted' &&
                          !isExpired &&
                          activePassengerRide.state === 'offers_open';

                        return (
                          <div
                            key={offer.id}
                            className={`border rounded-2xl p-4 space-y-3 transition-colors ${
                              isExpired
                                ? 'bg-stone-50 border-stone-200 opacity-70'
                                : 'bg-white border-[#D8D3C8]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <AvatarWithFallback
                                  src={offer.driverAvatarUrl}
                                  alt={offer.driverName}
                                />
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-slate-900 truncate">
                                    {offer.driverName}
                                  </p>
                                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                                    <span>
                                      {offer.driverRating !== null
                                        ? `${offer.driverRating} ★ (${offer.driverTripCount})`
                                        : 'سائق جديد'}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono-num">{offer.vehicleCode}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="tabular-nums">{offer.etaMinutes} د</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-amber-800 font-semibold">
                                      {offer.isSimulated ? 'عرض تجريبي محاكى' : 'محاكاة وضع السائق'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-left shrink-0">
                                <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                                  {offer.priceEgp} ج.م
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {offer.isCounterOffer ? 'عرض مضاد' : 'وافق على سعرك'}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#F2EFE7]">
                              <span className="text-xs text-slate-600 flex items-center gap-1 tabular-nums">
                                <Clock className="w-3.5 h-3.5" />
                                {isExpired
                                  ? 'انتهت صلاحية العرض'
                                  : `ينتهي خلال ${secsLeft} ثانية`}
                              </span>

                              <button
                                type="button"
                                disabled={!isSelectable}
                                onClick={() => chooseDriverOffer(activePassengerRide.id, offer.id)}
                                className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:bg-stone-300 disabled:text-slate-600 text-white font-bold text-xs transition-colors whitespace-nowrap"
                              >
                                {isExpired ? 'منتهي' : 'اختيار السائق'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(activePassengerRide.state === 'requested' ||
                    activePassengerRide.state === 'offers_open') && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#EFECE4]">
                      <button
                        type="button"
                        onClick={() => setActiveRole('driver')}
                        className="min-h-[42px] px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 rounded-xl"
                      >
                        الرد كسائق (اختبار)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          cancelRide(activePassengerRide.id, 'passenger', 'إلغاء قبل اختيار سائق')
                        }
                        className="min-h-[42px] px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50 border border-red-200 rounded-xl"
                      >
                        إلغاء الطلب
                      </button>
                    </div>
                  )}
                </div>
              )}

            {/* 3. Active Passenger Ride */}
            {activePassengerRide &&
              ['driver_selected', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(
                activePassengerRide.state
              ) && (
                <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-start justify-between gap-3 border-b border-[#EFECE4] pb-3">
                    <div>
                      <p className="text-xs font-bold text-teal-800">
                        حالة الرحلة الحالية
                      </p>
                      <h2 className="text-xl font-extrabold text-slate-900">
                        {getRideStateLabel(activePassengerRide.state)}
                      </h2>
                    </div>
                    <div className="text-left">
                      <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                        {activePassengerRide.agreedFareEgp} ج.م
                      </div>
                      <div className="text-xs text-slate-500">كاش عند الوصول</div>
                    </div>
                  </div>

                  {/* Driver card */}
                  <div className="flex items-center justify-between gap-3 bg-[#FAFAF8] border border-[#E5E1D8] rounded-2xl p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <AvatarWithFallback
                        src={selectedDriverDisplay?.avatarUrl}
                        alt="السائق"
                        sizeClass="w-12 h-12"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {selectedDriverDisplay?.name ?? 'سائق توك أسوان'}
                        </p>
                        <p className="text-xs text-slate-600">
                          توكتوك · رقم المركبة:{' '}
                          <strong className="font-mono-num text-slate-900">
                            {selectedDriverDisplay?.vehicleCode ?? 'أسوان-١٠٤'}
                          </strong>
                        </p>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-amber-800 shrink-0">
                      {selectedDriverDisplay?.rating !== null &&
                      selectedDriverDisplay?.rating !== undefined
                        ? `${selectedDriverDisplay.rating} ★`
                        : 'سائق جديد'}
                    </div>
                  </div>

                  {/* Trip-start OTP */}
                  {activePassengerRide.state !== 'in_progress' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-amber-950">
                          رمز بدء الرحلة (تجريبي)
                        </p>
                        <p className="text-[11px] text-amber-900">
                          أعطِ هذا الرمز للسائق عند ركوبك لتأكيد بدء الرحلة.
                        </p>
                      </div>
                      <div className="font-mono-num text-2xl font-extrabold tracking-widest bg-white border border-amber-300 text-slate-900 px-3.5 py-2 rounded-xl shrink-0">
                        {activePassengerRide.tripStartOtp}
                      </div>
                    </div>
                  )}

                  {/* Switch to driver hint for testing full loop */}
                  <div className="bg-stone-50 border border-[#E5E1D8] rounded-xl p-3 text-xs text-slate-700 flex items-center justify-between gap-2">
                    <span>تتبع التوكتوك على الخريطة محاكاة تجريبية. لتحديث مراحل الرحلة:</span>
                    <button
                      type="button"
                      onClick={() => setActiveRole('driver')}
                      className="text-teal-800 font-bold underline underline-offset-2 shrink-0"
                    >
                      انتقل لشاشة السائق
                    </button>
                  </div>

                  {/* Prototype safety & support controls */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setProtoNotice(
                          'مشاركة الرحلة (تحكم تجريبي): في الإنتاج سيتم توليد رابط تتبع مؤقت للمعنيين.'
                        )
                      }
                      className="min-h-[46px] px-2 py-2 border border-[#D8D3C8] rounded-xl text-xs font-semibold text-slate-800 hover:bg-stone-50 flex flex-col items-center justify-center gap-1"
                    >
                      <Share2 className="w-4 h-4 text-teal-700" />
                      <span>مشاركة (تجريبي)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setProtoNotice(
                          'الدعم الفني (تحكم تجريبي): لا يوجد مركز دعم مباشر متصل حالياً.'
                        )
                      }
                      className="min-h-[46px] px-2 py-2 border border-[#D8D3C8] rounded-xl text-xs font-semibold text-slate-800 hover:bg-stone-50 flex flex-col items-center justify-center gap-1"
                    >
                      <PhoneCall className="w-4 h-4 text-slate-700" />
                      <span>الدعم (تجريبي)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setProtoNotice(
                          'زر الطوارئ (نموذج أولي فقط): هذا الزر للعرض ولا يتصل بخدمات طوارئ أو إسعاف 24/7.'
                        )
                      }
                      className="min-h-[46px] px-2 py-2 border border-red-200 bg-red-50/50 rounded-xl text-xs font-bold text-red-700 hover:bg-red-50 flex flex-col items-center justify-center gap-1"
                    >
                      <ShieldAlert className="w-4 h-4 text-red-700" />
                      <span>طوارئ (تجريبي)</span>
                    </button>
                  </div>

                  {activePassengerRide.state !== 'in_progress' && (
                    <button
                      type="button"
                      onClick={() =>
                        cancelRide(activePassengerRide.id, 'passenger', 'إلغاء من الراكب أثناء الانتظار')
                      }
                      className="w-full min-h-[44px] border border-red-200 text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold"
                    >
                      إلغاء الرحلة
                    </button>
                  )}
                </div>
              )}
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="الإبلاغ عن مشكلة في الرحلة"
        >
          <form
            onSubmit={handleSubmitReport}
            className="bg-white border border-[#E5E1D8] rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3">
              <h3 className="text-base font-extrabold text-slate-900">الإبلاغ عن مشكلة</h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="p-1.5 text-slate-500 hover:text-slate-900"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-cat" className="block text-xs font-bold text-slate-700">
                نوع المشكلة
              </label>
              <select
                id="rep-cat"
                value={reportCategory}
                onChange={(e) => setReportCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm"
              >
                <option value="مشكلة في الأجرة أو المسار">مشكلة في الأجرة أو المسار</option>
                <option value="تأخير السائق">تأخير السائق</option>
                <option value="أسلوب التعامل أو السلامة">أسلوب التعامل أو السلامة</option>
                <option value="مفقودات داخل التوكتوك">مفقودات داخل التوكتوك</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="rep-det" className="block text-xs font-bold text-slate-700">
                التفاصيل
              </label>
              <textarea
                id="rep-det"
                rows={3}
                required
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="اكتب ما حدث ليظهر في بلاغات لوحة الإدارة..."
                className="w-full p-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 min-h-[44px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm"
              >
                إرسال البلاغ
              </button>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="min-h-[44px] px-4 border border-[#D8D3C8] rounded-xl text-sm font-semibold text-slate-700"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
