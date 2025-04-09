"use client";

import { useState, useRef, useEffect, ReactNode } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { GripVertical } from "lucide-react";

interface FlexibleCardProps {
    children: ReactNode;
    header?: ReactNode;
    footer?: ReactNode;
    initialWidth?: number;
    initialHeight?: number;
    initialX?: number;
    initialY?: number;
    minWidth?: number;
    minHeight?: number;
    className?: string;
    onMove?: (x: number, y: number) => void;
    onResize?: (width: number, height: number) => void;
    onHeaderMouseDown?: (e: React.MouseEvent) => void;
    isMaximized?: boolean;
}

export default function FlexibleCard({
    children,
    header,
    footer,
    initialWidth = 400,
    initialHeight = 300,
    initialX = 100,
    initialY = 100,
    minWidth = 200,
    minHeight = 150,
    className = "",
    onMove,
    onResize,
    onHeaderMouseDown: externalHeaderMouseDown,
    isMaximized = false,
}: FlexibleCardProps) {
    const [width, setWidth] = useState(initialWidth);
    const [height, setHeight] = useState(initialHeight);
    const [x, setX] = useState(initialX);
    const [y, setY] = useState(initialY);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [resizeDirection, setResizeDirection] = useState<string | null>(null);
    const cardRef = useRef<HTMLDivElement>(null);

    // Update internal state when props change
    useEffect(() => {
        setWidth(initialWidth);
        setHeight(initialHeight);
        setX(initialX);
        setY(initialY);
    }, [initialWidth, initialHeight, initialX, initialY]);

    // Store the initial mouse position and dimensions when starting to drag or resize
    const [dragStart, setDragStart] = useState({ mouseX: 0, mouseY: 0, elementX: 0, elementY: 0, width: 0, height: 0 });

    // Handle mouse movement for both dragging and resizing
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (isDragging && !isMaximized) {
                // Calculate new position based on initial position and mouse movement
                const newX = dragStart.elementX + (e.clientX - dragStart.mouseX);
                const newY = dragStart.elementY + (e.clientY - dragStart.mouseY);

                // Update internal state
                setX(newX);
                setY(newY);

                // Call external handler if provided
                if (onMove) {
                    onMove(newX, newY);
                }
            } else if (isResizing && !isMaximized) {
                // Calculate mouse movement from start position
                const deltaX = e.clientX - dragStart.mouseX;
                const deltaY = e.clientY - dragStart.mouseY;

                let newWidth = dragStart.width;
                let newHeight = dragStart.height;
                let newX = dragStart.elementX;
                let newY = dragStart.elementY;

                // Resize based on direction
                if (resizeDirection?.includes('e')) {
                    newWidth = Math.max(minWidth, dragStart.width + deltaX);
                }
                if (resizeDirection?.includes('s')) {
                    newHeight = Math.max(minHeight, dragStart.height + deltaY);
                }
                if (resizeDirection?.includes('w')) {
                    // Calculate new width based on drag delta
                    newWidth = Math.max(minWidth, dragStart.width - deltaX);
                    // If width changed, adjust position
                    if (newWidth !== dragStart.width) {
                        newX = dragStart.elementX + (dragStart.width - newWidth);
                    }
                }
                if (resizeDirection?.includes('n')) {
                    // Calculate new height based on drag delta
                    newHeight = Math.max(minHeight, dragStart.height - deltaY);
                    // If height changed, adjust position
                    if (newHeight !== dragStart.height) {
                        newY = dragStart.elementY + (dragStart.height - newHeight);
                    }
                }

                // Update internal state
                setWidth(newWidth);
                setHeight(newHeight);
                setX(newX);
                setY(newY);

                // Call external handlers if provided
                if (onResize) {
                    onResize(newWidth, newHeight);
                }
                if (onMove && (resizeDirection?.includes('w') || resizeDirection?.includes('n'))) {
                    onMove(newX, newY);
                }
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            setResizeDirection(null);
            document.body.style.cursor = 'default';
        };

        if (isDragging || isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing, resizeDirection, minWidth, minHeight, dragStart, onMove, onResize]);

    // Start dragging from header
    const handleHeaderMouseDown = (e: React.MouseEvent) => {
        // Prevent dragging if clicking on a button or interactive element within the header
        if ((e.target as HTMLElement).closest('button')) return;
        if (isMaximized) return;

        e.preventDefault();

        // Store initial positions for more stable dragging
        setDragStart({
            mouseX: e.clientX,
            mouseY: e.clientY,
            elementX: x,
            elementY: y,
            width: width,
            height: height
        });

        setIsDragging(true);
        document.body.style.cursor = 'grabbing';

        // Call external handler if provided
        if (externalHeaderMouseDown) {
            externalHeaderMouseDown(e);
        }
    };

    // Start resizing from a handle
    const handleResizeStart = (direction: string) => (e: React.MouseEvent) => {
        if (isMaximized) return;

        e.preventDefault();

        // Store initial positions and dimensions for more stable resizing
        setDragStart({
            mouseX: e.clientX,
            mouseY: e.clientY,
            elementX: x,
            elementY: y,
            width: width,
            height: height
        });

        setIsResizing(true);
        setResizeDirection(direction);

        // Set appropriate cursor
        switch (direction) {
            case 'n':
            case 's':
                document.body.style.cursor = 'ns-resize';
                break;
            case 'e':
            case 'w':
                document.body.style.cursor = 'ew-resize';
                break;
            case 'ne':
            case 'sw':
                document.body.style.cursor = 'nesw-resize';
                break;
            case 'nw':
            case 'se':
                document.body.style.cursor = 'nwse-resize';
                break;
        }
    };

    return (
        <div
            className={`${isMaximized ? 'fixed inset-0' : 'absolute'} select-none`}
            style={{
                width: isMaximized ? '100%' : `${width}px`,
                height: isMaximized ? '100%' : `${height}px`,
                left: isMaximized ? 0 : `${x}px`,
                top: isMaximized ? 0 : `${y}px`,
                zIndex: isDragging || isResizing || isMaximized ? 50 : 10,
                willChange: 'left, top, width, height',
                transition: isDragging || isResizing ? 'none' : 'left 0.1s, top 0.1s, width 0.1s, height 0.1s',
            }}
            ref={cardRef}
        >
            <Card className={`w-full h-full overflow-hidden ${className}`}>
                {/* Custom Header with drag handle */}
                <CardHeader
                    className="p-3 cursor-grab border-b flex-shrink-0"
                    onMouseDown={handleHeaderMouseDown}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            {header}
                        </div>
                    </div>
                </CardHeader>

                {/* Content */}
                <CardContent className="p-4 overflow-auto flex-grow" style={{ height: 'calc(100% - 100px)' }}>
                    {children}
                </CardContent>

                {/* Footer (optional) */}
                {footer && (
                    <CardFooter className="p-3 border-t flex-shrink-0">
                        {footer}
                    </CardFooter>
                )}
            </Card>

            {/* Resize handles - only show when not maximized */}
            {!isMaximized && (
                <>
                    <div className="absolute top-0 left-0 w-3 h-3 cursor-nwse-resize z-20" onMouseDown={handleResizeStart('nw')} />
                    <div className="absolute top-0 right-0 w-3 h-3 cursor-nesw-resize z-20" onMouseDown={handleResizeStart('ne')} />
                    <div className="absolute bottom-0 left-0 w-3 h-3 cursor-nesw-resize z-20" onMouseDown={handleResizeStart('sw')} />
                    <div className="absolute bottom-0 right-0 w-3 h-3 cursor-nwse-resize z-20" onMouseDown={handleResizeStart('se')} />

                    <div className="absolute top-0 left-1/2 w-3 h-3 -translate-x-1/2 cursor-ns-resize z-20" onMouseDown={handleResizeStart('n')} />
                    <div className="absolute bottom-0 left-1/2 w-3 h-3 -translate-x-1/2 cursor-ns-resize z-20" onMouseDown={handleResizeStart('s')} />
                    <div className="absolute top-1/2 left-0 w-3 h-3 -translate-y-1/2 cursor-ew-resize z-20" onMouseDown={handleResizeStart('w')} />
                    <div className="absolute top-1/2 right-0 w-3 h-3 -translate-y-1/2 cursor-ew-resize z-20" onMouseDown={handleResizeStart('e')} />

                    {/* Resize bars (visible on hover) */}
                    <div className="absolute top-0 left-3 right-3 h-1 hover:bg-primary/10 cursor-ns-resize" onMouseDown={handleResizeStart('n')} />
                    <div className="absolute bottom-0 left-3 right-3 h-1 hover:bg-primary/10 cursor-ns-resize" onMouseDown={handleResizeStart('s')} />
                    <div className="absolute left-0 top-3 bottom-3 w-1 hover:bg-primary/10 cursor-ew-resize" onMouseDown={handleResizeStart('w')} />
                    <div className="absolute right-0 top-3 bottom-3 w-1 hover:bg-primary/10 cursor-ew-resize" onMouseDown={handleResizeStart('e')} />
                </>
            )}
        </div>
    );
}