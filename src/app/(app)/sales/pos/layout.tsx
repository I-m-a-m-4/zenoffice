
"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const steps = [
  { name: "Select Products", path: "/sales/pos/select-products" },
  { name: "Customer", path: "/sales/pos/customer" },
  { name: "Payment", path: "/sales/pos/payment" },
  { name: "Review", path: "/sales/pos/review" },
];

export default function POSLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const currentStepIndex = steps.findIndex((step) => pathname === step.path);

  return (
    <div className="p-4 sm:p-6">
      <nav aria-label="Progress" className="mb-8 no-print">
        <ol role="list" className="flex items-center">
          {steps.map((step, stepIdx) => (
            <li
              key={step.name}
              className={cn(
                stepIdx !== steps.length - 1 ? "pr-16 sm:pr-24" : "",
                "relative"
              )}
            >
              {stepIdx < currentStepIndex ? (
                <>
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="h-0.5 w-full bg-primary" />
                  </div>
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <span className="text-sm">{stepIdx + 1}</span>
                  </div>
                </>
              ) : stepIdx === currentStepIndex ? (
                <>
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="h-0.5 w-full bg-border" />
                  </div>
                  <div className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-primary bg-background">
                    <span className="text-sm text-primary">{stepIdx + 1}</span>
                  </div>
                  <div className="absolute top-10 text-center text-xs text-primary font-semibold left-1/2 -translate-x-1/2 whitespace-nowrap">{step.name}</div>
                </>
              ) : (
                <>
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="h-0.5 w-full bg-border" />
                  </div>
                  <div className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-border bg-background">
                    <span className="text-sm text-muted-foreground">{stepIdx + 1}</span>
                  </div>
                  <div className="absolute top-10 text-center text-xs text-muted-foreground left-1/2 -translate-x-1/2 whitespace-nowrap">{step.name}</div>
                </>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {children}
    </div>
  );
}
