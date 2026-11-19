import React, { useState } from 'react';
import { Settings2 } from 'lucide-react';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DemoControlsModal } from './components/DemoControlsModal';
import { DriverDashboard } from './components/driver/DriverDashboard';
import { DriverOnboarding } from './components/driver/DriverOnboarding';
import { PassengerHomeAndRide } from './components/passenger/PassengerHomeAndRide';
import { PassengerOnboarding } from './components/passenger/PassengerOnboarding';
import { DemoStoreProvider, useDemoStore } from './store/DemoStoreContext';

const AppShell: React.FC = () => {
  const { state, setActiveRole } = useDemoStore();
  const [controlsOpen, setControlsOpen] = useState(false);

  const activeSimCount = Object.values(state.simulationFlags).filter(Boolean).length;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8] text-slate-900">
      {/* Compact 3-zone top bar + persistent demo notice */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E1D8]">
        <div className="bg-amber-50 border-b border-amber-200 px-3 py-1 text-center text-[11px] font-bold text-amber-950">
          نسخة تجريبية — لا توجد رحلات أو سائقون حقيقيون
        </div>
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Wordmark */}
          <button
            type="button"
            onClick={() => setActiveRole('passenger')}
            className="text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
          >
            توك أسوان
          </button>

          {/* Zone 2: Role Switcher */}
          <nav
            aria-label="التبديل بين أدوار النموذج التجريبي"
            className="flex items-center gap-1 p-1 bg-[#EFECE4] rounded-xl shrink-0"
          >
            {[
              { id: 'passenger' as const, label: 'الراكب' },
              { id: 'driver' as const, label: 'السائق' },
              { id: 'admin' as const, label: 'الإدارة' },
            ].map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setActiveRole(role.id)}
                className={`min-h-[36px] px-3 sm:px-4 py-1 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  state.activeRole === role.id
                    ? 'bg-white text-teal-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {role.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single utility/test controls action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setControlsOpen(true)}
              className="min-h-[38px] px-3 py-1.5 text-xs font-bold rounded-xl border border-[#D8D3C8] bg-[#FAFAF8] hover:bg-stone-100 text-slate-800 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Settings2 className="w-4 h-4 text-teal-700" />
              <span className="hidden sm:inline">إعدادات الديمو</span>
              {activeSimCount > 0 && (
                <span className="font-mono-num text-amber-800">({activeSimCount})</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main viewport */}
      <main className="flex-1">
        {state.activeRole === 'passenger' &&
          (state.passengerOnboardingStep !== 'done' ? (
            <PassengerOnboarding />
          ) : (
            <PassengerHomeAndRide onOpenConfigGuide={() => setControlsOpen(true)} />
          ))}

        {state.activeRole === 'driver' &&
          (state.driverOnboardingStep !== 'done' ? (
            <DriverOnboarding />
          ) : (
            <DriverDashboard onOpenConfigGuide={() => setControlsOpen(true)} />
          ))}

        {state.activeRole === 'admin' && <AdminDashboard />}
      </main>

      <footer className="border-t border-[#E5E1D8] bg-white py-3 px-4 text-center text-[11px] text-slate-500">
        توك أسوان · نموذج أولي تفاعلي ببيانات محاكاة محلية في أسوان — لا يرسل رسائل حقيقية ولا يعالج مدفوعات أو تتبع GPS فعلي
      </footer>

      <DemoControlsModal open={controlsOpen} onClose={() => setControlsOpen(false)} />
    </div>
  );
};

export default function App() {
  return (
    <DemoStoreProvider>
      <AppShell />
    </DemoStoreProvider>
  );
}
