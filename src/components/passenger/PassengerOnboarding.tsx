import React, { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, MapPin, Phone, ShieldAlert, User } from 'lucide-react';
import { DEMO_IMAGES } from '../../data/seedData';
import { normalizeArabicDigits, validateEgyptianPhone } from '../../domain/stateMachine';
import { authProvider } from '../../services/authProvider';
import { useDemoStore } from '../../store/DemoStoreContext';
import { AvatarWithFallback } from '../AvatarWithFallback';

export const PassengerOnboarding: React.FC = () => {
  const {
    state,
    setActiveRole,
    setPassengerOnboardingStep,
    setDriverOnboardingStep,
    upsertPassengerProfile,
  } = useDemoStore();

  const step = state.passengerOnboardingStep;

  const [phone, setPhone] = useState('01012345678');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [demoOtpShown, setDemoOtpShown] = useState<string>('4829');

  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [fullName, setFullName] = useState('نورا حسن');
  const [useSampleAvatar, setUseSampleAvatar] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [resendCooldown]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    const check = validateEgyptianPhone(phone);
    if (!check.valid) {
      setPhoneError(check.error ?? 'رقم غير صحيح');
      return;
    }
    setSendingOtp(true);
    const res = await authProvider.sendOtp(check.normalized);
    setSendingOtp(false);
    if (!res.ok) {
      setPhoneError(res.error ?? 'تعذر إرسال الرمز');
      return;
    }
    setPhone(check.normalized);
    setDemoOtpShown(res.demoOtpCode ?? '4829');
    setOtpInput('');
    setOtpError(null);
    setResendCooldown(30);
    setPassengerOnboardingStep('verify');
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || sendingOtp) return;
    setSendingOtp(true);
    const res = await authProvider.sendOtp(phone);
    setSendingOtp(false);
    if (res.ok) {
      setDemoOtpShown(res.demoOtpCode ?? '4829');
      setResendCooldown(30);
      setOtpError(null);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setVerifyingOtp(true);
    const res = await authProvider.verifyOtp(phone, otpInput);
    setVerifyingOtp(false);
    if (!res.ok) {
      setOtpError(res.error ?? 'رمز غير صحيح');
      return;
    }
    setPassengerOnboardingStep('profile');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 2) {
      setProfileError('يرجى كتابة الاسم من حرفين على الأقل.');
      return;
    }
    upsertPassengerProfile({
      name: fullName.trim(),
      phone,
      avatarUrl: useSampleAvatar ? DEMO_IMAGES.passengerAvatar : undefined,
    });
  };

  if (step === 'welcome') {
    return (
      <div className="max-w-5xl mx-auto px-4 py-6 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch bg-white border border-[#E5E1D8] rounded-3xl overflow-hidden shadow-sm">
          {/* Hero visual */}
          <div className="relative min-h-[240px] lg:min-h-[440px] bg-stone-200">
            <img
              src={DEMO_IMAGES.heroTukTuk}
              alt="توكتوك في شوارع أسوان على كورنيش النيل"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-900/20 to-transparent flex flex-col justify-end p-6 text-white">
              <p className="text-xs text-amber-300 font-semibold mb-1">
                نموذج أولي تجريبي · مدينة أسوان
              </p>
              <h2 className="text-2xl lg:text-3xl font-extrabold leading-snug">
                مشاويرك جوه أسوان بالسعر اللي يناسبك
              </h2>
            </div>
          </div>

          {/* Welcome copy & CTA */}
          <div className="p-6 lg:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>توك أسوان</span>
                <span aria-hidden="true">·</span>
                <span>تفاوض مباشر على الأجرة</span>
                <span aria-hidden="true">·</span>
                <span>دفع كاش</span>
              </div>

              <h1 className="text-3xl lg:text-4xl font-extrabold text-slate-900 leading-tight">
                اطلب توكتوك في أسوان بسهولة ووضوح
              </h1>

              <p className="text-base text-slate-600 leading-relaxed">
                حدّد نقطة الركوب والوجهة، شوف السعر الاسترشادي واقترح الأجرة اللي تناسبك.
                السائقين القريبين منك يوافقوا أو يقدموا عروض، وإنت اللي بتختار السائق المناسب.
              </p>

              <div className="border-t border-[#ECE8DF] pt-4 space-y-2 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>عرض السائق والتوكتوك والتقييم قبل القبول</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
                  <span>بيانات ومعالم تجريبية في أسوان بدون رسوم أو رسائل حقيقية</span>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => setPassengerOnboardingStep('phone')}
                className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-800 active:scale-[0.99] text-white font-bold text-base rounded-xl px-6 py-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
              >
                ابدأ
              </button>

              <div className="flex items-center justify-between gap-4 pt-1 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setDriverOnboardingStep('phone');
                    setActiveRole('driver');
                  }}
                  className="text-teal-800 font-semibold underline underline-offset-4 hover:text-teal-950 min-h-[44px] flex items-center"
                >
                  التسجيل كسائق
                </button>

                <button
                  type="button"
                  onClick={() => setPassengerOnboardingStep('done')}
                  className="text-slate-600 hover:text-slate-900 font-medium min-h-[44px] flex items-center"
                >
                  تخطي للرئيسية (حساب ديمو)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 lg:py-10">
      <div className="bg-white border border-[#E5E1D8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        {/* Step header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#EFECE4] pb-4">
          <button
            type="button"
            onClick={() => {
              if (step === 'phone') setPassengerOnboardingStep('welcome');
              else if (step === 'verify') setPassengerOnboardingStep('phone');
              else if (step === 'profile') setPassengerOnboardingStep('verify');
            }}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-[#E5E1D8] text-slate-700 hover:bg-stone-50"
            aria-label="رجوع للخطوة السابقة"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
          <div className="text-left text-xs text-slate-500 font-mono-num">
            {step === 'phone' ? '١ / ٣' : step === 'verify' ? '٢ / ٣' : '٣ / ٣'}
          </div>
        </div>

        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">رقم الموبايل</h2>
              <p className="text-sm text-slate-600">
                أدخل رقم موبايل مصري للتجربة. في وضع الديمو لا يتم إرسال رسائل SMS حقيقية.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="pass-phone" className="block text-sm font-semibold text-slate-800">
                رقم الهاتف المصري
              </label>
              <div className="relative flex items-center">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
                <input
                  id="pass-phone"
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(normalizeArabicDigits(e.target.value))}
                  placeholder="01012345678"
                  className="w-full min-h-[48px] pr-10 pl-4 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-slate-900 font-mono-num text-base text-right focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              {phoneError && (
                <p role="alert" className="text-xs text-red-700 font-medium">
                  {phoneError}
                </p>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 space-y-1">
              <p className="font-bold">تنبيه وضع الديمو:</p>
              <p>
                رمز التحقق الاختباري سيظهر مباشرة على الشاشة التالية ({' '}
                <span className="font-mono-num font-bold">4829</span> ) بدون إرسال SMS أو أي تكلفة.
              </p>
            </div>

            <button
              type="submit"
              disabled={sendingOtp}
              className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold rounded-xl px-5 py-3 flex items-center justify-center gap-2 transition-colors"
            >
              {sendingOtp && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>إرسال رمز التحقق</span>
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">تأكيد رمز التحقق</h2>
              <p className="text-sm text-slate-600">
                أدخل الرمز للرقم <span className="font-mono-num font-semibold">{phone}</span>
              </p>
            </div>

            <div className="bg-stone-100 border border-[#DFDBD0] rounded-xl p-3.5 text-xs text-slate-800 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                <span>رمز تحقق تجريبي محاكى (Demo OTP): <span className="font-mono-num text-sm bg-white px-2 py-0.5 rounded border border-stone-300">{demoOtpShown}</span></span>
              </div>
              <p className="text-slate-600">
                هذا التحقق محاكاة للعرض فقط (بدون SMS حقيقي) ولا يمثل مصادقة آمنة.
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="pass-otp" className="block text-sm font-semibold text-slate-800">
                أدخل الرمز المكون من 4 أرقام
              </label>
              <input
                id="pass-otp"
                type="text"
                inputMode="numeric"
                maxLength={4}
                dir="ltr"
                value={otpInput}
                onChange={(e) => setOtpInput(normalizeArabicDigits(e.target.value))}
                placeholder="4829"
                className="w-full min-h-[52px] px-4 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-center font-mono-num text-2xl tracking-[0.4em] text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
              />
              {otpError && (
                <p role="alert" className="text-xs text-red-700 font-medium">
                  {otpError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0 || sendingOtp}
                className="text-teal-800 font-semibold disabled:text-slate-400 underline underline-offset-2 min-h-[44px]"
              >
                {resendCooldown > 0
                  ? `إعادة الإرسال خلال ${resendCooldown} ث`
                  : 'إعادة إرسال الرمز'}
              </button>
              <button
                type="button"
                onClick={() => setOtpInput(demoOtpShown)}
                className="text-slate-700 hover:text-slate-950 font-medium min-h-[44px]"
              >
                تعبئة الرمز التجريبي
              </button>
            </div>

            <button
              type="submit"
              disabled={verifyingOtp}
              className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white font-bold rounded-xl px-5 py-3 flex items-center justify-center gap-2 transition-colors"
            >
              {verifyingOtp && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>تأكيد ومتابعة</span>
            </button>
          </form>
        )}

        {step === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">بيانات الحساب</h2>
              <p className="text-sm text-slate-600">البيانات الأساسية لتعريف السائقين باسمك عند الطلب.</p>
            </div>

            <div className="flex items-center gap-4">
              <AvatarWithFallback
                src={useSampleAvatar ? DEMO_IMAGES.passengerAvatar : undefined}
                alt="صورة الملف الشخصي"
                sizeClass="w-16 h-16"
              />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-800">صورة شخصية (اختياري)</p>
                <button
                  type="button"
                  onClick={() => setUseSampleAvatar((v) => !v)}
                  className="text-xs text-teal-800 font-semibold underline underline-offset-2 min-h-[36px]"
                >
                  {useSampleAvatar ? 'استخدام أيقونة افتراضية' : 'استخدام صورة تجريبية'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="pass-name" className="block text-sm font-semibold text-slate-800">
                الاسم بالكامل
              </label>
              <div className="relative flex items-center">
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
                <input
                  id="pass-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: نورا حسن"
                  className="w-full min-h-[48px] pr-10 pl-4 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              {profileError && (
                <p role="alert" className="text-xs text-red-700 font-medium">
                  {profileError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="block text-sm font-semibold text-slate-800">المدينة</span>
              <div className="min-h-[48px] px-4 rounded-xl border border-[#E5E1D8] bg-stone-100 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <MapPin className="w-4 h-4 text-teal-700" />
                <span>أسوان (نطاق التشغيل التجريبي)</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl px-5 py-3 transition-colors"
            >
              الدخول للرئيسية
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
