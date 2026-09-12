//! Reading inventory straight out of another Windows program's grid.
//!
//! The clipboard bridge in `src/lib/import/desktop-capture.ts` automates everything
//! about migrating off a legacy POS **except** the copy gesture, because a webview
//! cannot reach into another process. This module is the part that can: it asks
//! Windows UI Automation for the grid inside a window the owner points at, and reads
//! the cells directly. No export, no clipboard, no alt-tabbing per page.
//!
//! ## Read-only, by construction
//!
//! Nothing here writes, clicks, types, or sends input of any kind. The only UIA
//! surface used is tree navigation and two properties, `Name` and `ControlType`. That
//! is deliberate and is the line worth keeping: a tool that can drive another
//! program's UI is a very different thing to audit than one that can only read what is
//! already on screen, and reading is all the importer needs.
//!
//! ## Why a tree walk and not `FindAll` with a property condition
//!
//! The obvious implementation is `CreatePropertyCondition(UIA_ControlTypePropertyId,
//! …)`, but that needs a `VARIANT`, and `windows` 0.61 exposes `VARIANT` as a raw
//! nested union with no `From<i32>` — building one means hand-writing union field
//! initialisation whose layout is not part of the crate's stable surface.
//!
//! `IUIAutomationTreeWalker` needs none of that: navigate, read `CurrentControlType()`,
//! compare. It is also **bounded**, which the condition version is not — `FindAll`
//! over a descendants scope on a 20,000-row grid materialises every cell into one
//! array before returning, and this walk stops at `MAX_NODES` instead.
//!
//! ## Why UIA and not screen scraping
//!
//! UIA gives structured cells with a row/column shape, which is exactly what
//! `RawTable` wants. OCR of a screenshot gives pixels that then need a paid model call
//! and still confuses `8` with `B` in a price column. Where UIA is unavailable — an
//! old app drawing its own grid with GDI and exposing nothing — this finds no rows and
//! the UI falls back to the clipboard bridge, which is why that bridge stays.
//!
//! ## Windows only, and absent elsewhere
//!
//! Everything real is behind `cfg(target_os = "windows")`. The macOS and Linux desktop
//! builds and both mobile builds get the stubs at the bottom, which return an error the
//! front end already knows how to show. The mobile targets are built from this same
//! crate, so compiling the real thing unconditionally would break them.

#[cfg(target_os = "windows")]
mod imp {
    use serde::Serialize;
    use windows::core::BOOL;
    use windows::Win32::Foundation::{HWND, LPARAM, TRUE};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Accessibility::{
        CUIAutomation, IUIAutomation, IUIAutomationElement, IUIAutomationTreeWalker,
        UIA_CONTROLTYPE_ID, UIA_DataGridControlTypeId, UIA_DataItemControlTypeId,
        UIA_HeaderItemControlTypeId, UIA_ListControlTypeId, UIA_ListItemControlTypeId,
        UIA_TableControlTypeId, UIA_TreeControlTypeId,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        EnumWindows, GetWindowTextLengthW, GetWindowTextW, IsIconic, IsWindowVisible,
    };

    /// A top-level window the owner might want to read.
    #[derive(Serialize)]
    pub struct WindowInfo {
        /// `HWND` as an integer, because it has to survive a trip through JSON.
        pub handle: isize,
        pub title: String,
        pub minimized: bool,
    }

    /// What was found inside a window.
    #[derive(Serialize)]
    pub struct GridData {
        pub headers: Vec<String>,
        pub rows: Vec<Vec<String>>,
        /// Which control type the grid turned out to be, for the UI's explanation.
        pub kind: String,
        /// True when a cap was hit, so the caller can say so rather than silently
        /// reporting a short catalogue as a complete one.
        pub truncated: bool,
    }

    /// Rows read in one call. Reported when exceeded, never silently dropped.
    const MAX_ROWS: usize = 20_000;
    /// Cells per row. Wider than any real product grid; guards a malformed tree.
    const MAX_COLS: usize = 64;
    /// Total elements visited while looking for the grid.
    ///
    /// A real application's window is a few thousand elements. This is the stop for a
    /// pathological tree — without it a malformed or cyclic provider hangs the app with
    /// no way out, on a thread the user cannot cancel.
    const MAX_NODES: usize = 60_000;
    /// How deep to descend. Deeper than any real layout nesting.
    const MAX_DEPTH: usize = 40;

    /// `Name`, as an owned `String`. Empty when absent, which is common and not an error.
    fn name_of(element: &IUIAutomationElement) -> String {
        unsafe {
            element
                .CurrentName()
                .map(|bstr| bstr.to_string())
                .unwrap_or_default()
        }
    }

