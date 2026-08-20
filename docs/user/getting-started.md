# Getting started

Wegloc is a GPS route simulator. You draw a route on a map, tune how it should be
travelled -- speed, altitude, accuracy, stops -- and export it so a device can
replay it. It runs entirely in your browser: nothing is uploaded, and your routes
stay on your machine.

There is no account and no setup. When the editor opens you already have a demo
route to look at.

## Your first route

1. **Click the map** to drop the first station. Click again to add the next. A line
   connects them in order.
2. **Drag a station** to move it. **Click a station** to select it; the panel on the
   right shows its details.
3. **Click the line between two stations** to insert a new one there.
4. Press **Play** to watch the route travel. The dot follows the path at the speed
   you set.

That is the whole loop: place, tune, play, export.

## Finding your way around

- The **map** is where you draw.
- The **station list** on the right is the route in order, top to bottom. Each entry
  shows its name (or coordinates), and the distance and speed to the next one.
- The **panel at the bottom** holds the simulation settings and the playback
  controls.

## Keyboard

- **Cmd/Ctrl + Z** undo, **Shift + Cmd/Ctrl + Z** redo.
- In the station list: **arrow keys** move between stations, **Alt + arrow** reorders
  the selected one, **Delete** removes it, **Escape** deselects.

## Next

- [Drawing a route](./drawing-a-route.md)
- [Simulation settings](./simulation-settings.md)
- [Saving, exporting, and importing](./export-import.md)
