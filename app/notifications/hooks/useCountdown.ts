"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
    // Initialize with a pure computation - no refs needed
    const initialValue = useMemo(
        () => Math.max(0, targetTimestamp - Date.now()),
        // intentionally empty - we only want initial value
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const [timeRemaining, setTimeRemaining] = useState<number>(initialValue);

    const calculateRemaining = useCallback(() => {
        return Math.max(0, targetTimestamp - Date.now());
    }, [targetTimestamp]);

    useEffect(() => {
        // Update state when targetTimestamp changes
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
