import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createInitialDemoState, DEMO_IMAGES } from '../data/seedData';
import {
  DemoSimulationFlags,
  DemoStoreState,
  DriverApplicationStatus,
  DriverDocument,
  DriverOffer,
  DriverProfile,
  FareConfig,
  PassengerProfile,
  RideRequest,
  ServiceZone,
  UserRole,
} from '../domain/types';
import { storageProvider } from '../services/storageProvider';
import {
  ActionOutcome,
  ActionResult,
  CreateRideInput,
  adminResolveReportAction,
  adminUpdateDriverStatusAction,
  adminUpdateServiceConfigAction,
  cancelRideAction,
  chooseDriverOfferAction,
  completeRideAction,
  createRideRequestAction,
  markDriverArrivedAction,
  markDriverArrivingAction,
  rateRideAction,
  retryRideSearchAction,
  startRideWithOtpAction,
  submitDriverOfferAction,
  submitRideReportAction,
  toggleDriverOnlineAction,
  updateSimulationFlagsAction,
  upsertDriverApplicationAction,
  upsertPassengerProfileAction,
  withdrawDriverOfferAction,
} from './demoStoreActions';

interface DemoStoreContextValue {
  state: DemoStoreState;
  activePassenger: PassengerProfile;
  activeDriver: DriverProfile;
  activePassengerRide: RideRequest | null;
  activeDriverRide: RideRequest | null;
  setActiveRole: (role: UserRole) => void;
  setActivePassengerId: (id: string) => void;
  setActiveDriverId: (id: string) => void;
  setPassengerOnboardingStep: (step: DemoStoreState['passengerOnboardingStep']) => void;
  setDriverOnboardingStep: (step: DemoStoreState['driverOnboardingStep']) => void;
  upsertPassengerProfile: (data: { name: string; phone: string; avatarUrl?: string }) => void;
  upsertDriverApplication: (data: {
    name: string;
    phone: string;
    vehicleCode: string;
    avatarUrl?: string;
    documents: DriverDocument[];
    submitNow: boolean;
  }) => void;
  toggleDriverOnline: () => ActionResult;
  createRideRequest: (input: CreateRideInput) => ActionResult<RideRequest>;
  retryRideSearch: (rideId: string) => ActionResult;
  chooseDriverOffer: (rideId: string, offerId: string) => ActionResult;
  cancelRide: (
    rideId: string,
    by: 'passenger' | 'driver' | 'admin',
    reason: string
  ) => ActionResult;
  submitDriverOffer: (
    rideId: string,
    driverId: string,
    priceEgp: number,
    isCounterOffer: boolean
  ) => ActionResult<DriverOffer>;
  withdrawDriverOffer: (offerId: string) => ActionResult;
  markDriverArriving: (rideId: string) => ActionResult;
  markDriverArrived: (rideId: string) => ActionResult;
  startRideWithOtp: (rideId: string, otpInput: string) => ActionResult;
  completeRide: (rideId: string) => ActionResult;
  rateRide: (rideId: string, stars: number, reason?: string) => ActionResult;
  submitRideReport: (data: {
    rideId: string;
    reporterRole: 'passenger' | 'driver';
    category: string;
    details: string;
  }) => ActionResult;
  adminUpdateDriverStatus: (
    driverId: string,
    status: DriverApplicationStatus,
    rejectionReason?: string
  ) => ActionResult;
  adminUpdateServiceConfig: (zone: ServiceZone, fare: FareConfig) => ActionResult;
  adminResolveReport: (reportId: string) => ActionResult;
  updateSimulationFlags: (patch: Partial<DemoSimulationFlags>) => void;
  resetDemoData: () => void;
}

const DemoStoreContext = createContext<DemoStoreContextValue | null>(null);

