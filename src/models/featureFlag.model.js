import mongoose from 'mongoose';
import { FeatureFlagSchema } from '../../scripts/SchemasV3.js';

export const FeatureFlag = mongoose.models.FeatureFlag
    || mongoose.model('FeatureFlag', FeatureFlagSchema, 'featureflags');

// Canonical list of supported flags. The admin UI renders only these so we
// never accidentally expose unrelated keys.
export const SUPPORTED_FLAGS = [
    {
        key: 'college_range_enabled',
        label: 'College Range (Premium)',
        description:
            'Premium-only screen that lets students filter cutoffs by category, gender and branch and highlights colleges around their percentile.'
    }
];

export default FeatureFlag;
