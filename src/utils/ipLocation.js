import dns from 'node:dns';
import { promisify } from 'node:util';

const reverseDns = promisify(dns.reverse);

/**
 * Normalizes a client IP from headers / Express (handles X-Forwarded-For first hop, ::ffff:, ::1).
 */
export function normalizeClientIp(raw) {
    if (raw == null) return '';
    let s = String(raw).trim();
    if (!s) return '';
    if (s.includes(',')) s = s.split(',')[0].trim();
    if (s.startsWith('::ffff:')) s = s.slice(7);
    if (s === '::1') return '127.0.0.1';
    return s;
}

export function isNonPublicIp(ip) {
    if (!ip) return true;
    if (ip === '127.0.0.1' || ip === '0.0.0.0') return true;
    if (ip.startsWith('10.')) return true;
    if (ip.startsWith('192.168.')) return true;
    const m = ip.match(/^172\.(\d+)\./);
    if (m) {
        const n = Number(m[1]);
        if (n >= 16 && n <= 31) return true;
    }
    if (ip.startsWith('169.254.')) return true;
    if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true;
    return false;
}

async function lookupReverseDns(ip) {
    if (!ip || isNonPublicIp(ip)) return '';
    try {
        const hosts = await reverseDns(ip);
        return hosts?.[0] || '';
    } catch {
        return '';
    }
}

async function lookupGeoFromIpApi(ip) {
    if (!ip || isNonPublicIp(ip)) return { city: '', region: '', country: '' };
    if (process.env.DISABLE_ADMIN_IP_GEO === '1' || process.env.DISABLE_ADMIN_IP_GEO === 'true') {
        return { city: '', region: '', country: '' };
    }
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        try {
            const res = await fetch(
                `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,regionName,country`,
                { signal: controller.signal }
            );
            if (!res.ok) return { city: '', region: '', country: '' };
            const data = await res.json();
            if (data.status !== 'success') return { city: '', region: '', country: '' };
            return {
                city: data.city || '',
                region: data.regionName || '',
                country: data.country || ''
            };
        } finally {
            clearTimeout(timeout);
        }
    } catch {
        return { city: '', region: '', country: '' };
    }
}

/**
 * Resolves normalized IP, approximate geo (public IPs), and reverse DNS hostname when available.
 */
export async function enrichLoginLocation(rawIp) {
    const ip = normalizeClientIp(rawIp);
    if (!ip) {
        return { ip: '', city: '', region: '', country: '', reverseDns: '' };
    }
    const [geo, reverseDnsHost] = await Promise.all([lookupGeoFromIpApi(ip), lookupReverseDns(ip)]);
    return {
        ip,
        city: geo.city || '',
        region: geo.region || '',
        country: geo.country || '',
        reverseDns: reverseDnsHost || ''
    };
}
