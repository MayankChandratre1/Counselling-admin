import { normalizeClientIp } from './ipLocation.js';

/**
 * Best-effort client IP for Express behind proxies (use TRUST_PROXY + X-Forwarded-For).
 */
export function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        const first = String(forwarded).split(',')[0].trim();
        if (first) return normalizeClientIp(first);
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) return normalizeClientIp(String(realIp).trim());
    return normalizeClientIp(req.ip || req.socket?.remoteAddress || '');
}
