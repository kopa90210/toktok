import React, { useState } from 'react';
import {
  Ban,
  CheckCircle2,
  ClipboardList,
  Flag,
  Map as MapIcon,
  ShieldAlert,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import {
  getDriverAppStatusLabel,
  getRideStateLabel,
} from '../../domain/stateMachine';
import { FareConfig, ServiceZone } from '../../domain/types';
import { useDemoStore } from '../../store/DemoStoreContext';
import { AvatarWithFallback } from '../AvatarWithFallback';

type AdminTab = 'overview' | 'applications' | 'directory' | 'reports' | 'config' | 'audit';

export const AdminDashboard: React.FC = () => {
  const {
    state,
    adminUpdateDriverStatus,
    adminUpdateServiceConfig,
    adminResolveReport,
    cancelRide,
  } = useDemoStore();

  const [tab, setTab] = useState<AdminTab>('overview');
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminNotice, setAdminNotice] = useState<string | null>(null);

  const [zoneDraft, setZoneDraft] = useState<ServiceZone>(state.serviceZone);
  const [fareDraft, setFareDraft] = useState<FareConfig>(state.fareConfig);

  const activeRides = state.rides.filter(
    (r) => !['completed', 'cancelled', 'expired', 'no_driver'].includes(r.state)
  );
  const pendingDrivers = state.drivers.filter((d) =>
    ['submitted', 'under_review'].includes(d.applicationStatus)
  );
  const openReports = state.reports.filter((r) => r.status === 'open');

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    const res = adminUpdateServiceConfig(zoneDraft, fareDraft);
    if (!res.ok) {
      setAdminError(res.error ?? 'تعذر حفظ الإعدادات.');
      return;
    }
    setAdminNotice('تم تحديث نطاق الخدمة ومعاملات التسعير الاسترشادي وتسجيل ذلك في سجل المراجعة.');
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetId) return;
    setAdminError(null);
    const res = adminUpdateDriverStatus(rejectTargetId, 'rejected', rejectReason);
    if (!res.ok) {
      setAdminError(res.error ?? 'أدخل سبب الرفض.');
      return;
    }
    setRejectTargetId(null);
    setRejectReason('');
    setAdminNotice('تم رفض طلب السائق وتسجيل السبب.');
  };

  const handleConfirmManualCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetId) return;
    setAdminError(null);
    const res = cancelRide(cancelTargetId, 'admin', cancelReason);
    if (!res.ok) {
      setAdminError(res.error ?? 'سبب الإلغاء مطلوب.');
      return;
    }
    setCancelTargetId(null);
    setCancelReason('');
    setAdminNotice('تم إلغاء الرحلة يدوياً وتسجيل السبب في سجل المراجعة.');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-5 space-y-5">
      {/* Security disclosure banner */}
      <div className="bg-stone-100 border border-[#DFDBD0] rounded-2xl p-4 flex items-start gap-3 text-xs text-slate-800">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-slate-900">
            لوحة تحكم الإدارة (نموذج تجريبي للعرض والاختبار)
          </p>
          <p className="text-slate-600 mt-0.5">
            التبديل لدور الإدارة من الأعلى لا يمثل حماية حقيقية. في بيئة الإنتاج يجب فرض صلاحيات الإدارة والتحقق من الأدوار (RBAC) بالكامل على الخادم (Server-Side).
          </p>
        </div>
      </div>

      {adminError && (
        <div role="alert" className="bg-red-50 border border-red-200 text-red-900 rounded-xl px-4 py-3 text-xs font-bold">
          {adminError}
        </div>
      )}

      {adminNotice && (
        <div className="bg-teal-50 border border-teal-200 text-teal-950 rounded-xl px-4 py-3 text-xs font-semibold flex items-center justify-between">
          <span>{adminNotice}</span>
          <button type="button" onClick={() => setAdminNotice(null)} aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Sidebar nav */}
        <aside className="lg:col-span-3 bg-white border border-[#E5E1D8] rounded-2xl p-2.5 flex lg:flex-col gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'الطلبات والرحلات النشطة', icon: ClipboardList },
            {
              id: 'applications',
              label: `طلبات السائقين (${pendingDrivers.length})`,
              icon: CheckCircle2,
            },
            { id: 'directory', label: 'السائقون والركاب والسجل', icon: Users },
            { id: 'reports', label: `البلاغات (${openReports.length})`, icon: Flag },
            { id: 'config', label: 'النطاق والتسعير', icon: MapIcon },
            { id: 'audit', label: `سجل المراجعة (${state.auditLogs.length})`, icon: ShieldAlert },
          ].map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as AdminTab)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 text-right ${
                  active
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-700 hover:bg-stone-100'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Workspace */}
        <div className="lg:col-span-9 space-y-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-4">
              <p className="text-xs text-slate-500">طلبات نشطة حالياً</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                {activeRides.length}
              </p>
            </div>
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-4">
              <p className="text-xs text-slate-500">إجمالي الرحلات</p>
              <p className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                {state.rides.length}
              </p>
            </div>
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-4">
              <p className="text-xs text-slate-500">طلبات سائقين معلّقة</p>
              <p className="text-2xl font-extrabold text-amber-700 tabular-nums mt-1">
                {pendingDrivers.length}
              </p>
            </div>
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-4">
              <p className="text-xs text-slate-500">بلاغات مفتوحة</p>
              <p className="text-2xl font-extrabold text-red-700 tabular-nums mt-1">
                {openReports.length}
              </p>
            </div>
          </div>

          {tab === 'overview' && (
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-[#EFECE4] pb-3">
                الرحلات النشطة والطلبات المفتوحة
              </h2>
              {activeRides.length === 0 ? (
                <p className="text-sm text-slate-500 py-8 text-center">
                  لا توجد رحلات نشطة حالياً. أنشئ طلباً من دور الراكب لمراقبته هنا.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[#EFECE4] text-slate-500">
                        <th className="py-2.5 px-2 font-bold">الراكب</th>
                        <th className="py-2.5 px-2 font-bold">المسار</th>
                        <th className="py-2.5 px-2 font-bold">الحالة</th>
                        <th className="py-2.5 px-2 font-bold">الأجرة</th>
                        <th className="py-2.5 px-2 font-bold">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE4]">
                      {activeRides.map((r) => (
                        <tr key={r.id} className="hover:bg-stone-50">
                          <td className="py-3 px-2 font-bold text-slate-900">{r.passengerName}</td>
                          <td className="py-3 px-2 text-slate-700">
                            {r.pickup.name} ← {r.destination.name}
                          </td>
                          <td className="py-3 px-2 font-semibold text-teal-800">
                            {getRideStateLabel(r.state)}
                          </td>
                          <td className="py-3 px-2 font-mono-num font-bold">
                            {r.agreedFareEgp ?? r.passengerFareEgp} ج.م
                          </td>
                          <td className="py-3 px-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCancelTargetId(r.id);
                                setCancelReason('');
                              }}
                              className="min-h-[36px] px-3 py-1 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 font-bold flex items-center gap-1 whitespace-nowrap"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>إلغاء يدوي</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'applications' && (
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-[#EFECE4] pb-3">
                مراجعة طلبات انضمام السائقين
              </h2>
              <div className="divide-y divide-[#EFECE4]">
                {state.drivers.map((drv) => (
                  <div
                    key={drv.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <AvatarWithFallback src={drv.avatarUrl} alt={drv.name} />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-900">
                          {drv.name} · <span className="font-mono-num">{drv.vehicleCode}</span>
                        </p>
                        <p className="text-xs text-slate-600 font-mono-num">
                          {drv.phone} · {getDriverAppStatusLabel(drv.applicationStatus)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          المستندات التجريبية:{' '}
                          {drv.documents.map((d) => d.mockFileName).join(' · ') || 'لا يوجد'}
                        </p>
                        {drv.rejectionReason && (
                          <p className="text-xs text-red-700">سبب الرفض: {drv.rejectionReason}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {drv.applicationStatus !== 'under_review' &&
                        drv.applicationStatus !== 'approved' && (
                          <button
                            type="button"
                            onClick={() => adminUpdateDriverStatus(drv.id, 'under_review')}
                            className="min-h-[38px] px-3 py-1.5 border border-[#D8D3C8] rounded-xl text-xs font-semibold text-slate-700 hover:bg-stone-50"
                          >
                            قيد المراجعة
                          </button>
                        )}
                      {drv.applicationStatus !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => {
                            adminUpdateDriverStatus(drv.id, 'approved');
                            setAdminNotice(`تم اعتماد السائق ${drv.name} بنجاح.`);
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>موافقة</span>
                        </button>
                      )}
                      {drv.applicationStatus !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTargetId(drv.id);
                            setRejectReason('');
                          }}
                          className="min-h-[38px] px-3.5 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 rounded-xl text-xs font-bold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>رفض</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'directory' && (
            <div className="space-y-5">
              <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">الركاب ({state.passengers.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[#EFECE4] text-slate-500">
                        <th className="py-2 px-2">الاسم</th>
                        <th className="py-2 px-2">الموبايل</th>
                        <th className="py-2 px-2">المدينة</th>
                        <th className="py-2 px-2">الرحلات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE4]">
                      {state.passengers.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-2 font-bold text-slate-900">{p.name}</td>
                          <td className="py-2.5 px-2 font-mono-num">{p.phone}</td>
                          <td className="py-2.5 px-2">{p.city}</td>
                          <td className="py-2.5 px-2 tabular-nums">{p.totalTrips}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-3">
                <h2 className="text-base font-extrabold text-slate-900">سجل جميع الرحلات ({state.rides.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-[#EFECE4] text-slate-500">
                        <th className="py-2 px-2">الراكب</th>
                        <th className="py-2 px-2">من ← إلى</th>
                        <th className="py-2 px-2">الحالة</th>
                        <th className="py-2 px-2">الأجرة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE4]">
                      {state.rides.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 px-2 font-bold text-slate-900">{r.passengerName}</td>
                          <td className="py-2.5 px-2">
                            {r.pickup.name} ← {r.destination.name}
                          </td>
                          <td className="py-2.5 px-2">{getRideStateLabel(r.state)}</td>
                          <td className="py-2.5 px-2 font-mono-num font-bold">
                            {r.agreedFareEgp ?? r.passengerFareEgp} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'reports' && (
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-4">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-[#EFECE4] pb-3">
                بلاغات المشاكل ({state.reports.length})
              </h2>
              {state.reports.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">لا توجد بلاغات.</p>
              ) : (
                <div className="divide-y divide-[#EFECE4]">
                  {state.reports.map((rep) => (
                    <div key={rep.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-500 flex items-center gap-2">
                          <span className="font-bold text-slate-900">{rep.category}</span>
                          <span aria-hidden="true">·</span>
                          <span>بواسطة {rep.reporterName}</span>
                          <span aria-hidden="true">·</span>
                          <span className={rep.status === 'open' ? 'text-red-700 font-bold' : 'text-emerald-700 font-bold'}>
                            {rep.status === 'open' ? 'مفتوح' : 'تمت المراجعة'}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800">{rep.details}</p>
                      </div>
                      {rep.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => adminResolveReport(rep.id)}
                          className="min-h-[38px] px-3.5 py-1.5 bg-teal-700 text-white rounded-xl text-xs font-bold shrink-0"
                        >
                          تحديد كمراجع
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'config' && (
            <form
              onSubmit={handleSaveConfig}
              className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-5"
            >
              <h2 className="text-base font-extrabold text-slate-900 border-b border-[#EFECE4] pb-3">
                إعدادات نطاق الخدمة والتسعير الاسترشادي (تجريبي)
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="zone-name" className="block text-xs font-bold text-slate-700">
                    اسم نطاق الخدمة
                  </label>
                  <input
                    id="zone-name"
                    type="text"
                    value={zoneDraft.name}
                    onChange={(e) => setZoneDraft({ ...zoneDraft, name: e.target.value })}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="zone-radius" className="block text-xs font-bold text-slate-700">
                    نصف القطر المسموح (كم)
                  </label>
                  <input
                    id="zone-radius"
                    type="number"
                    step="0.5"
                    min={1}
                    max={40}
                    value={zoneDraft.radiusKm}
                    onChange={(e) =>
                      setZoneDraft({ ...zoneDraft, radiusKm: Number(e.target.value) || 1 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] font-mono-num text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="fare-base" className="block text-xs font-bold text-slate-700">
                    بداية العداد الاسترشادي (ج.م)
                  </label>
                  <input
                    id="fare-base"
                    type="number"
                    min={5}
                    value={fareDraft.baseFareEgp}
                    onChange={(e) =>
                      setFareDraft({ ...fareDraft, baseFareEgp: Number(e.target.value) || 5 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] font-mono-num text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="fare-km" className="block text-xs font-bold text-slate-700">
                    سعر الكيلومتر الاسترشادي (ج.م)
                  </label>
                  <input
                    id="fare-km"
                    type="number"
                    min={1}
                    value={fareDraft.perKmEgp}
                    onChange={(e) =>
                      setFareDraft({ ...fareDraft, perKmEgp: Number(e.target.value) || 1 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] font-mono-num text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="fare-min" className="block text-xs font-bold text-slate-700">
                    الحد الأدنى للأجرة (ج.م)
                  </label>
                  <input
                    id="fare-min"
                    type="number"
                    min={5}
                    value={fareDraft.minFareEgp}
                    onChange={(e) =>
                      setFareDraft({ ...fareDraft, minFareEgp: Number(e.target.value) || 5 })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] font-mono-num text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="offer-ttl" className="block text-xs font-bold text-slate-700">
                    مهلة صلاحية العرض (ثانية)
                  </label>
                  <input
                    id="offer-ttl"
                    type="number"
                    min={15}
                    max={300}
                    value={fareDraft.offerLifetimeSeconds}
                    onChange={(e) =>
                      setFareDraft({
                        ...fareDraft,
                        offerLifetimeSeconds: Number(e.target.value) || 60,
                      })
                    }
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] font-mono-num text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[46px] px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold rounded-xl text-sm"
              >
                حفظ إعدادات النطاق والتسعير
              </button>
            </form>
          )}

          {tab === 'audit' && (
            <div className="bg-white border border-[#E5E1D8] rounded-2xl p-5 space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-[#EFECE4] pb-3">
                سجل إجراءات الإدارة (Audit Log)
              </h2>
              <div className="divide-y divide-[#EFECE4]">
                {state.auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-900">{log.action}</p>
                      <p className="text-slate-600">{log.details}</p>
                    </div>
                    <span className="text-slate-500 font-mono-num shrink-0">
                      {new Date(log.timestamp).toLocaleString('ar-EG')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reject Driver Modal */}
      {rejectTargetId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleConfirmReject} className="bg-white border border-[#E5E1D8] rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">رفض طلب السائق</h3>
            <div className="space-y-1.5">
              <label htmlFor="rej-reason" className="block text-xs font-bold text-slate-700">
                سبب الرفض (إلزامي)
              </label>
              <input
                id="rej-reason"
                type="text"
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثال: رقم التوكتوك غير واضح..."
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="flex-1 min-h-[44px] bg-red-700 text-white font-bold rounded-xl text-sm">
                تأكيد الرفض
              </button>
              <button
                type="button"
                onClick={() => setRejectTargetId(null)}
                className="min-h-[44px] px-4 border border-[#D8D3C8] rounded-xl text-sm font-semibold"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Ride Cancel Modal */}
      {cancelTargetId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleConfirmManualCancel} className="bg-white border border-[#E5E1D8] rounded-2xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-extrabold text-slate-900">إلغاء الرحلة إدارياً</h3>
            <div className="space-y-1.5">
              <label htmlFor="adm-cancel-reason" className="block text-xs font-bold text-slate-700">
                سبب الإلغاء (إلزامي للتسجيل في سجل المراجعة)
              </label>
              <input
                id="adm-cancel-reason"
                type="text"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="مثال: طلب الراكب عبر الدعم / خلل في البيانات..."
                className="w-full min-h-[44px] px-3 rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <button type="submit" className="flex-1 min-h-[44px] bg-red-700 text-white font-bold rounded-xl text-sm">
                تأكيد الإلغاء
              </button>
              <button
                type="button"
                onClick={() => setCancelTargetId(null)}
                className="min-h-[44px] px-4 border border-[#D8D3C8] rounded-xl text-sm font-semibold"
              >
                تراجع
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
