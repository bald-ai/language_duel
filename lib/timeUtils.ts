

/**
 * Get relative time string (e.g., "2m ago", "1h ago")
 */
export function getRelativeTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return "Just now";
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else if (days < 7) {
        return `${days}d ago`;
    } else {
        const date = new Date(timestamp);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${monthNames[date.getMonth()]} ${date.getDate()}`;
    }
}

/**
 * Format remaining time until a timestamp as a countdown string
 * Returns "2h 15m" or "45m" or "Starting soon!" when < 1 minute
 */
export function formatCountdown(targetTimestamp: number): string {
    const now = Date.now();
    const diff = targetTimestamp - now;

    if (diff <= 0) {
        return "Starting soon!";
    }

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return "Starting soon!";
    } else if (minutes < 60) {
        return `${minutes}m`;
    } else if (hours < 24) {
        const remainingMinutes = minutes % 60;
        if (remainingMinutes > 0) {
            return `${hours}h ${remainingMinutes}m`;
        }
        return `${hours}h`;
    } else {
        const remainingHours = hours % 24;
        if (remainingHours > 0) {
            return `${days}d ${remainingHours}h`;
        }
        return `${days}d`;
    }
}

export function formatScheduledTimeForEmail(timestamp: number, timezone: string): string {
    const date = new Date(timestamp);
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });

    if ("formatToParts" in formatter) {
        const parts = formatter.formatToParts(date);
        const getPart = (type: string) =>
            parts.find((part) => part.type === type)?.value;
        const month = getPart("month");
        const day = getPart("day");
        const year = getPart("year");
        const hour = getPart("hour");
        const minute = getPart("minute");

        if (month && day && year && hour && minute) {
            return `${month} ${day}, ${year} at ${hour}:${minute}`;
        }
    }

    return formatter.format(date);
}

type TimeZoneDateParts = {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
};

export function getTimeZoneDateParts(
    timestamp: number,
    timezone: string
): TimeZoneDateParts {
    const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    });
    const parts = formatter.formatToParts(new Date(timestamp));
    const getNumber = (type: Intl.DateTimeFormatPartTypes) => {
        const value = parts.find((part) => part.type === type)?.value;
        if (!value) {
            throw new Error(`Missing ${type} while formatting date parts`);
        }
        return Number(value);
    };

    return {
        year: getNumber("year"),
        month: getNumber("month"),
        day: getNumber("day"),
        hour: getNumber("hour"),
        minute: getNumber("minute"),
    };
}

export function getTimeZoneDateKey(timestamp: number, timezone: string): string {
    const { year, month, day } = getTimeZoneDateParts(timestamp, timezone);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
