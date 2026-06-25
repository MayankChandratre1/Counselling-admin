/** Parse plan price from mobile notes ("6,999") or Razorpay amount (paise). */
export function parsePlanPrice(price, fallbackAmount) {
    if (typeof price === 'number' && !Number.isNaN(price)) return price;
    if (typeof price === 'string') {
        const parsed = Number(price.replace(/,/g, '').trim());
        if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
    }
    if (typeof fallbackAmount === 'number' && !Number.isNaN(fallbackAmount) && fallbackAmount > 0) {
        // Razorpay API amounts are in paise; our embedded orders may store rupees.
        return fallbackAmount >= 100000 ? Math.round(fallbackAmount / 100) : fallbackAmount;
    }
    return 0;
}

/** expiry in planDetails is days; expiryDate may be absent. */
export function resolvePlanExpiryDate(planData = {}, purchasedAt = new Date()) {
    if (planData.expiryDate) {
        const d = new Date(planData.expiryDate);
        if (!Number.isNaN(d.getTime())) return d;
    }
    const days = Number(planData.expiry);
    if (!Number.isNaN(days) && days > 0) {
        const base = purchasedAt instanceof Date ? purchasedAt : new Date(purchasedAt);
        return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
    }
    return new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);
}
