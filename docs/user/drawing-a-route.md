# Drawing a route

A route is an ordered list of **stations** (waypoints). The line runs from the first
to the last, in the order you placed them.

## Adding stations

How you add a station depends on how your build is set up:

- **By address (when address search is configured):** type a place in the search box
  under the station list -- for example "Parking EFREI" -- and pick it from the results.
  The station lands there with the address as its name. Clicking the map does not add a
  station in this mode.
- **By clicking (otherwise):** click empty map to add to the end, or click the line to
  insert a station in the middle. You can also type `lat, lng` in the box under the list.

## Editing

- **Insert in the middle:** click the line where you want the new station (click mode).
- **Move:** drag a station, on desktop or with a finger.
- **Add by coordinates:** type `lat, lng` in the box under the station list and press
  Add -- handy when you have a coordinate from a bug report.
- **Reorder:** use the up/down arrows on a station, or select it and press Alt + up /
  Alt + down.
- **Reverse the whole route:** the Reverse button under the list. Speeds set on each
  leg travel with the route, so reversing twice returns exactly what you started with.
- **Remove:** the × on a station, or select it and press Delete.

Made a mistake? **Undo** (Cmd/Ctrl + Z) walks back through everything, one step at a
time.

## Naming a station

Select a station and type a **Name** ("office", "the roundabout that breaks us"). The
list shows the name instead of the raw coordinates, with the coordinates kept
underneath. Unnamed stations just show their coordinates.

If your build has automatic naming configured, an **Auto-name** switch appears. It is
**off by default** and, when on, looks up a street name for stations you have not
named yourself. Turning it on sends those coordinates to a naming service over the
network; leave it off to keep everything on your machine. Names you type always win
over looked-up ones.

## Following real roads

If a routing service is configured, a **Route on roads** switch appears with the travel
mode (currently car). With it on, each leg follows real roads between your stations
instead of a straight line, and the distance and playback follow that path. It needs the
network; with it off, or unconfigured, legs are straight lines. A routed route keeps its
path once computed, so it still plays back offline.

## Stops

To make the route wait somewhere -- a traffic light, a pickup -- select the station
and set **Stop here** to a number of seconds. The route holds position there before
carrying on. A stop is shown on the station in the list.

Setting a leg's speed to zero does **not** make a stop; it just makes that leg very
slow. Use Stop here for waiting.
