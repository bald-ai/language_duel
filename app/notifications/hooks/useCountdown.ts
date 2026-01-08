"use client";

import { useState, useEffect, useCallback } from "react";
import { formatCountdown } from "@/lib/timeUtils";

interface CountdownResult {
    timeRemaining: number;
    isExpired: boolean;
    formattedTime: string;
}

/**
 * Custom hook for countdown timer
 * @param targetTimestamp - Unix timestamp to count down to
 * @returns Object with timeRemaining, isExpired, and formattedTime
 */
export function useCountdown(targetTimestamp: number): CountdownResult {
    const calculateRemaining = useCallback(() => {
        return Math.max(0, targetTimestamp - Date.now());
    }, [targetTimestamp]);

    const [timeRemaining, setTimeRemaining] = useState<number>(calculateRemaining);

    useEffect(() => {
        // Set initial value
        setTimeRemaining(calculateRemaining());

        // Update every second
        const interval = setInterval(() => {
            const remaining = calculateRemaining();
            setTimeRemaining(remaining);

            // Clear interval if expired
            if (remaining <= 0) {
                clearInterval(interval);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [calculateRemaining]);

    return {
        timeRemaining,
        isExpired: timeRemaining <= 0,
        formattedTime: formatCountdown(targetTimestamp),
    };
}

export default useCountdown;
