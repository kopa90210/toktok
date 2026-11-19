import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createInitialDemoState } from '../src/data/seedData';
import { DriverOffer } from '../src/domain/types';
import { ASWAN_SAMPLE_LANDMARKS } from '../src/services/mapProvider';
import {
  adminUpdateDriverStatusAction,
  cancelRideAction,
  chooseDriverOfferAction,
  completeRideAction,
  createRideRequestAction,
  markDriverArrivedAction,
  markDriverArrivingAction,
  rateRideAction,
  startRideWithOtpAction,
  submitDriverOfferAction,
  toggleDriverOnlineAction,
  withdrawDriverOfferAction,
} from '../src/store/demoStoreActions';

/**
 * NOTE: Tests synchronous single-process store action outcomes and demonstrates
 * why deferred React setState(updater) callbacks must NOT be used to populate
 * synchronous ActionResult return values.
 */

describe('Reproduction: deferred React setState updater causes false { ok: true }', () => {
  it('reproduces why reading resultError mutated inside a queued setState updater fails', () => {
    type State = { rides: Array<{ id: string }> };
    let committed: State = { rides: [] };
    const queuedUpdaters: Array<(prev: State) => State> = [];

    const queuedSetState = (updater: (prev: State) => State) => {
      // React queues updaters and executes them during the next render flush, NOT synchronously.
      queuedUpdaters.push(updater);
    };

    const buggyChooseDriverOffer = (rideId: string) => {
      let resultError: string | undefined;
      queuedSetState((prev) => {
        const ride = prev.rides.find((r) => r.id === rideId);
        if (!ride) {
          resultError = 'الرحلة غير موجودة.';
          return prev;
        }
        return prev;
      });
      return resultError ? { ok: false, error: resultError } : { ok: true };
    };

    const badResult = buggyChooseDriverOffer('non-existent-ride');
    // Demonstrates the bug: returned { ok: true } even though the ride did not exist!
    assert.equal(badResult.ok, true);

    // Only after flushing would resultError have been assigned inside the updater.
    committed = queuedUpdaters[0](committed);
    assert.equal(committed.rides.length, 0);
  });
});

