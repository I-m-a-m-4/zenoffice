"use client";

import { useEffect, useState } from "react";

export function InteractiveGrid() {
    // We'll use a hardcoded large enough grid, or calculate based on window. 
    // For simplicity and performance, a fixed large grid with overflow hidden is often best for hero sections.
    // 40px grid size
    const width = 1600;
    const height = 800;
    const gridSize = 40;

    // Generate grid items
    const rows = Math.ceil(height / gridSize);
    const cols = Math.ceil(width / gridSize);

    const [mounted, setMounted] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    useEffect(() => {
        setMounted(true);
        setIsDesktop(window.innerWidth >= 1024);
    }, []);

    if (!mounted) return null;

    return (
        <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent_65%)]">
            <svg
                width="100%"
                height="100%"
                className="absolute inset-0 h-full w-full border-gray-200/20 dark:border-gray-800/20"
                style={{
                    maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)"
                }}
            >
                <pattern
                    id="grid-pattern"
                    width={gridSize}
                    height={gridSize}
                    patternUnits="userSpaceOnUse"
                    x="50%"
                    y={-1}
                >
                    <path
                        d={`M.5 ${gridSize}V.5H${gridSize}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1}
                        className="text-gray-200/25 dark:text-gray-800/25"
                    />
                </pattern>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />

                {/* 
                  To make it truly interactive (hover individual cells), we need actual rects.
                  Pattern just draws lines. 
                  Below we render interactive rects for the hover effect on desktop only for performance.
                */}
                {isDesktop && (
                    <svg x="50%" y={0} className="overflow-visible">
                        {Array.from({ length: rows * cols }).map((_, i) => {
                            const row = Math.floor(i / cols);
                            const col = i % cols;
                            // Center the grid relative to x=50%
                            const x = (col - cols / 2) * gridSize;
                            const y = row * gridSize;

                            return (
                                <rect
                                    key={i}
                                    x={x}
                                    y={y}
                                    width={gridSize}
                                    height={gridSize}
                                    className="stroke-gray-200/10 dark:stroke-gray-800/10 transition-all duration-100 ease-in-out [&:not(:hover)]:duration-1000 fill-transparent hover:fill-gray-100/30 dark:hover:fill-gray-800/30 pointer-events-auto cursor-crosshair"
                                />
                            );
                        })}
                    </svg>
                )}
            </svg>
        </div>
    );
}
