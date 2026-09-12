"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { useI18n } from "@/context/i18n-context";

export function ProductTour() {
  const [hasSeenTour, setHasSeenTour] = useState(true);
  const pathname = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    // Only show tour on the inventory page after onboarding
    if (pathname !== "/inventory") return;

    /* ── Zeneva brand palette ─────────────────────────────────────── */
    const style = document.createElement("style");
    style.innerHTML = `
      :root {
        --driver-popover-bg: #ffffff;
        --driver-popover-text: #09090b;
        --driver-popover-muted: #71717a;
        --driver-brand: hsl(22, 90%, 55%);
        --driver-brand-dark: hsl(22, 90%, 45%);
        --driver-radius: 14px;
      }

      /* ── Popover shell ────────────────────────────────────────────── */
      .driver-popover {
        background: var(--driver-popover-bg) !important;
        color: var(--driver-popover-text) !important;
        border-radius: var(--driver-radius) !important;
        border: 1px solid rgba(0,0,0,0.08) !important;
        box-shadow:
          0 0 0 1px rgba(0,0,0,0.02),
          0 24px 48px rgba(0,0,0,0.15),
          0 4px 16px rgba(0,0,0,0.08) !important;
        min-width: 280px !important;
        max-width: 340px !important;
        padding: 20px 22px 18px !important;
        font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      }

      /* ── Header: logo + title row ─────────────────────────────────── */
      .driver-popover-title {
        font-size: 15px !important;
        font-weight: 700 !important;
        color: #09090b !important;
        letter-spacing: -0.01em !important;
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        margin-bottom: 6px !important;
        line-height: 1.3 !important;
      }

      .driver-popover-title::before {
        content: '' !important;
        display: inline-block !important;
        width: 4px !important;
        height: 16px !important;
        background: var(--driver-brand) !important;
        border-radius: 2px !important;
        flex-shrink: 0 !important;
      }

      /* ── Description ──────────────────────────────────────────────── */
      .driver-popover-description {
        font-size: 13px !important;
        line-height: 1.55 !important;
        color: var(--driver-popover-muted) !important;
        margin-top: 4px !important;
        margin-bottom: 16px !important;
      }

      /* ── Progress bar ─────────────────────────────────────────────── */
      .driver-popover-progress-text {
        font-size: 11px !important;
        font-weight: 600 !important;
        color: var(--driver-brand) !important;
        opacity: 1 !important;
        letter-spacing: 0.03em !important;
        text-transform: uppercase !important;
      }

      /* ── Footer ───────────────────────────────────────────────────── */
      .driver-popover-footer {
        display: flex !important;
        align-items: center !important;
        gap: 8px !important;
        border-top: 1px solid rgba(0,0,0,0.07) !important;
        padding-top: 14px !important;
        margin-top: 0 !important;
      }

      .driver-popover-prev-btn,
      .driver-popover-next-btn,
      .driver-popover-close-btn {
        font-family: 'DM Sans', sans-serif !important;
        font-size: 13px !important;
        font-weight: 600 !important;
        border-radius: 8px !important;
        padding: 7px 16px !important;
        cursor: pointer !important;
        transition: all 0.15s ease !important;
        border: none !important;
        line-height: 1.4 !important;
      }

      .driver-popover-next-btn {
        background: var(--driver-brand) !important;
        color: #fff !important;
        box-shadow: 0 2px 8px rgba(234, 115, 50, 0.35) !important;
        margin-left: auto !important;
        display: inline-block !important;
      }
      .driver-popover-next-btn:hover {
        background: var(--driver-brand-dark) !important;
      }

      .driver-popover-prev-btn {
        background: rgba(0,0,0,0.04) !important;
        color: #09090b !important;
        display: inline-block !important;
      }
      .driver-popover-prev-btn:hover {
        background: rgba(0,0,0,0.08) !important;
      }
    `;
    document.head.appendChild(style);

    // Only run if the user just finished onboarding
    const needsTour = localStorage.getItem("zeneva_needs_tour");
    if (needsTour !== "true") return;

    // Small delay to let the UI finish rendering
    const timer = setTimeout(() => {
      // Remove it right before starting so it never runs again
      localStorage.removeItem("zeneva_needs_tour");

      const isMobile = window.innerWidth < 768;

      const driverObj = driver({
        overlayColor: 'rgba(0, 0, 0, 0.4)',
        showProgress: true,
        animate: true,
        allowClose: true,
        closeBtnText: t('tour.skip') || "Skip",
        doneBtnText: t('tour.done') || "Done",
        nextBtnText: t('tour.next') || "Next",
        prevBtnText: t('tour.back') || "Back",
        steps: [
          {
            popover: {
              title: "Welcome to Zeneva!",
              description: "Let's get your store set up. The first step is adding your products so you can start selling.",
              side: "top",
              align: "center"
            }
          },
          {
            element: "#tour-import-products",
            popover: {
              title: "Import Products",
              description: "Already have a list of products? You can bulk import them using a file (Excel, CSV, Images, etc.) to save time.",
              side: "bottom",
              align: "end"
            }
          },
          {
            element: "#tour-add-product",
            popover: {
              title: "Add New Product",
              description: "Or, you can add products manually one by one. Click here when you're ready to add your first product!",
              side: "bottom",
              align: "end"
            }
          }
        ],
        onDestroyStarted: () => {
          localStorage.removeItem("zeneva_needs_tour");
          setHasSeenTour(true);
          driverObj.destroy();
          if (document.head.contains(style)) document.head.removeChild(style);
        },
      });

      try {
        driverObj.drive();
      } catch (e) {
        console.error("Product Tour failed to start:", e);
      }
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (document.head.contains(style)) document.head.removeChild(style);
    };
  }, [pathname, t]);

  return null;
}
