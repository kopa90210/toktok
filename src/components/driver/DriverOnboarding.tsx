import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Phone,
  ShieldAlert,
  Upload,
  User,
  XCircle,
} from 'lucide-react';
import { DEMO_IMAGES } from '../../data/seedData';
import {
  getDriverAppStatusLabel,
  normalizeArabicDigits,
  validateEgyptianPhone,
} from '../../domain/stateMachine';
import { DriverDocument } from '../../domain/types';
import { authProvider } from '../../services/authProvider';
import { useDemoStore } from '../../store/DemoStoreContext';
import { AvatarWithFallback } from '../AvatarWithFallback';

export const DriverOnboarding: React.FC = () => {
  const {
    state,
    activeDriver,
    setDriverOnboardingStep,
    upsertDriverApplication,
    setActiveRole,
  } = useDemoStore();

  const step = state.driverOnboardingStep;

  const [phone, setPhone] = useState('01599887766');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [demoOtp, setDemoOtp] = useState('4829');

  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const [driverName, setDriverName] = useState('حسن عبد الرحمن');
  const [vehicleCode, setVehicleCode] = useState('أسوان-٥٢١');
  const [driverLicenseFile, setDriverLicenseFile] = useState('demo_driver_license.jpg');
  const [vehicleLicenseFile, setVehicleLicenseFile] = useState('demo_tuktuk_permit.jpg');
  const [formError, setFormError] = useState<string | null>(null);

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
      setPhoneError(res.error ?? 'خطأ في الإرسال');
      return;
    }
    setPhone(check.normalized);
    setDemoOtp(res.demoOtpCode ?? '4829');
    setOtpInput('');
    setDriverOnboardingStep('verify');
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    setVerifying(true);
    const res = await authProvider.verifyOtp(phone, otpInput);
    setVerifying(false);
    if (!res.ok) {
      setOtpError(res.error ?? 'رمز غير صحيح');
      return;
    }
    setDriverOnboardingStep('profile');
  };

  const handleSaveApplication = (submitNow: boolean) => {
    setFormError(null);
    if (driverName.trim().length < 2) {
      setFormError('يرجى إدخال اسم السائق.');
      return;
    }
    if (vehicleCode.trim().length < 3) {
      setFormError('يرجى إدخال كود أو رقم تسجيل التوكتوك.');
      return;
    }
    const docs: DriverDocument[] = [
      {
        type: 'driver_license',
        label: 'رخصة القيادة (ملف تجريبي)',
        mockFileName: driverLicenseFile || 'demo_driver_license.jpg',
        uploadedAt: new Date().toISOString(),
      },
      {
        type: 'vehicle_license',
        label: 'تصريح المركبة (ملف تجريبي)',
        mockFileName: vehicleLicenseFile || 'demo_vehicle_permit.jpg',
        uploadedAt: new Date().toISOString(),
      },
    ];
    upsertDriverApplication({
      name: driverName.trim(),
      phone,
      vehicleCode: vehicleCode.trim(),
      avatarUrl: DEMO_IMAGES.driverTarek,
      documents: docs,
      submitNow,
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 lg:py-10">
      <div className="bg-white border border-[#E5E1D8] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-[#EFECE4] pb-4">
          <div className="flex items-center gap-2">
            {step !== 'status' && (
              <button
                type="button"
                onClick={() => {
                  if (step === 'phone') setDriverOnboardingStep('done');
                  else if (step === 'verify') setDriverOnboardingStep('phone');
                  else if (step === 'profile') setDriverOnboardingStep('verify');
                }}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-[#E5E1D8] text-slate-700 hover:bg-stone-50"
                aria-label="رجوع"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">التسجيل كسائق توكتوك</h2>
              <p className="text-xs text-slate-500">توك أسوان · انضمام السائقين (وضع الديمو)</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDriverOnboardingStep('done')}
            className="text-xs font-semibold text-teal-800 underline underline-offset-2 min-h-[40px]"
          >
            لوحة السائق
          </button>
        </div>

        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="drv-phone" className="block text-sm font-bold text-slate-800">
                رقم موبايل السائق
              </label>
              <div className="relative flex items-center">
                <Phone className="w-4 h-4 text-slate-400 absolute right-3.5 pointer-events-none" />
                <input
                  id="drv-phone"
                  type="tel"
                  inputMode="numeric"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(normalizeArabicDigits(e.target.value))}
                  className="w-full min-h-[48px] pr-10 pl-4 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] font-mono-num text-base text-right focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>
              {phoneError && <p className="text-xs text-red-700 font-medium">{phoneError}</p>}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950">
              في وضع الديمو، يظهر رمز التحقق التجريبي ({demoOtp}) مباشرة على الشاشة دون إرسال SMS فعلي.
            </div>

            <button
              type="submit"
              disabled={sendingOtp}
              className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl px-5 py-3 flex items-center justify-center gap-2"
            >
              {sendingOtp && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>إرسال رمز التحقق</span>
            </button>
          </form>
        )}

        {step === 'verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div className="bg-stone-100 border border-[#DFDBD0] rounded-xl p-3.5 text-xs text-slate-800">
              رمز تحقق تجريبي محاكى (Demo OTP): <strong className="font-mono-num text-sm">{demoOtp}</strong> (محاكاة بدون SMS حقيقي)
            </div>

            <div className="space-y-2">
              <label htmlFor="drv-otp" className="block text-sm font-bold text-slate-800">
                أدخل رمز التحقق (4 أرقام)
              </label>
              <input
                id="drv-otp"
                type="text"
                inputMode="numeric"
                maxLength={4}
                dir="ltr"
                value={otpInput}
                onChange={(e) => setOtpInput(normalizeArabicDigits(e.target.value))}
                placeholder="4829"
                className="w-full min-h-[50px] px-4 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-center font-mono-num text-2xl tracking-[0.4em]"
              />
              {otpError && <p className="text-xs text-red-700 font-medium">{otpError}</p>}
            </div>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setOtpInput(demoOtp)}
                className="text-teal-800 font-semibold underline underline-offset-2 min-h-[40px]"
              >
                تعبئة الرمز التجريبي
              </button>
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="w-full min-h-[48px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl px-5 py-3 flex items-center justify-center gap-2"
            >
              {verifying && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>تأكيد ومتابعة</span>
            </button>
          </form>
        )}

        {step === 'profile' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <AvatarWithFallback src={DEMO_IMAGES.driverTarek} alt="صورة السائق" sizeClass="w-14 h-14" />
              <div>
                <p className="text-sm font-bold text-slate-900">ملف السائق والمركبة</p>
                <p className="text-xs text-slate-500">نوع المركبة: توكتوك · مدينة أسوان</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="drv-name" className="block text-xs font-bold text-slate-700">
                  اسم السائق
                </label>
                <div className="relative flex items-center">
                  <User className="w-4 h-4 text-slate-400 absolute right-3 pointer-events-none" />
                  <input
                    id="drv-name"
                    type="text"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full min-h-[46px] pr-9 pl-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-slate-700">نوع المركبة</span>
                  <div className="min-h-[46px] px-3 rounded-xl border border-[#E5E1D8] bg-stone-100 flex items-center text-sm font-semibold text-slate-800">
                    توكتوك
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="drv-code" className="block text-xs font-bold text-slate-700">
                    كود / رقم تسجيل التوكتوك
                  </label>
                  <input
                    id="drv-code"
                    type="text"
                    value={vehicleCode}
                    onChange={(e) => setVehicleCode(e.target.value)}
                    placeholder="أسوان-٥٢١"
                    className="w-full min-h-[46px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm font-mono-num"
                  />
                </div>
              </div>
            </div>

            {/* Mock Document Upload Section */}
            <div className="border border-red-200 bg-red-50/60 rounded-2xl p-4 space-y-2 text-xs text-red-950">
              <div className="flex items-center gap-1.5 font-bold">
                <ShieldAlert className="w-4 h-4 text-red-700 shrink-0" />
                <span>تحذير هام: لا ترفع مستندات هوية أو رخص حقيقية</span>
              </div>
              <p className="leading-relaxed">
                هذا القسم لمحاكاة واجهة رفع المستندات فقط. في التطبيق الفعلي يجب حفظ المستندات في
                تخزين خاص مشفر مع صلاحيات وصول مقيدة، سياسات احتفاظ بالبيانات، ومراجعة يدوية من الإدارة.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border border-[#D8D3C8] rounded-xl p-3 space-y-2 bg-[#FAFAF8]">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>رخصة القيادة (وهمي)</span>
                  <FileText className="w-4 h-4 text-teal-700" />
                </div>
                <p className="text-[11px] font-mono-num text-slate-600 truncate">
                  {driverLicenseFile}
                </p>
                <label className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white hover:bg-stone-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>اختيار ملف تجريبي</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setDriverLicenseFile(`demo_placeholder_${f.name}`);
                    }}
                  />
                </label>
              </div>

              <div className="border border-[#D8D3C8] rounded-xl p-3 space-y-2 bg-[#FAFAF8]">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>تصريح التوكتوك (وهمي)</span>
                  <FileText className="w-4 h-4 text-amber-700" />
                </div>
                <p className="text-[11px] font-mono-num text-slate-600 truncate">
                  {vehicleLicenseFile}
                </p>
                <label className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#D8D3C8] bg-white hover:bg-stone-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>اختيار ملف تجريبي</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setVehicleLicenseFile(`demo_placeholder_${f.name}`);
                    }}
                  />
                </label>
              </div>
            </div>

            {formError && <p className="text-xs text-red-700 font-semibold">{formError}</p>}

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => handleSaveApplication(true)}
                className="flex-1 min-h-[48px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl px-5 py-3 text-sm"
              >
                تقديم الطلب للمراجعة
              </button>
              <button
                type="button"
                onClick={() => handleSaveApplication(false)}
                className="min-h-[48px] px-4 py-3 border border-[#D8D3C8] rounded-xl text-sm font-semibold text-slate-700 hover:bg-stone-50"
              >
                حفظ كمسودة
              </button>
            </div>
          </div>
        )}

        {step === 'status' && (
          <div className="space-y-5">
            <div className="bg-[#FAFAF8] border border-[#E5E1D8] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500">حالة طلب السائق الحالي</span>
                <span className="text-sm font-extrabold text-teal-800">
                  {getDriverAppStatusLabel(activeDriver.applicationStatus)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {activeDriver.applicationStatus === 'approved' ? (
                  <CheckCircle2 className="w-7 h-7 text-emerald-700 shrink-0" />
                ) : activeDriver.applicationStatus === 'rejected' ? (
                  <XCircle className="w-7 h-7 text-red-700 shrink-0" />
                ) : (
                  <Clock className="w-7 h-7 text-amber-700 shrink-0" />
                )}
                <div>
                  <p className="text-base font-bold text-slate-900">
                    {activeDriver.name} · {activeDriver.vehicleCode}
                  </p>
                  <p className="text-xs text-slate-600">
                    {activeDriver.applicationStatus === 'approved'
                      ? 'تمت الموافقة على حسابك التجريبي. يمكنك الآن استقبال الطلبات والاتصال بالإنترنت.'
                      : activeDriver.applicationStatus === 'rejected'
                      ? `سبب الرفض: ${activeDriver.rejectionReason ?? 'غير محدد'}`
                      : 'طلبك في انتظار موافقة الإدارة التجريبية. لا يمكن الاتصال بالإنترنت قبل الاعتماد.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDriverOnboardingStep('done')}
                className="flex-1 min-h-[46px] bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl px-4 text-sm"
              >
                الانتقال لشاشة السائق
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('admin')}
                className="min-h-[46px] px-4 border border-[#D8D3C8] rounded-xl text-sm font-semibold text-slate-800 hover:bg-stone-50"
              >
                فتح الإدارة للموافقة
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