    fn control_type(element: &IUIAutomationElement) -> i32 {
        unsafe {
            element
                .CurrentControlType()
                .map(|id: UIA_CONTROLTYPE_ID| id.0)
                .unwrap_or(0)
        }
    }

    /// Immediate children of an element, capped.
    ///
    /// `GetFirstChildElement` / `GetNextSiblingElement` return an error rather than a
    /// null element when there is nothing there, so an `Err` means "no more" and is not
    /// propagated.
    fn children_of(
        walker: &IUIAutomationTreeWalker,
        element: &IUIAutomationElement,
        cap: usize,
    ) -> Vec<IUIAutomationElement> {
        let mut out = Vec::new();
        unsafe {
            let Ok(first) = walker.GetFirstChildElement(element) else {
                return out;
            };
            let mut current = first;
            loop {
                out.push(current.clone());
                if out.len() >= cap {
                    break;
                }
                match walker.GetNextSiblingElement(&current) {
                    Ok(next) => current = next,
                    Err(_) => break,
                }
            }
        }
        out
    }

    /// Titles of visible top-level windows.
    ///
    /// Untitled windows are dropped: they are almost always tool windows, tray hosts
    /// and message-only windows, and listing forty blank entries makes the picker
    /// useless.
    pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
        let mut found: Vec<WindowInfo> = Vec::new();

