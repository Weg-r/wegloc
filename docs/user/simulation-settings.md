# Simulation settings

These control how the route is travelled and what the simulated receiver reports.
They are saved with the route.

## Speed

- **Base speed** applies to any leg you have not given its own speed.
- **Leg speed override** (on a selected station) sets the speed of the leg arriving
  at that station, overriding the base.

Speeds are shown in whatever unit you pick -- **m/s, km/h, or mph**. Changing the unit
only changes what you see; the route itself is unit-independent, and an exported route
is always in SI units.

## Fidelity

A location that jumps along a straight line at a constant speed does not exercise
real code. These make the trace more like a real receiver:

- **Accuracy** is the reported accuracy radius, in metres.
- **Jitter** makes the position wander realistically inside that radius and the
  reported accuracy vary a little. At zero, the position is mathematically exact.
- **Tick rate** is how often a position is reported, in milliseconds.
- **Acceleration / deceleration / cornering** limits make speed ramp up and down and
  slow for sharp turns instead of changing instantly. They are **off by default**;
  the Walk and Car presets set sensible values, and Off restores instant speed
  changes. With them on, the route also starts and ends at rest and slows into each
  stop.

## Altitude

- **Flat** reports one altitude everywhere.
- **Per waypoint** blends between the altitudes you set on stations; a station left on
  "auto" borrows from its neighbours.

## Loop

When on, playback returns to the start and runs again instead of stopping at the end.

## Playback

- **Play / pause**, a **scrubber**, and a live readout of speed, altitude, and accuracy.
- **Rate** (0.5x-10x) speeds up or slows down playback without changing the route.
- **Tick step** nudges the playhead one tick at a time, for inspecting a single moment.
- **Follow** keeps the moving dot on screen; it only re-centres when the dot nears the
  edge, so it does not fight you while you pan.
- **Fit** frames the whole route.
