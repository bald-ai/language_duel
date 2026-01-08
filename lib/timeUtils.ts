/**
 * Time utilities for scheduled duels
 */

export interface TimeSlot {
    hour: number;
    minute: number;
    label: string;
    timestamp: number;
}

/**
 * Generate time slots for a given date (30-minute intervals)
 * Filters out past times if date is today
 */
export function generateTimeSlots(date: Date = new Date()): TimeSlot[] {
    const slots: TimeSlot[] = [];
    const now = new Date();
    const isToday =
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();

    // Generate slots from 00:00 to 23:30
    for (let hour = 0; hour < 24; hour++) {
        for (let minute of [0, 30]) {
            const slotDate = new Date(date);
            slotDate.setHours(hour, minute, 0, 0);

            // Skip past times if today
            if (isToday && slotDate.getTime() <= now.getTime()) {
                continue;
            }

            slots.push({
                hour,
                minute,
                label: formatTime(hour, minute),
                timestamp: slotDate.getTime(),
            });
        }
    }

    return slots;
}

/**
 * Format hour and minute as a readable time string
 */
export function formatTime(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Check if a timestamp is in the future
 */
export function isTimeInFuture(timestamp: number): boolean {
    return timestamp > Date.now();
}

/**
 * Format a scheduled time for display
 */
export function formatScheduledTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const timeStr = formatTime(date.getHours(), date.getMinutes());

    // Check if today
    if (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
    ) {
        return `Today at ${timeStr}`;
    }

    // Check if tomorrow
    if (
        date.getFullYear() === tomorrow.getFullYear() &&
        date.getMonth() === tomorrow.getMonth() &&
        date.getDate() === tomorrow.getDate()
    ) {
        return `Tomorrow at ${timeStr}`;
    }

    // Otherwise show full date
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()} at ${timeStr}`;
}

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
        return 'Just now';
    } else if (minutes < 60) {
        return `${minutes}m ago`;
    } else if (hours < 24) {
        return `${hours}h ago`;
    } else if (days < 7) {
        return `${days}d ago`;
    } else {
        const date = new Date(timestamp);
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
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
        return 'Starting soon!';
    }

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return 'Starting soon!';
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

/**
 * Check if current time is within a window after a given timestamp
 */
export function isWithinWindow(timestamp: number, windowMs: number): boolean {
    const now = Date.now();
    return now >= timestamp && now <= timestamp + windowMs;
}
