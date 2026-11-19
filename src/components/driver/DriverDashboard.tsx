import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  DollarSign,
  History,
  KeyRound,
  MapPin,
  Navigation,
  Power,
  ShieldAlert,
  UserPlus,
  X,
} from 'lucide-react';
import {
  canDriverGoOnline,
  getDriverAppStatusLabel,
  getRideStateLabel,
  normalizeArabicDigits,
} from '../../domain/stateMachine';
import { useDemoStore } from '../../store/DemoStoreContext';
import { AswanInteractiveMap } from '../AswanInteractiveMap';
import { AvatarWithFallback } from '../AvatarWithFallback';

interface DriverDashboardProps {
  onOpenConfigGuide: () => void;
}

export const DriverDashboard: React.FC<DriverDashboardProps> = ({ onOpenConfigGuide }) => {
  const {
    state,
    activeDriver,
    activeDriverRide,
    setActiveDriverId,
    setDriverOnboardingStep,
    toggleDriverOnline,
    submitDriverOffer,
    withdrawDriverOffer,
    markDriverArrived,
    startRideWithOtp,
    completeRide,
    cancelRide,
    setActiveRole,
  } = useDemoStore();

  const [tab, setTab] = useState<'work' | 'history'>('work');
  const [dismissedRideIds, setDismissedRideIds] = useState<string[]>([]);
  const [counterPrices, setCounterPrices] = useState<Record<string, number>>({});
  const [otpInput, setOtpInput] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const isApproved = canDriverGoOnline(activeDriver.applicationStatus);

  // Incoming open requests that this driver hasn't dismissed
  const incomingRides = useMemo(() => {
    return state.rides
      .filter(
        (r) =>
          (r.state === 'requested' || r.state === 'offers_open') &&
          !dismissedRideIds.includes(r.id)
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [dismissedRideIds, state.rides]);

  // Offers submitted by this driver awaiting passenger decision
  const pendingSubmittedOffers = useMemo(() => {
    return state.offers.filter(
      (o) => o.driverId === activeDriver.id && o.state === 'submitted'
    );
  }, [activeDriver.id, state.offers]);

  const driverHistory = useMemo(() => {
    return state.rides
      .filter((r) => r.selectedDriverId === activeDriver.id && r.state === 'completed')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [activeDriver.id, state.rides]);

  const handleToggleOnline = () => {
    setActionError(null);
    const res = toggleDriverOnline();
    if (!res.ok) setActionError(res.error ?? 'تعذر تغيير الحالة.');
  };

  const handleSendOffer = (rideId: string, price: number, isCounter: boolean) => {
    setActionError(null);
    setActionNotice(null);
    const res = submitDriverOffer(rideId, activeDriver.id, price, isCounter);
    if (!res.ok) {
      setActionError(res.error ?? 'تعذر إرسال العرض.');
      return;
    }
    setActionNotice(
      isCounter
        ? `تم إرسال عرضك المضاد بقيمة ${price} ج.م. انتقل لدور الراكب لاختيار العرض.`
        : `تمت الموافقة على سعر الراكب (${price} ج.م). في انتظار اختيار الراكب.`
    );
  };

  const handleArrived = () => {
    if (!activeDriverRide) return;
    setActionError(null);
    const res = markDriverArrived(activeDriverRide.id);
    if (!res.ok) setActionError(res.error ?? 'تعذر تحديث الحالة.');
  };

  const handleStartWithOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDriverRide) return;
    setActionError(null);
    const res = startRideWithOtp(activeDriverRide.id, normalizeArabicDigits(otpInput));
    if (!res.ok) {
      setActionError(res.error ?? 'الرمز غير صحيح.');
      return;
    }
    setOtpInput('');
  };

  const handleCompleteRide = () => {
    if (!activeDriverRide) return;
    setActionError(null);
    const res = completeRide(activeDriverRide.id);
    if (!res.ok) {
      setActionError(res.error ?? 'تعذر إنهاء الرحلة.');
      return;
    }
    setActionNotice('تم إنهاء الرحلة وتسجيل الأجرة الكاش في أرباحك التجريبية.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 lg:py-6 space-y-4">
      {/* Driver top control bar: switch demo driver + register new driver + online toggle */}
      <div className="bg-white border border-[#E5E1D8] rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <AvatarWithFallback src={activeDriver.avatarUrl} alt={activeDriver.name} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="driver-select" className="sr-only">
                اختيار حساب السائق التجريبي
              </label>
              <select
                id="driver-select"
                value={activeDriver.id}
                onChange={(e) => setActiveDriverId(e.target.value)}
                className="font-bold text-slate-900 bg-[#FAFAF8] border border-[#D8D3C8] rounded-lg px-2.5 py-1.5 text-sm"
              >
                {state.drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.vehicleCode}) — {getDriverAppStatusLabel(d.applicationStatus)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setDriverOnboardingStep('phone')}
                className="min-h-[38px] px-3 py-1.5 text-xs font-semibold text-teal-800 border border-teal-200 bg-teal-50/70 rounded-lg flex items-center gap-1 hover:bg-teal-50 whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>تسجيل سائق جديد</span>
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              الحالة: <strong className="text-slate-800">{getDriverAppStatusLabel(activeDriver.applicationStatus)}</strong>
              {' · '}
              الرحلات المكتملة: <strong className="tabular-nums">{activeDriver.completedTrips}</strong>
              {' · '}
              أرباح تقديرية: <strong className="tabular-nums">{activeDriver.estimatedEarningsEgp} ج.م</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-xl">
            <button
              type="button"
              onClick={() => setTab('work')}
              className={`min-h-[38px] px-3 py-1 text-xs font-bold rounded-lg whitespace-nowrap ${
                tab === 'work' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              العمل والطلبات
            </button>
            <button
              type="button"
              onClick={() => setTab('history')}
              className={`min-h-[38px] px-3 py-1 text-xs font-bold rounded-lg flex items-center gap-1 whitespace-nowrap ${
                tab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>السجل ({driverHistory.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleToggleOnline}
            disabled={!isApproved}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap ${
              !isApproved
                ? 'bg-stone-200 text-slate-500 cursor-not-allowed'
                : activeDriver.isOnline
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                : 'bg-slate-800 hover:bg-slate-900 text-white'
            }`}
          >
            <Power className="w-4 h-4" />
            <span>{activeDriver.isOnline ? 'متصل (أونلاين)' : 'غير متصل'}</span>
          </button>
        </div>
      </div>

      {!isApproved && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm text-amber-950">
          <div className="flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                الحساب في حالة "{getDriverAppStatusLabel(activeDriver.applicationStatus)}" ولا يمكن تفعيل الاتصال.
              </p>
              <p className="text-xs text-amber-900 mt-0.5">
                {activeDriver.rejectionReason
                  ? `سبب الرفض: ${activeDriver.rejectionReason}`
                  : 'فقط السائقون المعتمدون من الإدارة يمكنهم التحول لوضع الاتصال واستقبال الطلبات.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveRole('admin')}
            className="min-h-[40px] px-4 py-2 bg-amber-900 text-white text-xs font-bold rounded-xl shrink-0"
          >
            مراجعة واعتماد من الإدارة
          </button>
        </div>
      )}

      {actionError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-900 rounded-xl px-4 py-3 text-xs font-bold">
          {actionError}
        </div>
      )}

      {actionNotice && (
        <div className="bg-teal-50 border border-teal-200 text-teal-950 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between gap-2">
          <span>{actionNotice}</span>
          <button
            type="button"
            onClick={() => setActiveRole('passenger')}
            className="underline font-bold text-teal-800 shrink-0"
          >
            الانتقال للراكب
          </button>
        </div>
      )}

      {tab === 'history' ? (
        <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border-b border-[#EFECE4] pb-4">
            <div className="bg-[#FAFAF8] border border-[#E5E1D8] rounded-xl p-3.5">
              <p className="text-xs text-slate-500">إجمالي الأرباح التقديرية (ديمو)</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                {activeDriver.estimatedEarningsEgp} ج.م
              </p>
            </div>
            <div className="bg-[#FAFAF8] border border-[#E5E1D8] rounded-xl p-3.5">
              <p className="text-xs text-slate-500">الرحلات المكتملة</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                {activeDriver.completedTrips}
              </p>
            </div>
            <div className="bg-[#FAFAF8] border border-[#E5E1D8] rounded-xl p-3.5">
              <p className="text-xs text-slate-500">متوسط التقييم</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                {activeDriver.rating ? `${activeDriver.rating} ★` : 'سائق جديد'}
              </p>
            </div>
          </div>

          {driverHistory.length === 0 ? (
            <p className="text-sm text-slate-500 py-8 text-center">لا توجد رحلات مكتملة لهذا السائق بعد.</p>
          ) : (
            <div className="divide-y divide-[#EFECE4]">
              {driverHistory.map((r) => (
                <div key={r.id} className="py-3.5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      {r.pickup.name} ← {r.destination.name}
                    </p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {r.passengerName} · {r.distanceKm} كم · {new Date(r.updatedAt).toLocaleString('ar-EG')}
                    </p>
                  </div>
                  <div className="text-base font-extrabold text-teal-800 tabular-nums">
                    +{r.agreedFareEgp ?? r.passengerFareEgp} ج.م
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 min-h-[280px] lg:min-h-[540px]">
            <AswanInteractiveMap
              activeRide={activeDriverRide}
              drivers={state.drivers}
              serviceZone={state.serviceZone}
              onOpenConfigGuide={onOpenConfigGuide}
              heightClass="h-[280px] sm:h-[340px] lg:h-full"
            />
          </div>

          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Active Ride Workflow for Driver */}
            {activeDriverRide ? (
              <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-[#EFECE4] pb-3">
                  <div>
                    <p className="text-xs font-bold text-teal-800">رحلة نشطة الآن</p>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {getRideStateLabel(activeDriverRide.state)}
                    </h2>
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-extrabold text-slate-900 tabular-nums">
                      {activeDriverRide.agreedFareEgp} ج.م
                    </div>
                    <div className="text-xs text-slate-500">تحصيل كاش</div>
                  </div>
                </div>

                <div className="space-y-2 text-sm bg-[#FAFAF8] border border-[#E5E1D8] rounded-xl p-3.5">
                  <p className="font-bold text-slate-900">
                    الراكب: {activeDriverRide.passengerName} ({activeDriverRide.passengerPhone})
                  </p>
                  <p className="text-xs text-slate-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                    <span>من: {activeDriverRide.pickup.name}</span>
                  </p>
                  <p className="text-xs text-slate-700 flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>إلى: {activeDriverRide.destination.name}</span>
                  </p>
                  {activeDriverRide.notes && (
                    <p className="text-xs text-slate-600">ملاحظة: {activeDriverRide.notes}</p>
                  )}
                </div>

                {/* Step 1: Mark Arrived */}
                <button
                  type="button"
                  disabled={
                    activeDriverRide.state !== 'driver_arriving' &&
                    activeDriverRide.state !== 'driver_selected'
                  }
                  onClick={handleArrived}
                  className="w-full min-h-[46px] rounded-xl font-bold text-sm bg-teal-700 hover:bg-teal-800 disabled:bg-stone-200 disabled:text-slate-500 text-white transition-colors"
                >
                  {activeDriverRide.state === 'driver_arrived' ||
                  activeDriverRide.state === 'in_progress'
                    ? 'تم الوصول لنقطة الركوب ✓'
                    : 'وصلت لنقطة الركوب'}
                </button>

                {/* Step 2: Enter Passenger Trip-Start OTP */}
                <form
                  onSubmit={handleStartWithOtp}
                  className="border border-[#E5E1D8] rounded-xl p-3.5 space-y-2.5 bg-[#FAFAF8]"
                >
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="trip-otp" className="font-bold text-slate-800 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                      <span>رمز بدء الرحلة من الراكب</span>
                    </label>
                    <span className="font-mono-num text-slate-500">
                      (للاختبار: {activeDriverRide.tripStartOtp})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="trip-otp"
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      dir="ltr"
                      disabled={activeDriverRide.state !== 'driver_arrived'}
                      value={otpInput}
                      onChange={(e) => setOtpInput(normalizeArabicDigits(e.target.value))}
                      placeholder="4 أرقام"
                      className="flex-1 min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-white text-center font-mono-num text-lg tracking-widest disabled:bg-stone-100"
                    />
                    <button
                      type="submit"
                      disabled={activeDriverRide.state !== 'driver_arrived'}
                      className="min-h-[44px] px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-stone-200 disabled:text-slate-500 text-white text-xs font-bold whitespace-nowrap"
                    >
                      بدء الرحلة
                    </button>
                  </div>
                </form>

                {/* Step 3: Complete Ride */}
                <button
                  type="button"
                  disabled={activeDriverRide.state !== 'in_progress'}
                  onClick={handleCompleteRide}
                  className="w-full min-h-[48px] rounded-xl font-bold text-sm bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-200 disabled:text-slate-500 text-white flex items-center justify-center gap-2 transition-colors"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>إنهاء الرحلة وتحصيل {activeDriverRide.agreedFareEgp} ج.م كاش</span>
                </button>

                {activeDriverRide.state !== 'in_progress' && (
                  <button
                    type="button"
                    onClick={() =>
                      cancelRide(activeDriverRide.id, 'driver', 'إلغاء من السائق قبل بدء الرحلة')
                    }
                    className="w-full min-h-[40px] text-xs font-bold text-red-700 border border-red-200 rounded-xl hover:bg-red-50"
                  >
                    إلغاء الرحلة
                  </button>
                )}
              </div>
            ) : (
              /* Waiting / Incoming Ride Requests */
              <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3">
                  <h2 className="text-lg font-extrabold text-slate-900">الطلبات الواردة</h2>
                  <span className="text-xs text-slate-500">
                    {activeDriver.isOnline ? 'جاهز لاستقبال الطلبات' : 'غير متصل'}
                  </span>
                </div>

                {/* Pending offers waiting for passenger choice */}
                {pendingSubmittedOffers.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                      <Clock className="w-4 h-4 text-amber-700" />
                      <span>في انتظار قرار الراكب على عرضك ({pendingSubmittedOffers.length})</span>
                    </div>
                    {pendingSubmittedOffers.map((off) => (
                      <div key={off.id} className="flex items-center justify-between text-xs bg-white border border-amber-200 rounded-lg px-3 py-2">
                        <span>عرضك: <strong className="tabular-nums">{off.priceEgp} ج.م</strong></span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveRole('passenger')}
                            className="text-teal-800 font-bold underline"
                          >
                            فتح شاشة الراكب
                          </button>
                          <button
                            type="button"
                            onClick={() => withdrawDriverOffer(off.id)}
                            className="text-red-700 font-semibold"
                          >
                            سحب
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!activeDriver.isOnline ? (
                  <div className="py-8 text-center space-y-2 text-sm text-slate-600">
                    <p className="font-semibold">أنت غير متصل حالياً</p>
                    <p className="text-xs text-slate-500">
                      {isApproved
                        ? 'فعّل زر "متصل" بالأعلى لاستقبال طلبات الركاب في أسوان.'
                        : 'حسابك بانتظار موافقة الإدارة قبل إتاحة الاتصال.'}
                    </p>
                  </div>
                ) : incomingRides.length === 0 ? (
                  <div className="py-8 text-center space-y-2 text-sm text-slate-600">
                    <p className="font-semibold">لا توجد طلبات ركاب مفتوحة حالياً</p>
                    <p className="text-xs text-slate-500">
                      يمكنك التبديل لدور الراكب وإنشاء طلب رحلة جديد، ثم العودة هنا للرد عليه!
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveRole('passenger')}
                      className="mt-2 min-h-[40px] px-4 py-2 bg-teal-700 text-white text-xs font-bold rounded-xl"
                    >
                      إنشاء طلب كراكب
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {incomingRides.map((ride) => {
                      const counterVal = counterPrices[ride.id] ?? ride.passengerFareEgp + 5;
                      return (
                        <div
                          key={ride.id}
                          className="border border-[#D8D3C8] rounded-2xl p-4 space-y-3 bg-[#FAFAF8]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-slate-900">{ride.passengerName}</p>
                              <p className="text-xs text-slate-500 tabular-nums">
                                {ride.distanceKm} كم · ~{ride.estimatedMinutes} دقيقة
                              </p>
                            </div>
                            <div className="text-left">
                              <div className="text-xl font-extrabold text-teal-800 tabular-nums">
                                {ride.passengerFareEgp} ج.م
                              </div>
                              <div className="text-[11px] text-slate-500">سعر الراكب</div>
                            </div>
                          </div>

                          <div className="text-xs text-slate-700 space-y-1">
                            <p>من: <strong>{ride.pickup.name}</strong></p>
                            <p>إلى: <strong>{ride.destination.name}</strong></p>
                            {ride.notes && <p className="text-slate-600">ملاحظة: {ride.notes}</p>}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() =>
                                handleSendOffer(ride.id, ride.passengerFareEgp, false)
                              }
                              className="flex-1 min-h-[42px] px-3 py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1 whitespace-nowrap"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>قبول {ride.passengerFareEgp} ج.م</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setDismissedRideIds((ids) => [...ids, ride.id])}
                              className="min-h-[42px] px-3 py-2 border border-[#D8D3C8] bg-white text-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>تجاهل</span>
                            </button>
                          </div>

                          {/* Counteroffer input */}
                          <div className="flex items-center gap-2 pt-2 border-t border-[#E5E1D8]">
                            <input
                              type="number"
                              min={state.fareConfig.minFareEgp}
                              value={counterVal}
                              onChange={(e) =>
                                setCounterPrices((prev) => ({
                                  ...prev,
                                  [ride.id]: Number(normalizeArabicDigits(e.target.value)) || 0,
                                }))
                              }
                              aria-label="سعر العرض المضاد"
                              className="w-24 min-h-[40px] px-2.5 rounded-xl border border-[#D8D3C8] bg-white text-center font-mono-num text-sm font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleSendOffer(ride.id, counterVal, true)}
                              className="flex-1 min-h-[40px] px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl whitespace-nowrap"
                            >
                              تقديم عرض مضاد ({counterVal} ج.م)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
