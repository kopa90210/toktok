import React, { useState } from 'react';
import { RotateCcw, Settings2, ShieldCheck, X } from 'lucide-react';
import { mapProvider } from '../services/mapProvider';
import { useDemoStore } from '../store/DemoStoreContext';

interface DemoControlsModalProps {
  open: boolean;
  onClose: () => void;
}

export const DemoControlsModal: React.FC<DemoControlsModalProps> = ({ open, onClose }) => {
  const { state, updateSimulationFlags, resetDemoData, setPassengerOnboardingStep } =
    useDemoStore();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!open) return null;

  const flags = state.simulationFlags;

  const handleReset = () => {
    resetDemoData();
    setConfirmReset(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="إعدادات الاختبار وتكوين المزودين"
    >
      <div className="bg-white border border-[#E5E1D8] rounded-3xl max-w-2xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EFECE4] pb-3">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-teal-700" />
            <h2 className="text-lg font-extrabold text-slate-900">
              إعدادات الاختبار التجريبي والمزودين
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-stone-100 text-slate-600"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Edge-case toggles */}
        <div className="space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900">
            محاكاة حالات الخطأ والطوارئ لاختبار النموذج
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                key: 'locationPermissionDenied' as const,
                label: 'رفض إذن الموقع (Permission Denied)',
              },
              {
                key: 'gpsUnavailable' as const,
                label: 'عدم توفر إشارة GPS',
              },
              {
                key: 'networkOffline' as const,
                label: 'انقطاع شبكة الإنترنت (Offline)',
              },
              {
                key: 'forceNoDrivers' as const,
                label: 'عدم وجود سائقين متاحين (no_driver)',
              },
              {
                key: 'fastOfferExpiry' as const,
                label: 'انتهاء صلاحية العروض سريعاً (14 ثانية)',
              },
            ].map((item) => {
              const active = flags[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => updateSimulationFlags({ [item.key]: !active })}
                  className={`min-h-[46px] px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 transition-colors ${
                    active
                      ? 'bg-amber-50 border-amber-400 text-amber-950'
                      : 'bg-[#FAFAF8] border-[#D8D3C8] text-slate-700 hover:bg-stone-100'
                  }`}
                >
                  <span>{item.label}</span>
                  <span>{active ? 'مفعّل' : 'متوقف'}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map & Phone Provider Setup Guide */}
        <div className="border-t border-[#EFECE4] pt-4 space-y-3">
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-teal-700" />
            <span>تعليمات ربط الخرائط والتحقق عبر الهاتف (بدون مشاركة مفاتيح)</span>
          </h3>

          <div className="bg-[#FAFAF8] border border-[#E5E1D8] rounded-2xl p-4 space-y-2 text-xs text-slate-700 leading-relaxed">
            <p className="font-bold text-slate-900">1. مزود الخرائط والمسارات (IMapProvider):</p>
            <ul className="list-disc pr-5 space-y-1">
              {mapProvider.getConfigInstructions().map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <p className="font-bold text-slate-900 pt-2">
              2. التحقق عبر الهاتف (IAuthProvider / SMS OTP):
            </p>
            <ul className="list-disc pr-5 space-y-1">
              <li>
                يستخدم النموذج حالياً <code className="font-mono-num">DemoPhoneAuthProvider</code> الذي يعرض الرمز التجريبي على الشاشة دون أي إرسال فعلي.
              </li>
              <li>
                للإنتاج: أضف مزوداً فعلياً (مثل Firebase Phone Auth أو Twilio Verify عبر خادم Backend)، وضع المفاتيح السرية في متغيرات بيئة الخادم فقط (وليس في كود المتصفح).
              </li>
              <li>
                لا ترسل أي مفاتيح سرية أو بيانات اعتماد في المحادثة.
              </li>
            </ul>
          </div>
        </div>

        {/* Quick navigation & Reset Demo */}
        <div className="border-t border-[#EFECE4] pt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setPassengerOnboardingStep('welcome');
              onClose();
            }}
            className="min-h-[42px] px-4 py-2 rounded-xl border border-[#D8D3C8] text-xs font-bold text-slate-800 hover:bg-stone-50"
          >
            إعادة شاشة الترحيب للراكب
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs font-bold flex items-center gap-1.5 hover:bg-red-100"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET DEMO · إعادة ضبط الديمو</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-300 rounded-xl px-3 py-1.5">
              <span className="text-xs font-bold text-red-900">تأكيد مسح بيانات الديمو؟</span>
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[34px] px-3 rounded-lg bg-red-700 text-white text-xs font-bold"
              >
                نعم، أعد الضبط
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="min-h-[34px] px-2.5 rounded-lg bg-white border border-stone-300 text-xs font-semibold"
              >
                إلغاء
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
