"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  showPercentage?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value, showPercentage = false, className, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value))
    return (
      <div
        ref={ref}
        className={cn("relative w-full h-2 bg-gray-200 rounded-full overflow-hidden", className)}
        {...props}
      >
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${clamped}%` }}
        />
        {showPercentage && (
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-blue-700">
            {clamped}%
          </span>
        )}
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
