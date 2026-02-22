import mongoose from 'mongoose';
import { NoteSchema } from '../../scripts/SchemasV3.js';

// Each Note document's `id` = the User.id it belongs to (1:1 per user).
// Extra keys are dynamic: `note-<adminEmail>: { createdAt, note }`
// strict:false allows these dynamic keys to be stored.
export const Note = mongoose.models.Note || mongoose.model('Note', NoteSchema, 'notes');
export default Note;
