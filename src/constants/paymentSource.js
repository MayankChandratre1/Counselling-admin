export const PAYMENT_SOURCES = ['App', 'Cash', 'Direct Link', 'QR Code', 'Custom'];

export const DEFAULT_PAYMENT_SOURCE = 'App';

export function getPaymentSourceDisplay(premiumPlan) {
    if (!premiumPlan) return DEFAULT_PAYMENT_SOURCE;
    const source = premiumPlan.paymentSource || DEFAULT_PAYMENT_SOURCE;
    if (source === 'Custom') {
        const label = premiumPlan.paymentSourceLabel?.trim();
        return label || 'Custom';
    }
    return source;
}