describe('Fixed synchronous store actions return accurate ok/error results', () => {
  it('chooseDriverOfferAction returns ok: false on missing ride, expired offer, or second selection', () => {
    const base = createInitialDemoState();

    // Missing ride
    const missingRes = chooseDriverOfferAction(base, 'missing-ride', 'missing-offer');
    assert.equal(missingRes.result.ok, false);
    assert.ok(missingRes.result.error);

    // Create a ride synchronously
    const created = createRideRequestAction(base, {
      pickup: ASWAN_SAMPLE_LANDMARKS[0],
      destination: ASWAN_SAMPLE_LANDMARKS[2],
      passengerFareEgp: 30,
    });
    assert.equal(created.result.ok, true);
    const ride = created.result.data!;

    // Driver submits an offer
    const offered = submitDriverOfferAction(
      created.nextState,
      ride.id,
      'drv-karim',
      35,
      true,
      10000
    );
    assert.equal(offered.result.ok, true);
    const offer1 = offered.result.data!;

    // Add a second offer
    const offered2 = submitDriverOfferAction(
      offered.nextState,
      ride.id,
      'drv-mahmoud',
      30,
      false,
      10000
    );
    assert.equal(offered2.result.ok, true);
    const offer2 = offered2.result.data!;

    // Selecting offer1 after expiry returns ok: false synchronously
    const expiredPick = chooseDriverOfferAction(
      offered2.nextState,
      ride.id,
      offer1.id,
      offer1.expiresAt + 1
    );
    assert.equal(expiredPick.result.ok, false);

    // Selecting valid offer1 succeeds and updates ride & offers
    const validPick = chooseDriverOfferAction(offered2.nextState, ride.id, offer1.id, 12000);
    assert.equal(validPick.result.ok, true);
    const updatedRide = validPick.nextState.rides.find((r) => r.id === ride.id)!;
    assert.equal(updatedRide.state, 'driver_arriving');
    assert.equal(updatedRide.agreedFareEgp, 35);
    assert.equal(updatedRide.selectedDriverId, 'drv-karim');

    // Second offer cannot be selected once ride left offers_open
    const secondPick = chooseDriverOfferAction(validPick.nextState, ride.id, offer2.id, 12500);
    assert.equal(secondPick.result.ok, false);
  });

  it('enforces synchronous error reporting on invalid ride lifecycle, OTP, cancel, rate, and admin calls', () => {
    const base = createInitialDemoState();

    // Cannot mark missing ride arrived or completed
    assert.equal(markDriverArrivingAction(base, 'no-ride').result.ok, false);
    assert.equal(markDriverArrivedAction(base, 'no-ride').result.ok, false);
    assert.equal(completeRideAction(base, 'no-ride').result.ok, false);

    // Cannot cancel already-completed historical ride
    assert.equal(cancelRideAction(base, 'ride-hist-1', 'passenger', 'test').result.ok, false);

    // Admin cancel requires reason
    const created = createRideRequestAction(base, {
      pickup: ASWAN_SAMPLE_LANDMARKS[0],
      destination: ASWAN_SAMPLE_LANDMARKS[1],
      passengerFareEgp: 25,
    });
    const ride = created.result.data!;
    assert.equal(cancelRideAction(created.nextState, ride.id, 'admin', '   ').result.ok, false);
    assert.equal(cancelRideAction(created.nextState, ride.id, 'admin', 'طلب العميل').result.ok, true);

    // Unapproved driver cannot go online; admin approval enables it
    const pendingState = { ...base, activeDriverId: 'drv-tarek' };
    assert.equal(toggleDriverOnlineAction(pendingState).result.ok, false);
    const approved = adminUpdateDriverStatusAction(pendingState, 'drv-tarek', 'approved');
    assert.equal(approved.result.ok, true);
    assert.equal(toggleDriverOnlineAction(approved.nextState).result.ok, true);

    // Missing driver / missing offer return ok: false
    assert.equal(adminUpdateDriverStatusAction(base, 'no-driver', 'approved').result.ok, false);
    assert.equal(withdrawDriverOfferAction(base, 'no-offer').result.ok, false);

    // Full consecutive synchronous ride completion + OTP validation + rating
    const offerRes = submitDriverOfferAction(created.nextState, ride.id, 'drv-karim', 25, false, 1000);
    const picked = chooseDriverOfferAction(offerRes.nextState, ride.id, offerRes.result.data!.id, 1500);
    // Cannot start before driver_arrived
    assert.equal(startRideWithOtpAction(picked.nextState, ride.id, ride.tripStartOtp).result.ok, false);
    const arrived = markDriverArrivedAction(picked.nextState, ride.id);
    assert.equal(arrived.result.ok, true);
    // Wrong OTP fails synchronously
    assert.equal(startRideWithOtpAction(arrived.nextState, ride.id, '0000').result.ok, false);
    // Correct OTP succeeds
    const started = startRideWithOtpAction(arrived.nextState, ride.id, ride.tripStartOtp);
    assert.equal(started.result.ok, true);
    // Rate before completion fails
    assert.equal(rateRideAction(started.nextState, ride.id, 5).result.ok, false);
    // Complete and rate
    const completed = completeRideAction(started.nextState, ride.id);
    assert.equal(completed.result.ok, true);
    const rated = rateRideAction(completed.nextState, ride.id, 5, 'ممتاز');
    assert.equal(rated.result.ok, true);
    // Double rating fails synchronously
    assert.equal(rateRideAction(rated.nextState, ride.id, 4).result.ok, false);
  });

  it('rejects ride creation when offline, outside zone, same points, or below min fare', () => {
    const base = createInitialDemoState();
    const outOfZone = ASWAN_SAMPLE_LANDMARKS.find((l) => l.category === 'out_of_zone')!;

    // Offline
    const offlineState = {
      ...base,
      simulationFlags: { ...base.simulationFlags, networkOffline: true },
    };
    assert.equal(
      createRideRequestAction(offlineState, {
        pickup: ASWAN_SAMPLE_LANDMARKS[0],
        destination: ASWAN_SAMPLE_LANDMARKS[1],
        passengerFareEgp: 25,
      }).result.ok,
      false
    );

    // Same point
    assert.equal(
      createRideRequestAction(base, {
        pickup: ASWAN_SAMPLE_LANDMARKS[0],
        destination: ASWAN_SAMPLE_LANDMARKS[0],
        passengerFareEgp: 25,
      }).result.ok,
      false
    );

    // Out of zone
    assert.equal(
      createRideRequestAction(base, {
        pickup: ASWAN_SAMPLE_LANDMARKS[0],
        destination: outOfZone,
        passengerFareEgp: 40,
      }).result.ok,
      false
    );

    // Below min fare
    assert.equal(
      createRideRequestAction(base, {
        pickup: ASWAN_SAMPLE_LANDMARKS[0],
        destination: ASWAN_SAMPLE_LANDMARKS[1],
        passengerFareEgp: 5,
      }).result.ok,
      false
    );

    // Suppress unused import check if DriverOffer not directly referenced
    const _unused: DriverOffer | null = null;
    assert.equal(_unused, null);
  });
});