function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const DemoStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DemoStoreState>(() => {
    const saved = storageProvider.loadState();
    return saved ?? createInitialDemoState();
  });

  // Always points to the latest committed or synchronously transitioned state
  const stateRef = useRef<DemoStoreState>(state);
  stateRef.current = state;

  useEffect(() => {
    storageProvider.saveState(state);
  }, [state]);

  const commitPureUpdate = useCallback((updater: (prev: DemoStoreState) => DemoStoreState) => {
    setState((prev) => {
      const next = updater(prev);
      stateRef.current = next;
      return next;
    });
  }, []);

  const runAction = useCallback(
    <T = void>(fn: (curr: DemoStoreState) => ActionOutcome<T>): ActionResult<T> => {
      const outcome = fn(stateRef.current);
      if (outcome.nextState !== stateRef.current) {
        stateRef.current = outcome.nextState;
        setState(outcome.nextState);
      }
      return outcome.result;
    },
    []
  );

  // Offer expiration + automatic simulated driver offers ticker
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      commitPureUpdate((prev) => {
        let changed = false;

        const updatedOffers = prev.offers.map((offer) => {
          if (offer.state === 'submitted' && now >= offer.expiresAt) {
            changed = true;
            return { ...offer, state: 'expired' as const };
          }
          return offer;
        });

        const updatedRides = prev.rides.map((ride) => {
          if (ride.state === 'offers_open') {
            const rideOffers = updatedOffers.filter((o) => o.rideId === ride.id);
            const activeOffers = rideOffers.filter((o) => o.state === 'submitted');
            const ageSec = (now - ride.createdAt) / 1000;
            const maxWaitSec = prev.simulationFlags.fastOfferExpiry ? 18 : 75;
            if (rideOffers.length > 0 && activeOffers.length === 0 && ageSec > 10) {
              changed = true;
              return { ...ride, state: 'expired' as const, updatedAt: now };
            }
            if (rideOffers.length === 0 && ageSec > maxWaitSec) {
              changed = true;
              return { ...ride, state: 'no_driver' as const, updatedAt: now };
            }
          }

          if (ride.state === 'driver_arriving' && ride.driverProgressPct < 92) {
            changed = true;
            return {
              ...ride,
              driverProgressPct: Math.min(92, ride.driverProgressPct + 14),
              updatedAt: now,
            };
          }
          if (ride.state === 'in_progress' && ride.driverProgressPct < 95) {
            changed = true;
            return {
              ...ride,
              driverProgressPct: Math.min(95, ride.driverProgressPct + 12),
              updatedAt: now,
            };
          }

          return ride;
        });

        if (!changed) return prev;
        return { ...prev, offers: updatedOffers, rides: updatedRides };
      });
    }, 1500);

    return () => window.clearInterval(interval);
  }, [commitPureUpdate]);

  const activePassenger =
    state.passengers.find((p) => p.id === state.activePassengerId) ?? state.passengers[0];
  const activeDriver =
    state.drivers.find((d) => d.id === state.activeDriverId) ?? state.drivers[0];

  const activePassengerRide =
    state.rides
      .filter(
        (r) =>
          r.passengerId === activePassenger.id &&
          !['completed', 'cancelled'].includes(r.state)
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

  const activeDriverRide =
    state.rides
      .filter(
        (r) =>
          r.selectedDriverId === activeDriver.id &&
          ['driver_selected', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(
            r.state
          )
      )
      .sort((a, b) => b.createdAt - a.createdAt)[0] ?? null;

  const setActiveRole = useCallback(
    (role: UserRole) => commitPureUpdate((prev) => ({ ...prev, activeRole: role })),
    [commitPureUpdate]
  );

  const setActivePassengerId = useCallback(
    (id: string) => commitPureUpdate((prev) => ({ ...prev, activePassengerId: id })),
    [commitPureUpdate]
  );

  const setActiveDriverId = useCallback(
    (id: string) => commitPureUpdate((prev) => ({ ...prev, activeDriverId: id })),
    [commitPureUpdate]
  );

  const setPassengerOnboardingStep = useCallback(
    (step: DemoStoreState['passengerOnboardingStep']) =>
      commitPureUpdate((prev) => ({ ...prev, passengerOnboardingStep: step })),
    [commitPureUpdate]
  );

  const setDriverOnboardingStep = useCallback(
    (step: DemoStoreState['driverOnboardingStep']) =>
      commitPureUpdate((prev) => ({ ...prev, driverOnboardingStep: step })),
    [commitPureUpdate]
  );

  const upsertPassengerProfile = useCallback(
    (data: { name: string; phone: string; avatarUrl?: string }) => {
      runAction((curr) => upsertPassengerProfileAction(curr, data));
    },
    [runAction]
  );

  const upsertDriverApplication = useCallback(
    (data: {
      name: string;
      phone: string;
      vehicleCode: string;
      avatarUrl?: string;
      documents: DriverDocument[];
      submitNow: boolean;
    }) => {
      runAction((curr) => upsertDriverApplicationAction(curr, data));
    },
    [runAction]
  );

  const toggleDriverOnline = useCallback(
    () => runAction((curr) => toggleDriverOnlineAction(curr)),
    [runAction]
  );

  const scheduleSimulatedOffers = useCallback(
    (ride: RideRequest, flags: DemoSimulationFlags, fareConfig: FareConfig) => {
      if (flags.forceNoDrivers) {
        window.setTimeout(() => {
          commitPureUpdate((prev) => {
            const target = prev.rides.find((r) => r.id === ride.id);
            if (!target || (target.state !== 'requested' && target.state !== 'offers_open')) {
              return prev;
            }
            return {
              ...prev,
              rides: prev.rides.map((r) =>
                r.id === ride.id ? { ...r, state: 'no_driver', updatedAt: Date.now() } : r
              ),
            };
          });
        }, 2800);
        return;
      }

      const lifetimeMs = (flags.fastOfferExpiry ? 14 : fareConfig.offerLifetimeSeconds) * 1000;

      const simDrivers = [
        {
          id: 'drv-karim',
          name: 'كريم النوبي',
          avatarUrl: DEMO_IMAGES.driverKarim,
          rating: 4.9,
          tripCount: 48,
          vehicleCode: 'أسوان-١٠٤',
          priceDelta: 0,
          eta: 3,
          delay: 1400,
        },
        {
          id: 'drv-mahmoud',
          name: 'محمود أبو زيد',
          avatarUrl: DEMO_IMAGES.driverMahmoud,
          rating: 4.7,
          tripCount: 21,
          vehicleCode: 'أسوان-٢١٧',
          priceDelta: 5,
          eta: 2,
          delay: 2800,
        },
        {
          id: 'drv-new-sim',
          name: 'مصطفى حسنين',
          avatarUrl: DEMO_IMAGES.driverTarek,
          rating: null,
          tripCount: 0,
          vehicleCode: 'أسوان-٤١٢',
          priceDelta: -5,
          eta: 5,
          delay: 4200,
        },
      ];

      window.setTimeout(() => {
        commitPureUpdate((prev) => ({
          ...prev,
          rides: prev.rides.map((r) =>
            r.id === ride.id && r.state === 'requested'
              ? { ...r, state: 'offers_open', updatedAt: Date.now() }
              : r
          ),
        }));
      }, 650);

      simDrivers.forEach((sd) => {
        window.setTimeout(() => {
          commitPureUpdate((prev) => {
            const targetRide = prev.rides.find((r) => r.id === ride.id);
            if (
              !targetRide ||
              (targetRide.state !== 'offers_open' && targetRide.state !== 'requested')
            ) {
              return prev;
            }
            const alreadyOffered = prev.offers.some(
              (o) => o.rideId === ride.id && o.driverId === sd.id && o.state === 'submitted'
            );
            if (alreadyOffered) return prev;

            const proposedPrice = Math.max(
              prev.fareConfig.minFareEgp,
              ride.passengerFareEgp + sd.priceDelta
            );

            const newOffer: DriverOffer = {
              id: makeId('off'),
              rideId: ride.id,
              driverId: sd.id,
              driverName: sd.name,
              driverAvatarUrl: sd.avatarUrl,
              driverRating: sd.rating,
              driverTripCount: sd.tripCount,
              vehicleCode: sd.vehicleCode,
              priceEgp: proposedPrice,
              etaMinutes: sd.eta,
              state: 'submitted',
              isCounterOffer: proposedPrice !== ride.passengerFareEgp,
              isSimulated: true,
              createdAt: Date.now(),
              expiresAt: Date.now() + lifetimeMs,
            };

            return {
              ...prev,
              rides: prev.rides.map((r) =>
                r.id === ride.id && r.state === 'requested'
                  ? { ...r, state: 'offers_open', updatedAt: Date.now() }
                  : r
              ),
              offers: [newOffer, ...prev.offers],
            };
          });
        }, sd.delay);
      });
    },
    [commitPureUpdate]
  );

  const createRideRequest = useCallback(
    (input: CreateRideInput): ActionResult<RideRequest> => {
      const res = runAction((curr) => createRideRequestAction(curr, input));
      if (res.ok && res.data) {
        scheduleSimulatedOffers(
          res.data,
          stateRef.current.simulationFlags,
          stateRef.current.fareConfig
        );
      }
      return res;
    },
    [runAction, scheduleSimulatedOffers]
  );

  const retryRideSearch = useCallback(
    (rideId: string): ActionResult => {
      const res = runAction((curr) => retryRideSearchAction(curr, rideId));
      if (res.ok && res.data) {
        scheduleSimulatedOffers(
          res.data,
          stateRef.current.simulationFlags,
          stateRef.current.fareConfig
        );
      }
      return { ok: res.ok, error: res.error };
    },
    [runAction, scheduleSimulatedOffers]
  );

  const chooseDriverOffer = useCallback(
    (rideId: string, offerId: string): ActionResult =>
      runAction((curr) => chooseDriverOfferAction(curr, rideId, offerId)),
    [runAction]
  );

  const cancelRide = useCallback(
    (rideId: string, by: 'passenger' | 'driver' | 'admin', reason: string): ActionResult =>
      runAction((curr) => cancelRideAction(curr, rideId, by, reason)),
    [runAction]
  );

  const submitDriverOffer = useCallback(
    (
      rideId: string,
      driverId: string,
      priceEgp: number,
      isCounterOffer: boolean
    ): ActionResult<DriverOffer> =>
      runAction((curr) => submitDriverOfferAction(curr, rideId, driverId, priceEgp, isCounterOffer)),
    [runAction]
  );

  const withdrawDriverOffer = useCallback(
    (offerId: string): ActionResult =>
      runAction((curr) => withdrawDriverOfferAction(curr, offerId)),
    [runAction]
  );

  const markDriverArriving = useCallback(
    (rideId: string): ActionResult =>
      runAction((curr) => markDriverArrivingAction(curr, rideId)),
    [runAction]
  );

  const markDriverArrived = useCallback(
    (rideId: string): ActionResult =>
      runAction((curr) => markDriverArrivedAction(curr, rideId)),
    [runAction]
  );

  const startRideWithOtp = useCallback(
    (rideId: string, otpInput: string): ActionResult =>
      runAction((curr) => startRideWithOtpAction(curr, rideId, otpInput)),
    [runAction]
  );

  const completeRide = useCallback(
    (rideId: string): ActionResult => runAction((curr) => completeRideAction(curr, rideId)),
    [runAction]
  );

  const rateRide = useCallback(
    (rideId: string, stars: number, reason?: string): ActionResult =>
      runAction((curr) => rateRideAction(curr, rideId, stars, reason)),
    [runAction]
  );

  const submitRideReport = useCallback(
    (data: {
      rideId: string;
      reporterRole: 'passenger' | 'driver';
      category: string;
      details: string;
    }): ActionResult => runAction((curr) => submitRideReportAction(curr, data)),
    [runAction]
  );

  const adminUpdateDriverStatus = useCallback(
    (
      driverId: string,
      status: DriverApplicationStatus,
      rejectionReason?: string
    ): ActionResult =>
      runAction((curr) => adminUpdateDriverStatusAction(curr, driverId, status, rejectionReason)),
    [runAction]
  );

  const adminUpdateServiceConfig = useCallback(
    (zone: ServiceZone, fare: FareConfig): ActionResult =>
      runAction((curr) => adminUpdateServiceConfigAction(curr, zone, fare)),
    [runAction]
  );

  const adminResolveReport = useCallback(
    (reportId: string): ActionResult =>
      runAction((curr) => adminResolveReportAction(curr, reportId)),
    [runAction]
  );

  const updateSimulationFlags = useCallback(
    (patch: Partial<DemoSimulationFlags>) =>
      commitPureUpdate((prev) => updateSimulationFlagsAction(prev, patch)),
    [commitPureUpdate]
  );

  const resetDemoData = useCallback(() => {
    storageProvider.clearState();
    const fresh = createInitialDemoState();
    stateRef.current = fresh;
    setState(fresh);
  }, []);

  return (
    <DemoStoreContext.Provider
      value={{
        state,
        activePassenger,
        activeDriver,
        activePassengerRide,
        activeDriverRide,
        setActiveRole,
        setActivePassengerId,
        setActiveDriverId,
        setPassengerOnboardingStep,
        setDriverOnboardingStep,
        upsertPassengerProfile,
        upsertDriverApplication,
        toggleDriverOnline,
        createRideRequest,
        retryRideSearch,
        chooseDriverOffer,
        cancelRide,
        submitDriverOffer,
        withdrawDriverOffer,
        markDriverArriving,
        markDriverArrived,
        startRideWithOtp,
        completeRide,
        rateRide,
        submitRideReport,
        adminUpdateDriverStatus,
        adminUpdateServiceConfig,
        adminResolveReport,
        updateSimulationFlags,
        resetDemoData,
      }}
    >
      {children}
    </DemoStoreContext.Provider>
  );
};

export function useDemoStore(): DemoStoreContextValue {
  const ctx = useContext(DemoStoreContext);
  if (!ctx) throw new Error('useDemoStore must be used inside DemoStoreProvider');
  return ctx;
}
