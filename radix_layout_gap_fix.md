# Radix UI Layout Shift (Gap Bug) Permanent Solution

This document details the exact root cause of the Radix UI layout shift / gap bug in Zeneva and documents the permanent, zero-bug solution for future reference.

---

## 1. The Bug & Root Cause

### Symptoms
When opening any Radix UI overlay (`DropdownMenu`, `Dialog`, `Sheet`, `Select`, or `Popover`), the main app shell or sidebar shifts horizontally, leaving an awkward 17px white/black gap next to the right edge or sidebar.

### Root Cause
1. By default, Radix UI sets `modal={true}` on overlay components.
2. When an overlay opens, Radix UI attempts to lock body scrolling by applying `overflow: hidden` and calculating the scrollbar width (typically 17px on Windows).
3. Radix UI dynamically injects inline styles directly onto `<body>`:
   ```html
   <body style="pointer-events: none; padding-right: 17px;">
   ```
4. In custom desktop application shells (e.g., Zeneva's fixed Tauri/Next.js layout with internal scroll areas), this injected padding shifts the main layout container, causing layout shift and gap artifacts.

---

## 2. The Complete Solution

The solution consists of **two complementary strategies**:

### Strategy A: Component-Level `modal={false}` (Dropdowns, Menus, Selects)

For dropdown menus, select dropdowns, action popovers, and table row menus, set `modal={false}` directly on the root component:

```tsx
<DropdownMenu modal={false}>
  <DropdownMenuTrigger asChild>...</DropdownMenuTrigger>
  <DropdownMenuContent align="end">...</DropdownMenuContent>
</DropdownMenu>
```

* **Why it works**: Disabling `modal` prevents Radix UI from locking the body scroll or calculating/injecting `padding-right` altogether.

---

### Strategy B: Custom Dark Backdrop (For Drawers & Modals requiring background dimming)

For components like the **Parked Sales Drawer** (`HeldSalesDrawer`) or **Audit Log Details Modal** (`Dialog`), where a dark overlay cast over the background/sidebar is desired for contrast:

1. Keep `modal={false}` on the `<Sheet>` or `<Dialog>` so Radix UI does **not** lock body scroll or inject body padding.
2. Render a simple, lightweight custom backdrop `<div>` portaled directly to `document.body` via React's `createPortal`:

```tsx
import { createPortal } from 'react-dom';

export default function HeldSalesDrawer({ trigger }: HeldSalesDrawerProps) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [isMounted, setIsMounted] = React.useState(false);

    React.useEffect(() => { setIsMounted(true); }, []);

    return (
        <>
            {/* Custom Dark Overlay Portaled to document.body */}
            {isMounted && isOpen && createPortal(
                <div 
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] transition-opacity animate-in fade-in-0" 
                    onClick={() => setIsOpen(false)} 
                />,
                document.body
            )}

            {/* Non-locking Sheet */}
            <Sheet open={isOpen} onOpenChange={setIsOpen} modal={false}>
                <SheetTrigger asChild>...</SheetTrigger>
                <SheetContent className="w-full sm:max-w-[540px]">
                    ...
                </SheetContent>
            </Sheet>
        </>
    );
}
```

* **Why `createPortal(..., document.body)` is required**:
  - Portaling directly to `document.body` escapes any parent `transform`, `filter`, or Framer Motion animation containers.
  - `fixed inset-0` will cover 100% of the screen from top to bottom, including the top header bar and sidebar.
  - Clicking the overlay closes the drawer (`setIsOpen(false)`).
  - Radix UI is **never** involved in body scroll locking or style injection, resulting in **zero layout shift and zero gap errors**.

---

## 3. Global CSS Safeguard

Keep the following fallback rule in `src/app/globals.css`:

```css
/* Prevent Radix UI / react-remove-scroll scroll-lock from shifting layout */
body {
  scrollbar-gutter: stable;
  padding-right: 0px !important;
}

body[data-scroll-locked],
html[data-scroll-locked] {
  margin-right: 0px !important;
  padding-right: 0px !important;
}
```

---

## 4. Summary Checklist for New Components

- [ ] **Dropdowns / Table Row Menus / Selects**: Add `modal={false}`.
- [ ] **Drawers & Modals needing Dark Backdrop**: Add `modal={false}` AND render `{isOpen && <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px]" onClick={() => setIsOpen(false)} />}`.

---

Verified against the tree in August 2026: 57 `modal={false}` call sites, the
`HeldSalesDrawer` backdrop pattern, and the `globals.css` safeguards are all
still in place. Related: [`docs/blueprint.md`](docs/blueprint.md) for the design
language these overlays sit in, [`docs/technology.md`](docs/technology.md) for
the architecture.
