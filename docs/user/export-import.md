# Saving, exporting, and importing

## Saving

Routes are saved automatically, in your browser, as you edit. There is no save
button. The header shows **Saved** / **Saving**, or **Not saved** if your browser is
blocking local storage (private-browsing windows often do) -- in that case, export
anything you want to keep.

## Multiple routes

The **Routes** button lists everything you have saved. From there you can open, rename,
duplicate, and delete routes, and start a new one. The route you had open reopens next
time.

## Export and import

- **Export** downloads the route as a `.wegloc.json` file. This is the file a device
  reads to replay the route, and it is how you move a route between machines or share
  it.
- **Import** opens a `.wegloc.json` file. You can also drag one onto the editor.
  Imported routes come in as new routes, so importing the same file twice gives you two
  copies rather than overwriting anything.

Exported files are versioned, and newer versions of Wegloc keep reading older files,
so a route you export today will still open later.
