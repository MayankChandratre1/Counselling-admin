import NodeCache from 'node-cache';

// StdTTL is the default time-to-live in seconds (1 hour)
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

export default cache;