        unsafe extern "system" fn callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
            unsafe {
                let out = &mut *(lparam.0 as *mut Vec<WindowInfo>);

                if !IsWindowVisible(hwnd).as_bool() {
                    return TRUE;
                }
                let length = GetWindowTextLengthW(hwnd);
                if length <= 0 {
                    return TRUE;
                }

                // +1 for the terminating null GetWindowTextW writes.
                let mut buffer = vec![0u16; length as usize + 1];
                let written = GetWindowTextW(hwnd, &mut buffer);
                if written <= 0 {
                    return TRUE;
                }

                out.push(WindowInfo {
                    handle: hwnd.0 as isize,
                    title: String::from_utf16_lossy(&buffer[..written as usize]),
                    minimized: IsIconic(hwnd).as_bool(),
                });
                TRUE
            }
        }

        unsafe {
            EnumWindows(
                Some(callback),
                LPARAM(&mut found as *mut Vec<WindowInfo> as isize),
            )
            .map_err(|e| format!("Could not list open windows: {e}"))?;
        }

        Ok(found)
    }

    /// Read the best grid-like element inside a window.
    ///
    /// `CoInitializeEx`'s result is deliberately ignored: Tauri commands run on a
    /// thread pool, so the thread may or may not already be in an apartment, and
    /// `RPC_E_CHANGED_MODE` on an already-initialised thread is success for our
    /// purposes. `CoUninitialize` is deliberately **not** called — unbalancing a thread
    /// we did not initialise would tear COM down under whatever else is using that
    /// pooled thread.
    pub fn read_window_grid(handle: isize) -> Result<GridData, String> {
        if handle == 0 {
            return Err("No window was selected.".into());
        }

        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);

            let automation: IUIAutomation =
                CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)
                    .map_err(|e| format!("Windows accessibility is unavailable: {e}"))?;

            let window = automation
                .ElementFromHandle(HWND(handle as *mut _))
                .map_err(|_| {
                    "That window could not be read. It may have been closed.".to_string()
                })?;

            let walker = automation
                .ControlViewWalker()
                .map_err(|e| format!("Could not inspect that window: {e}"))?;

            // Ordered by how specific the control type is. A WPF DataGrid and a
            // WinForms grid both report DataGrid; an old ListView reports List. Trying
            // List first would match a sidebar or a toolbar before the actual grid.
            let wanted: [(i32, &str); 4] = [
                (UIA_DataGridControlTypeId.0, "grid"),
                (UIA_TableControlTypeId.0, "table"),
                (UIA_ListControlTypeId.0, "list"),
                (UIA_TreeControlTypeId.0, "tree"),
            ];

            let containers = find_containers(&walker, &window, &wanted);
            if containers.is_empty() {
                return Err(
                    "No product list could be found in that window. Try the copy-and-paste method instead."
                        .into(),
                );
            }

            // Whichever container yields the most rows wins. A window often holds
            // several lists — a category tree beside the product grid — and the biggest
            // is reliably the one being migrated.
            let mut best: Option<GridData> = None;
            for (container, kind) in containers {
                let grid = read_container(&walker, &container, kind);
                let better = match &best {
                    None => !grid.rows.is_empty(),
                    Some(held) => grid.rows.len() > held.rows.len(),
                };
                if better {
                    best = Some(grid);
                }
            }

            best.filter(|grid| !grid.rows.is_empty()).ok_or_else(|| {
                "That window has a list, but no rows could be read from it. Try the copy-and-paste method instead."
                    .to_string()
            })
        }
    }

    /// Breadth-first search for grid-like containers, bounded on nodes and depth.
    ///
    /// Returns every match rather than the first, because "the first list in the tree"
    /// is frequently a navigation pane. Descent stops at a match: the cells *inside* a
    /// grid often report as lists themselves, and recursing into them would return a
    /// single row dressed up as a whole grid.
    fn find_containers(
        walker: &IUIAutomationTreeWalker,
        root: &IUIAutomationElement,
        wanted: &[(i32, &'static str)],
    ) -> Vec<(IUIAutomationElement, &'static str)> {
        let mut matches = Vec::new();
        let mut frontier = vec![(root.clone(), 0usize)];
        let mut visited = 0usize;

        while let Some((element, depth)) = frontier.pop() {
            visited += 1;
            if visited > MAX_NODES {
                break;
            }

            let kind = control_type(&element);
            if let Some((_, label)) = wanted.iter().find(|(id, _)| *id == kind) {
                matches.push((element, *label));
                continue;
            }

            if depth >= MAX_DEPTH {
                continue;
            }
            for child in children_of(walker, &element, 512) {
                frontier.push((child, depth + 1));
            }
        }

        matches
    }

    /// Pull headers and rows out of one grid-like element.
    fn read_container(
        walker: &IUIAutomationTreeWalker,
        container: &IUIAutomationElement,
        kind: &str,
    ) -> GridData {
        let mut headers: Vec<String> = Vec::new();
        let mut rows: Vec<Vec<String>> = Vec::new();
        let mut truncated = false;

        // One level of children is the grid's own rows and its header. Both are direct
        // children in every provider that exposes them at all, so there is no need to
        // walk deeper — and walking deeper is what turns cells into rows.
        let top = children_of(walker, container, MAX_ROWS + 64);
        if top.len() >= MAX_ROWS {
            truncated = true;
        }

        for child in &top {
            let child_type = control_type(child);

            // A Header element holds HeaderItem children; some providers expose the
            // HeaderItems directly under the grid instead.
            if child_type == UIA_HeaderItemControlTypeId.0 {
                headers.push(name_of(child));
                continue;
            }

            let is_row = child_type == UIA_DataItemControlTypeId.0
                || child_type == UIA_ListItemControlTypeId.0;

            if is_row {
                if rows.len() >= MAX_ROWS {
                    truncated = true;
                    continue;
                }
                rows.push(read_row(walker, child));
                continue;
            }

            // Anything else at this level that has HeaderItem children is the header
            // row. Checked only for non-row children so a 20,000-row grid does not pay
            // for it per row.
            if headers.is_empty() {
                let grandchildren = children_of(walker, child, MAX_COLS);
                let header_cells: Vec<String> = grandchildren
                    .iter()
                    .filter(|g| control_type(g) == UIA_HeaderItemControlTypeId.0)
                    .map(name_of)
                    .collect();
                if !header_cells.is_empty() {
                    headers = header_cells;
                }
            }
        }

        // Rows that are entirely blank are separators and placeholder rows. Importing
        // them creates products with no name, which the TypeScript side would skip
        // anyway — dropping them here keeps the reported count honest.
        rows.retain(|row| row.iter().any(|cell| !cell.trim().is_empty()));

        GridData {
            headers,
            rows,
            kind: kind.to_string(),
            truncated,
        }
    }

    /// One row's cells.
    ///
    /// A grid row's children are its cells. A ListView row that exposes no children
    /// puts the whole line in its own `Name`; that is returned as a single cell, and the
    /// TypeScript side splits it with the same reader it uses for pasted text rather
    /// than growing a second splitter here.
    fn read_row(walker: &IUIAutomationTreeWalker, row: &IUIAutomationElement) -> Vec<String> {
        let cells: Vec<String> = children_of(walker, row, MAX_COLS)
            .iter()
            .map(name_of)
            .collect();

        if cells.iter().any(|cell| !cell.trim().is_empty()) {
            return cells;
        }
        vec![name_of(row)]
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn list_desktop_windows() -> Result<Vec<imp::WindowInfo>, String> {
    imp::list_windows()
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub fn read_desktop_grid(handle: isize) -> Result<imp::GridData, String> {
    imp::read_window_grid(handle)
}

// ── Non-Windows stubs ──
//
// Same command names, so the front end can call them unconditionally and show the
// message rather than crashing on an unregistered command. `serde_json::Value` because
// the real return types live inside a `cfg`-gated module that does not exist here.

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn list_desktop_windows() -> Result<Vec<serde_json::Value>, String> {
    Err("Reading another program's window is only available on Windows.".into())
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub fn read_desktop_grid(_handle: isize) -> Result<serde_json::Value, String> {
    Err("Reading another program's window is only available on Windows.".into())
}
