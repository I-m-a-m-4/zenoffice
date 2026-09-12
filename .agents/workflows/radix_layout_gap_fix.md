# Radix UI Layout Shift (Gap Bug) Fix

This document explains the root cause of the layout gap shift bug next to the sidebar and how it was permanently solved in Zeneva.

## The Bug
When opening any Radix UI-based interactive overlay (e.g., `DropdownMenu`, `Dialog`, `Select`, `Popover`, or `Sheet`), the sidebar or main layout shifted, leaving a black or white blank space/gap on the screen.

### Root Cause
1. By default, Radix UI locks the body scroll to prevent users from scrolling behind active overlays.
2. To prevent the layout from shifting when the scrollbar disappears, Radix automatically calculates the scrollbar width and injects it as inline style padding on the `body` tag:
   ```html
   <body style="pointer-events: none; padding-right: 17px;">
   ```
3. In fixed-width desktop application containers (like Tauri webviews, Electron, or custom layouts), this injected body padding shifts the main layout container, creating a blank gap next to fixed sidebars.

---

## The Solution

There are two ways to solve this bug:

### 1. The Global CSS Fix (Implemented & Recommended)
Instead of disabling modal behavior on every dropdown or modal individually, we override body padding-right behavior globally in [src/app/globals.css](file:///c:/Users/Bello%20Imam/Downloads/zeneva/src/app/globals.css):

```css
body {
  scrollbar-gutter: stable;
  padding-right: 0px !important; /* Forces layout to stay in place */
}
```

* **Why it works**: By forcing `padding-right: 0px !important`, any inline style injected by Radix UI is ignored, keeping the page layout completely static.

---

### 2. Component-Level Fix (Alternative)
For dropdowns or select elements, we can disable the modal behavior on a per-component basis. When `modal` is set to `false`, Radix UI does not lock scrolling or inject body padding:

```tsx
<DropdownMenu modal={false}>
  <DropdownMenuTrigger>...</DropdownMenuTrigger>
  <DropdownMenuContent>...</DropdownMenuContent>
</DropdownMenu>
```
