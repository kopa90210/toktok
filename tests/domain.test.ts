import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInitialDemoState } from '../src/data/seedData';
import {
  calculateSuggestedFare,
  canDriverGoOnline,
  canTransitionOffer,
  canTransitionRide,
  haversineDistanceKm,
  isInsideServiceZone,
  normalizeArabicDigits,
  selectOfferAtomically,
  transitionRideState,
  validateEgyptianPhone,
} from '../src/domain/stateMachine';
import { DriverOffer, RideRequest, RideState } from '../src/domain/types';
import { ASWAN_SAMPLE_LANDMARKS, mapProvider } from '../src/services/mapProvider';

/**
 * NOTE: These unit tests validate single-process client demo domain logic only.
 * They do NOT test cross-user concurrency, distributed locking, or database transactions.
 */

function makeRide(overrides: Partial<RideRequest> = {}): RideRequest {
  return {
    id: 'ride-test-1',
    passengerId: 'pass-1',
    passengerName: 'نورا حسن',
    passengerPhone: '01012345678',
    pickup: ASWAN_SAMPLE_LANDMARKS[0],
    destination: ASWAN_SAMPLE_LANDMARKS[2],
    distanceKm: 3.2,
    estimatedMinutes: 11,
    suggestedFareEgp: 30,
    passengerFareEgp: 25,
    paymentMethod: 'cash',
    state: 'offers_open',
    tripStartOtp: '5512',
    driverProgressPct: 0,
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<DriverOffer> = {}): DriverOffer {
  return {
    id: 'off-1',
    rideId: 'ride-test-1',
    driverId: 'drv-karim',
    driverName: 'كريم النوبي',
    driverRating: 4.9,
    driverTripCount: 48,
    vehicleCode: 'أسوان-١٠٤',
    priceEgp: 25,
    etaMinutes: 3,
    state: 'submitted',
    isCounterOffer: false,
    isSimulated: true,
    createdAt: 1000,
    expiresAt: 61000,
    ...overrides,
  };
}

describe('Ride state machine transitions (single-process demo logic)', () => {
  it('allows valid sequential lifecycle transitions from requested to completed', () => {
    const validChain: RideState[] = [
      'requested',
      'offers_open',
      'driver_selected',
      'driver_arriving',
      'driver_arrived',
      'in_progress',
      'completed',
    ];

    let ride = makeRide({ state: 'requested' });
    for (let i = 1; i < validChain.length; i++) {
      const next = validChain[i];
      assert.equal(canTransitionRide(ride.state, next), true);
      const res = transitionRideState(ride, next);
      assert.equal(res.ok, true);
      if (res.ok) {
        ride = res.ride;
        assert.equal(ride.state, next);
      }
    }
  });

  it('rejects invalid shortcuts and transitions out of terminal states', () => {
    assert.equal(canTransitionRide('requested', 'in_progress'), false);
    assert.equal(canTransitionRide('offers_open', 'completed'), false);
    assert.equal(canTransitionRide('driver_selected', 'completed'), false);
    assert.equal(canTransitionRide('completed', 'cancelled'), false);
    assert.equal(canTransitionRide('cancelled', 'offers_open'), false);
    assert.equal(canTransitionRide('no_driver', 'driver_selected'), false);
    assert.equal(canTransitionRide('expired', 'in_progress'), false);

    const completedRide = makeRide({ state: 'completed' });
    const res = transitionRideState(completedRide, 'cancelled');
    assert.equal(res.ok, false);
  });

  it('validates offer state transitions', () => {
    assert.equal(canTransitionOffer('submitted', 'selected'), true);
    assert.equal(canTransitionOffer('submitted', 'rejected'), true);
    assert.equal(canTransitionOffer('submitted', 'withdrawn'), true);
    assert.equal(canTransitionOffer('submitted', 'expired'), true);
    assert.equal(canTransitionOffer('expired', 'selected'), false);
    assert.equal(canTransitionOffer('rejected', 'selected'), false);
    assert.equal(canTransitionOffer('selected', 'withdrawn'), false);
  });
});

describe('Single-process offer selection rules', () => {
  it('rejects an expired offer even if its stored state is still submitted', () => {
    const ride = makeRide({ state: 'offers_open' });
    const expiredOffer = makeOffer({ id: 'off-exp', expiresAt: 5000 });
    const res = selectOfferAtomically(ride, [expiredOffer], 'off-exp', 5000);
    assert.equal(res.ok, false);
  });

  it('rejects selecting an offer with non-submitted state', () => {
    const ride = makeRide({ state: 'offers_open' });
    const withdrawnOffer = makeOffer({ id: 'off-w', state: 'withdrawn' });
    const res = selectOfferAtomically(ride, [withdrawnOffer], 'off-w', 2000);
    assert.equal(res.ok, false);
  });

  it('copies offered fare and selected driver correctly and rejects competing offers', () => {
    const ride = makeRide({ id: 'ride-1', state: 'offers_open', passengerFareEgp: 25 });
    const offer1 = makeOffer({
      id: 'off-1',
      rideId: 'ride-1',
      driverId: 'drv-karim',
      priceEgp: 25,
    });
    const offer2 = makeOffer({
      id: 'off-2',
      rideId: 'ride-1',
      driverId: 'drv-mahmoud',
      priceEgp: 35,
      isCounterOffer: true,
    });
    const unrelatedOffer = makeOffer({
      id: 'off-other-ride',
      rideId: 'ride-other',
      driverId: 'drv-karim',
      priceEgp: 40,
    });

    const first = selectOfferAtomically(ride, [offer1, offer2, unrelatedOffer], 'off-2', 2000);
    assert.equal(first.ok, true);
    if (first.ok) {
      assert.equal(first.ride.state, 'driver_selected');
      assert.equal(first.ride.selectedDriverId, 'drv-mahmoud');
      assert.equal(first.ride.selectedOfferId, 'off-2');
      assert.equal(first.ride.agreedFareEgp, 35);

      const chosen = first.offers.find((o) => o.id === 'off-2');
      const rival = first.offers.find((o) => o.id === 'off-1');
      const other = first.offers.find((o) => o.id === 'off-other-ride');
      assert.equal(chosen?.state, 'selected');
      assert.equal(rival?.state, 'rejected');
      assert.equal(other?.state, 'submitted');

      // A second offer cannot be selected once the ride leaves offers_open
      const second = selectOfferAtomically(first.ride, first.offers, 'off-1', 2100);
      assert.equal(second.ok, false);
    }
  });
});

describe('Phone validation, driver approval gate, and Aswan service zone checks', () => {
  it('validates Egyptian mobile numbers including Arabic digits and +20 prefix', () => {
    assert.deepEqual(validateEgyptianPhone('01012345678'), {
      valid: true,
      normalized: '01012345678',
    });
    assert.deepEqual(validateEgyptianPhone('٠١١٢٣٤٥٦٧٨٩'), {
      valid: true,
      normalized: '01123456789',
    });
    assert.deepEqual(validateEgyptianPhone('+20 12 3456 7890'), {
      valid: true,
      normalized: '01234567890',
    });
    assert.equal(validateEgyptianPhone('0223456789').valid, false);
    assert.equal(validateEgyptianPhone('0101234').valid, false);
    assert.equal(normalizeArabicDigits('٤٨٢٩'), '4829');
  });

  it('enforces service zone boundaries and suggested fare floor/ceiling', () => {
    const init = createInitialDemoState();
    const inZone = ASWAN_SAMPLE_LANDMARKS.find((l) => l.id === 'lm-station')!;
    const outOfZone = ASWAN_SAMPLE_LANDMARKS.find((l) => l.category === 'out_of_zone')!;

    assert.equal(isInsideServiceZone(inZone.coords, init.serviceZone), true);
    assert.equal(isInsideServiceZone(outOfZone.coords, init.serviceZone), false);
    assert.ok(haversineDistanceKm(inZone.coords, outOfZone.coords) > init.serviceZone.radiusKm);

    assert.equal(calculateSuggestedFare(0.2, init.fareConfig), init.fareConfig.minFareEgp);
    assert.equal(calculateSuggestedFare(100, init.fareConfig), init.fareConfig.maxSuggestedEgp);
  });

  it('allows only approved drivers to go online', () => {
    assert.equal(canDriverGoOnline('draft'), false);
    assert.equal(canDriverGoOnline('submitted'), false);
    assert.equal(canDriverGoOnline('under_review'), false);
    assert.equal(canDriverGoOnline('rejected'), false);
    assert.equal(canDriverGoOnline('approved'), true);
  });

  it('returns simulated location errors when denied or GPS unavailable', async () => {
    const denied = await mapProvider.getCurrentLocation({
      permissionDenied: true,
      gpsUnavailable: false,
    });
    assert.equal(denied.ok, false);
    if (!denied.ok) assert.equal(denied.reason, 'permission_denied');

    const unavailable = await mapProvider.getCurrentLocation({
      permissionDenied: false,
      gpsUnavailable: true,
    });
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) assert.equal(unavailable.reason, 'gps_unavailable');
  });
});
