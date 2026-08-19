import { bundleFilename, routeToBundle, serializeBundle } from '../export/serialize'
import { BundleFormatError, readBundleText, type ImportedRoute } from '../export/read'
import type { Route } from '../types/route'

/**
 * The browser side of import and export. The bundle itself is built and parsed
 * by the pure code in `src/export`; this file only moves bytes in and out of
 * the page.
 */

/** Writes the route to the user's disk as a versioned bundle. */
export function downloadRoute(route: Route): void {
  const text = serializeBundle(routeToBundle(route, Date.now()))
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')

  link.href = url
  link.download = bundleFilename(route.name)
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Revoking immediately can race the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Reads a bundle the user picked or dropped. Rejects with a BundleFormatError
 * whose message is meant to be shown as-is.
 */
export async function readRouteFile(file: File): Promise<ImportedRoute> {
  let text: string
  try {
    text = await file.text()
  } catch {
    throw new BundleFormatError(`Could not read ${file.name}.`)
  }
  return readBundleText(text)
}

/** Opens the OS file picker. Resolves with null if the user cancels. */
export function pickRouteFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'

    input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true })
    // Fires when the picker closes, including on cancel, where `change` never comes.
    input.addEventListener('cancel', () => resolve(null), { once: true })

    input.click()
  })
}
