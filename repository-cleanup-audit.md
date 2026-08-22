# SmartBookshelf Repository Cleanup Audit

## Scope

This audit reviewed the tracked HTML, CSS, JavaScript, JSON, service-worker, worker, extension, redirect, and static asset files after the unified-header migration. The goal was to remove only code with strong source-level evidence of being obsolete, while preserving page-specific functionality and backward-compatible routes.

## Safe cleanup completed

| Area | Change | Risk assessment |
|---|---|---|
| `mainstyle.css` | Removed the obsolete site-header blocks and their redundant responsive overrides: `.navbar`, `.nav-container`, `.nav-menu`, `.menu-toggle`, `.search-wrapper`, `.search-box`, `.search-suggestions`, `.search-btn`, and the legacy header `.suggestion-item` rules. Book grids, cards, category tiles, sliders, skeletons, footer, and other content styles remain. | Low; no migrated page retains the removed header classes. |
| `mainscript.js` | Removed the old navigation listeners and duplicate header search handlers (`handleInput`, `handleKeyDown`). Retained `escapeHTML`, `safeAssetURL`, `safeBookID`, seasonal search-icon loading, Supabase initialization, and service-worker registration because they still have consumers. | Low; consumers were checked across page scripts. |
| `index.html` | Removed one duplicate canonical tag and one duplicate Font Awesome stylesheet include. | Low. |
| `categories.html` | Removed one duplicate Font Awesome stylesheet include and one duplicate Supabase CDN include. | Low. |
| `sw.js` | Bumped the cache name from `smart-bookshelf-v5` to `smart-bookshelf-v6` so the cleaned CSS/JS are not held indefinitely by the old static cache. | Low; the activate handler deletes older cache names. |

## Items intentionally retained

`latest.html` and `book-details.html` are compatibility redirects still referenced by existing site links or historic URLs. `manifest.json` is retained because it is included in the service-worker static asset list and defines the PWA metadata. `reader.html` remains a separate live PDF-reader surface with its own toolbar and runtime. `extension-auth.html`, the `extension-v2` directory, the three worker files, and Supabase migrations are operational integration code rather than dead files.

`privicy-policy.html` is a typo-named legacy privacy page and is a future cleanup candidate, but deleting it could break old external links. The safer future action is to replace its static content with a compatibility redirect to `privacy.html`, after confirming that the redirect is acceptable.

## Unreferenced-scan candidates requiring product confirmation

The static reference scan found `Gemini_Generated_Image_bwdh8wbwdh8wbwdh.png` and `hexabytes_vb_logo.svg` without direct source references. They may be unused assets, but they were not deleted because dynamic/admin references or future content workflows cannot be ruled out from static HTML/JS alone. `imagemobile.svg` was not counted by the simple `src`/`href` scanner because it is used through `srcset`; it is live and must be retained.

## Verification status

The post-cleanup scan reports no duplicate script or stylesheet includes in the audited HTML pages and no remaining legacy header selectors in `mainstyle.css`. The shared-header structural validator, JavaScript syntax checks, and whitespace/diff checks are used before release. No extension files, Supabase migrations, worker code, or page-specific book/AI logic were removed.
