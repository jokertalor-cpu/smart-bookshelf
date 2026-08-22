# SmartBookshelf Site Header Inventory

## Final migration decision

The public website pages that contain the standard site navigation now use one shared header implementation: `shared-page-header.css` and `shared-page-header.js`. The final mobile standard follows option **B**: the hamburger trigger is at the far left, while the homepage-style dark-blue drawer slides in from the left. The shared search form preserves the existing `search-input` and `search-suggestions` IDs for backward compatibility.

## Unified pages

| Page group | Pages | Header status |
|---|---|---|
| Main discovery | `index.html`, `all-books.html`, `authors.html`, `categories.html`, `search.html`, `guide.html` | Shared header |
| Information | `contact.html`, `cookies.html`, `privacy.html`, `terms.html` | Shared header |
| Book details | `detail.html` | Shared header; book-detail content preserved |
| User features | `library.html`, `ai-assistant.html`, `account.html` | Shared header |

## Compatibility and scope

Legacy page scripts remain loaded where they support page-specific book, Supabase, or AI functionality. Their former navigation handlers become safe no-ops because the old navigation IDs are removed; the shared header script now owns the migrated menu and search behavior. The shared header CSS contains stronger selectors for the search input so `mainstyle.css` cannot accidentally override the shared appearance. The contact page receives the same public Supabase/config inputs needed for live search suggestions.

`reader.html` is intentionally unchanged because its toolbar is a PDF-reading control surface rather than the public site navigation. Utility pages such as `auth.html`, `extension-auth.html`, `book-details.html`, `latest.html`, and `privicy-policy.html` do not currently contain the standard site-navigation header and were not given a new one without a separate product requirement.


## Live visual validation

The deployed unified header was checked at 390px and 1366px on representative pages, with successful screenshot generation across all migrated content pages. The 390px homepage now matches the unified B layout: the hamburger is at the far left, the mobile logo follows it, and the always-visible search field remains in the same header row. The Authors page shows the same header alignment and begins its page content below the header. The 1366px checks preserve the desktop logo, search field, and inline navigation.


The live homepage search smoke test also passed: the shared search input accepted a Burmese keyword and displayed a suggestion dropdown while the unified navigation links remained present. This confirms that migrating the homepage away from its old inline search markup did not remove the live-search hook.


The 1024px live checks confirm the B breakpoint behavior on both the homepage and Categories page: the hamburger is far left, the full desktop logo remains visible, the search field remains visible, and the content starts below the fixed header. The mobile and desktop header rows use the same shared markup rather than page-specific navigation implementations.
