/**
 * Canonical branch buckets used by the College Range feature.
 *
 * Maharashtra cutoff data lists 100+ branch name variations. To keep the user
 * dropdown short (12 options) we collapse every variation into one of the
 * buckets below. Each bucket has:
 *   - key      Stable id used over the wire (`cse`, `ece`, ...)
 *   - label    Human label shown in the dropdown
 *   - keywords Lowercase tokens. A college branch matches the bucket when its
 *              normalised name contains ANY keyword. Keywords are ordered
 *              roughly from most-specific to least-specific.
 *
 * `OTHER` is intentionally last and acts as a fallback; we only assign it
 * when nothing else matches, so the matcher walks the list in order.
 */

export const BRANCH_BUCKETS = [
    {
        key: 'cse',
        label: 'Computer Science & Engineering',
        keywords: [
            'computer science and engineering',
            'computer science & engineering',
            'computer engineering',
            'computer technology',
            'computer science and technology',
            'computer science and information technology',
            'computer science and design',
            'computer science and business systems',
            'computer science',
            'cyber security',
            'internet of things',
            'industrial iot',
            'information technology',
        ],
    },
    {
        key: 'ai_ds',
        label: 'AI & Data Science',
        keywords: [
            'artificial intelligence and data science',
            'artificial intelligence and machine learning',
            'artificial intelligence (ai) and data science',
            'artificial intelligence',
            'machine learning',
            'data science',
            'computer science and engineering(artificial intelligence',
            'computer science and engineering (artificial intelligence',
            'computer science and engineering(data science)',
        ],
    },
    {
        key: 'ece',
        label: 'Electronics & Telecommunication',
        keywords: [
            'electronics and telecommunication',
            'electronics & telecommunication',
            'electronics and communication',
            'electronics and computer engineering',
            'electronics and computer science',
            'electronics and biomedical',
            'electronics engineering',
            'vlsi',
            '5g',
        ],
    },
    {
        key: 'electrical',
        label: 'Electrical Engineering',
        keywords: [
            'electrical engineering',
            'electrical engg',
            'electrical, electronics and power',
            'electrical and electronics',
            'electrical and computer',
        ],
    },
    {
        key: 'mechanical',
        label: 'Mechanical Engineering',
        keywords: [
            'mechanical engineering',
            'mechanical and automation',
            'mechanical & automation',
            'mechanical and mechatronics',
            'mechanical engineering automobile',
            'mechanical and rail',
            'mechatronics',
            'automobile engineering',
            'automation and robotics',
            'robotics and automation',
            'robotics and artificial intelligence',
        ],
    },
    {
        key: 'civil',
        label: 'Civil Engineering',
        keywords: [
            'civil engineering',
            'civil and infrastructure',
            'civil and environmental',
            'civil engineering and planning',
            'civil engineering (structural',
            'structural engineering',
        ],
    },
    {
        key: 'chemical',
        label: 'Chemical & Polymer',
        keywords: [
            'chemical engineering',
            'petro chemical',
            'petrochemical',
            'plastic and polymer',
            'plastic technology',
            'polymer',
            'paints technology',
            'oil and paints',
            'oil,oleochemicals',
            'oil fats and waxes',
            'oil technology',
            'surface coating',
            'paper and pulp',
            'dyestuff',
            'pharmaceutical and fine chemical',
            'pharmaceuticals chemistry',
            'fibres and textile processing',
        ],
    },
    {
        key: 'instrumentation',
        label: 'Instrumentation Engineering',
        keywords: [
            'instrumentation and control',
            'instrumentation engineering',
        ],
    },
    {
        key: 'production',
        label: 'Production & Manufacturing',
        keywords: [
            'production engineering',
            'production engineering[sandwich]',
            'manufacturing science',
            'mechanical engineering[sandwich]',
        ],
    },
    {
        key: 'bio_food',
        label: 'Bio, Food & Agri Tech',
        keywords: [
            'bio medical',
            'biomedical',
            'bio technology',
            'biotechnology',
            'food technology and management',
            'food technology',
            'food engineering and technology',
            'food engineering',
            'agricultural engineering',
        ],
    },
    {
        key: 'textile',
        label: 'Textile & Materials',
        keywords: [
            'textile engineering',
            'textile technology',
            'textile chemistry',
            'fashion technology',
            'man made textile',
            'technical textiles',
            'metallurgy and material technology',
            'printing and packing',
        ],
    },
    {
        key: 'other',
        label: 'Other Specialisations',
        keywords: [
            'aeronautical',
            'mining engineering',
            'safety and fire',
        ],
    },
];

export const BRANCH_BUCKETS_BY_KEY = BRANCH_BUCKETS.reduce((acc, b) => {
    acc[b.key] = b;
    return acc;
}, {});

const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Returns the bucket key for a given branch name, or `null` when the
 * branch matches no bucket. Falls back to `other` only when explicitly
 * present as a keyword (kept narrow on purpose to avoid hiding mismatches).
 */
export function matchBranchToBucket(branchName) {
    const name = normalize(branchName);
    if (!name) return null;
    for (const bucket of BRANCH_BUCKETS) {
        for (const keyword of bucket.keywords) {
            if (name.includes(keyword)) return bucket.key;
        }
    }
    return null;
}

export default BRANCH_BUCKETS;
