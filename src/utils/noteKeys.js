const NOTE_PREFIX = 'note-';

/** Encode admin email so MongoDB $set does not treat dots as nested paths. */
export function encodeNoteKey(adminEmail) {
    return `${NOTE_PREFIX}${String(adminEmail)
        .replace(/@/g, '__AT__')
        .replace(/\./g, '__DOT__')}`;
}

export function decodeNoteKey(noteKey) {
    if (!noteKey?.startsWith(NOTE_PREFIX)) return noteKey || '';
    return noteKey
        .slice(NOTE_PREFIX.length)
        .replace(/__DOT__/g, '.')
        .replace(/__AT__/g, '@');
}

function isNoteEntry(value) {
    return value && typeof value === 'object' && typeof value.note === 'string';
}

/**
 * Repair notes stored before dot-encoding (Mongo split `...@gmail.com` into `.com` child).
 * Returns a map keyed by encodeNoteKey(email).
 */
export function normalizeNotesObject(rawNotes = {}) {
    const normalized = {};

    for (const [key, value] of Object.entries(rawNotes)) {
        if (!key.startsWith(NOTE_PREFIX)) continue;

        if (isNoteEntry(value)) {
            const email = decodeNoteKey(key);
            normalized[encodeNoteKey(email)] = {
                note: value.note,
                createdAt: value.createdAt
            };
            continue;
        }

        // Legacy dot-split: note-user@gmail + { com: { note, createdAt } }
        if (value && typeof value === 'object') {
            for (const [suffix, nested] of Object.entries(value)) {
                if (!isNoteEntry(nested)) continue;
                const partial = key.slice(NOTE_PREFIX.length);
                const email = partial.includes('__AT__') || partial.includes('__DOT__')
                    ? decodeNoteKey(key)
                    : `${partial}.${suffix}`;
                normalized[encodeNoteKey(email)] = {
                    note: nested.note,
                    createdAt: nested.createdAt
                };
            }
        }
    }

    return normalized;
}

/** MongoDB splits keys at dots — legacy docs used `note-user@gmail` + `{ com: {...} }`. */
export function legacyBrokenNoteKey(adminEmail) {
    const lastDot = String(adminEmail).lastIndexOf('.');
    if (lastDot === -1) return null;
    return `${NOTE_PREFIX}${adminEmail.slice(0, lastDot)}`;
}

export function getNoteForAdmin(notesMap, adminEmail) {
    const normalized = normalizeNotesObject(notesMap);
    return normalized[encodeNoteKey(adminEmail)]?.note || '';
}
