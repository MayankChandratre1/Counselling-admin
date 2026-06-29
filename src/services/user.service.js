import { User } from '../models/user.model.js';
import { UserList } from '../models/userList.model.js';
import { Note } from '../models/note.model.js';
import cache from '../config/cache.js';
import PaymentService from './payment.service.js';
import { DEFAULT_PAYMENT_SOURCE } from '../constants/paymentSource.js';
import { encodeNoteKey, normalizeNotesObject, legacyBrokenNoteKey } from '../utils/noteKeys.js';
import { parsePlanPrice, resolvePlanExpiryDate } from '../utils/planNormalize.js';
class UserService {
    invalidateCache(pattern) {
        const cleanPattern = pattern.replace(/\*/g, '');
        const keys = cache.keys();
        const matches = keys.filter(k => k.includes(cleanPattern));
        if (matches.length > 0) cache.del(matches);
    }

    async getAllUsersOfForm(formId, userIds = []) {
        try {
            const users = await User.find({
                id: { $in: userIds },
                'stepsData.id': formId
            }).select('id name stepsData.id stepsData.steps.number stepsData.steps.title stepsData.steps.status stepsData.steps.verdict').lean();
            return users;
        } catch (error) {
            console.error('Error fetching users of form:', error);
            throw new Error('Failed to fetch users of form');
        }
    }

    // ── List / Search ──────────────────────────────────────────────────────────

    getUserSortField(filters = {}) {
        return filters?.dateFilterBy === 'purchasedDate'
            ? { 'premiumPlan.purchasedDate': -1, _id: 1 }
            : { createdAt: -1, _id: 1 };
    }

    async buildUserQuery(filters = {}) {
        const query = {};

        if (filters.name?.trim() && filters.phone?.trim()) {
            query.$and = [
                { name: { $regex: filters.name.trim(), $options: 'i' } },
                { phone: { $regex: filters.phone.trim(), $options: 'i' } }
            ];
        } else if (filters.name?.trim()) {
            query.name = { $regex: filters.name.trim(), $options: 'i' };
        } else if (filters.phone?.trim()) {
            query.phone = { $regex: filters.phone.trim(), $options: 'i' };
        }
        if (filters.search) {
            query.$or = [
                { name: { $regex: filters.search, $options: 'i' } },
                { email: { $regex: filters.search, $options: 'i' } },
                { phone: { $regex: filters.search, $options: 'i' } }
            ];
        }

        const fromDate = filters.fromDate || filters.startDate;
        const toDate = filters.toDate || filters.endDate;
        const usePurchaseDate = filters.dateFilterBy === 'purchasedDate';
        const dateField = usePurchaseDate ? 'premiumPlan.purchasedDate' : 'createdAt';
        if (fromDate || toDate) {
            query[dateField] = {};
            if (fromDate) {
                const start = new Date(fromDate);
                start.setHours(0, 0, 0, 0);
                query[dateField].$gte = start;
            }
            if (toDate) {
                const end = new Date(toDate);
                end.setHours(23, 59, 59, 999);
                query[dateField].$lte = end;
            }
        }

        if (filters.plan && filters.plan !== 'all') {
            query['premiumPlan.planTitle'] = { $regex: filters.plan, $options: 'i' };
        }

        if (filters.isPremium === 'true' || filters.isPremium === true) {
            query.isPremium = true;
        } else if (filters.isPremium === 'false' || filters.isPremium === false) {
            query.isPremium = { $ne: true };
        }

        if (filters.batch && filters.batch !== 'all') {
            if (filters.batch === 'Unassigned') {
                query.$or = [
                    { batch: { $exists: false } },
                    { batch: null },
                    { batch: '' }
                ];
            } else {
                query.batch = filters.batch;
            }
        }

        if (filters.formFilled === 'true') query.formFilled = true;
        if (filters.formFilled === 'false') query.formFilled = { $ne: true };

        if (filters.isPaymentPending === 'true') {
            query['premiumPlan.isPaymentPending'] = true;
        }

        if (filters.listAssigned && filters.listAssigned !== 'all') {
            const usersWithLists = await UserList.distinct('userId', {
                $or: [{ type: { $exists: false } }, { type: { $ne: 'created' } }]
            });
            if (filters.listAssigned === 'true') {
                query.id = { $in: usersWithLists };
            } else {
                query.id = { $nin: usersWithLists };
            }
        }

        return query;
    }

    async enrichUsersWithListsAndNotes(users) {
        if (!users.length) return users;

        const userIds = users.map((u) => u.id).filter(Boolean);
        const [userLists, notes] = await Promise.all([
            UserList.find({ userId: { $in: userIds } }).select('userId id title type').lean(),
            Note.find({ id: { $in: userIds } }).lean()
        ]);

        const listsByUser = {};
        userLists.forEach((list) => {
            if (!listsByUser[list.userId]) listsByUser[list.userId] = [];
            listsByUser[list.userId].push({
                id: list.id,
                title: list.title,
                type: list.type
            });
        });

        const notesByUser = {};
        notes.forEach((note) => {
            if (note?.id) notesByUser[note.id] = this.formatNotesForClient(note, note.id);
        });

        return users.map((user) => ({
            ...user,
            lists: listsByUser[user.id] || [],
            notes: notesByUser[user.id] || null
        }));
    }

    /**
     * Paginated user list with rich filters.
     * Mirrors admin.service.js getAll / getUsers (lines 47–600)
     */
    async getAllUsers(page = 1, limit = 10, filters = null) {
        try {
            const query = await this.buildUserQuery(filters || {});
            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sortField = this.getUserSortField(filters);

            const [users, total] = await Promise.all([
                User.find(query).sort(sortField).skip(skip).limit(parseInt(limit)).lean(),
                User.countDocuments(query)
            ]);

            const usersWithLists = await this.enrichUsersWithListsAndNotes(users);

            return {
                users: usersWithLists,
                totalUsers: total,
                page: parseInt(page),
                pages: Math.ceil(total / parseInt(limit)),
                hasMore: parseInt(page) * parseInt(limit) < total
            };
        } catch (error) {
            throw new Error('Failed to get users: ' + error.message);
        }
    }

    async exportUsers(filters = {}) {
        const EXPORT_LIMIT = 20000;
        try {
            const query = await this.buildUserQuery(filters);
            const sortField = this.getUserSortField(filters);
            const [users, total] = await Promise.all([
                User.find(query).sort(sortField).limit(EXPORT_LIMIT).lean(),
                User.countDocuments(query)
            ]);

            const enriched = await this.enrichUsersWithListsAndNotes(users);

            return {
                users: enriched,
                totalUsers: total,
                exportedCount: enriched.length,
                truncated: total > EXPORT_LIMIT
            };
        } catch (error) {
            throw new Error('Failed to export users: ' + error.message);
        }
    }

    /**
     * Get a single user by their string `id` field.
     */
    async getUser(userId) {
        try {
            const user = await User.findOne({ id: userId }).lean();
            if (!user) throw new Error('User not found');

            const [userLists, note] = await Promise.all([
                UserList.find({ userId: user.id }).lean(),
                Note.findOne({ id: user.id }).lean()
            ]);

            // Ensure all lists have id and colleges fields
            const normalizedLists = userLists.map(list => ({
                ...list,
                id: list.id || list._id?.toString(),
                colleges: Array.isArray(list.colleges) ? list.colleges : []
            }));

            user.lists = normalizedLists.filter(list => list.type !== 'created');
            user.createdList = normalizedLists.filter(list => list.type === 'created');
            user.notes = this.formatNotesForClient(note, user.id);

            if (user.phone) {
                user.paymentHistory = await PaymentService.getUserPayment(user.phone);
            } else {
                user.paymentHistory = [];
            }
            
            console.log(`Loaded user ${userId} with ${user.lists.length} assigned lists, ${user.createdList.length} created lists`);
            return user;
        } catch (error) {
            throw new Error('Failed to get user: ' + error.message);
        }
    }

    /**
     * Get a user by phone number.
     */
    async getUserByPhone(phone) {
        try {
            const normalised = phone.startsWith('+') ? phone : `+91${phone}`;
            const user = await User.findOne({
                $or: [{ phone }, { phone: normalised }]
            }).lean();
            if (!user) throw new Error('User not found');
            return user;
        } catch (error) {
            throw new Error('Failed to get user by phone: ' + error.message);
        }
    }

    /**
     * Full-text search across name / email / phone.
     */
    async searchUser(searchQuery) {
        try {
            if (!searchQuery) return [];
            const users = await User.find({
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { email: { $regex: searchQuery, $options: 'i' } },
                    { phone: { $regex: searchQuery, $options: 'i' } }
                ]
            }).limit(20).lean();

            if (!users.length) return users;

            const userIds = users.map(user => user.id).filter(Boolean);

            const [userLists, notes] = await Promise.all([
                UserList.find({ userId: { $in: userIds } }).lean(),
                Note.find({ id: { $in: userIds } }).lean()
            ]);

            const assignedByUser = {};
            const createdByUser = {};

            userLists.forEach((list) => {
                if (!list?.userId) return;
                
                // Normalize list with fallback id and colleges
                const normalizedList = {
                    ...list,
                    id: list.id || list._id?.toString(),
                    colleges: Array.isArray(list.colleges) ? list.colleges : []
                };

                if (normalizedList.type === 'created') {
                    if (!createdByUser[normalizedList.userId]) createdByUser[normalizedList.userId] = [];
                    createdByUser[normalizedList.userId].push(normalizedList);
                    return;
                }

                if (!assignedByUser[normalizedList.userId]) assignedByUser[normalizedList.userId] = [];
                assignedByUser[normalizedList.userId].push(normalizedList);
            });

            const notesByUser = {};
            notes.forEach((note) => {
                if (note?.id) notesByUser[note.id] = note;
            });

            return users.map((user) => ({
                ...user,
                lists: assignedByUser[user.id]?.length ? assignedByUser[user.id] : (user.lists || []),
                createdList: createdByUser[user.id]?.length ? createdByUser[user.id] : (user.createdList || []),
                notes: notesByUser[user.id] || user.notes || null
            }));
        } catch (error) {
            throw new Error('Failed to search users: ' + error.message);
        }
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    async addUser(userData) {
        try {
            if (!userData.phone) throw new Error('Phone is required');
            const existing = await User.findOne({ phone: userData.phone });
            if (existing) throw new Error('User with this phone already exists');

            const id = 'user_' + Date.now();
            const user = new User({ ...userData, id });
            await user.save();
            return user;
        } catch (error) {
            throw new Error('Failed to add user: ' + error.message);
        }
    }

    async updateUser(userId, userData) {
        try {
            const updated = await User.findOneAndUpdate(
                { id: userId },
                { $set: userData },
                { new: true }
            );
            if (!updated) throw new Error('User not found');
            this.invalidateCache('users:*');
            this.invalidateCache(`user:${userId}`);
            return updated;
        } catch (error) {
            throw new Error('Failed to update user: ' + error.message);
        }
    }

    async deleteUser(userId) {
        try {
            const result = await User.deleteOne({ id: userId });
            if (result.deletedCount === 0) throw new Error('User not found');

            // Clean up associated user lists
            await UserList.deleteMany({ userId });

            this.invalidateCache('users:*');
            this.invalidateCache(`user:${userId}`);
            return { message: 'User deleted successfully' };
        } catch (error) {
            throw new Error('Failed to delete user: ' + error.message);
        }
    }

    // ── Specialised Updates ────────────────────────────────────────────────────

    /**
     * Toggle the formFilled status on a user.
     * Mirrors admin.service.js toggleFormFilled (lines 3485–3506)
     */
    async toggleFormFilled(userId, adminEmail) {
        try {
            const user = await User.findOne({ id: userId });
            if (!user) throw new Error('User not found');

            const formFilled = !user.formFilled;
            await User.findOneAndUpdate(
                { id: userId },
                {
                    $set: {
                        formFilled,
                        formFilledBy: adminEmail,
                        formFilledAt: formFilled ? new Date() : null
                    }
                }
            );

            this.invalidateCache('users:*');
            this.invalidateCache(`user:${userId}`);
            return { message: 'Form filled status toggled', formFilled };
        } catch (error) {
            throw new Error('Failed to toggle form filled: ' + error.message);
        }
    }

    /**
     * Update step data for a user (counselling form progress).
     * Mirrors admin.service.js updateUserStepData.
     */
    async updateUserStepData(userId, stepsData) {
        try {
            const updated = await User.findOneAndUpdate(
                { id: userId },
                { $set: { stepsData } },
                { new: true }
            );
            if (!updated) throw new Error('User not found');
            this.invalidateCache(`user:${userId}`);
            return { message: 'Step data updated', user: updated };
        } catch (error) {
            throw new Error('Failed to update step data: ' + error.message);
        }
    }

    /**
     * Update a user's premium plan + mark the order paid.
     * Mirrors admin.service.js updateUserWithOrderId (lines 2490–2528).
     * Called by raz.service.js when Razorpay fires an order.paid webhook.
     */
    async updateUserWithOrderId(orderId, planData, orderData) {
        try {
            const asPlainOrder = (order) => (order?.toObject ? order.toObject() : { ...order });

            // Find user by embedded order first (currentOrderId may be a newer unpaid attempt)
            let user = await User.findOne({ 'orders.orderId': orderId });
            if (!user) user = await User.findOne({ orderIds: orderId });
            if (!user) user = await User.findOne({ currentOrderId: orderId });

            if (!user) {
                console.log('No user found with orderId:', orderId);
                return { success: false, message: 'No user found with the provided order ID' };
            }

            // Update the matching order inside the orders array
            const updatedOrders = (user.orders || []).map((order) =>
                order.orderId === orderId
                    ? {
                        ...asPlainOrder(order),
                        ...orderData,
                        paymentStatus: orderData.status === 'paid' ? 'completed' : orderData.status
                    }
                    : asPlainOrder(order)
            );

            const update = { orders: updatedOrders };

            if (orderData.status === 'paid' && planData) {
                const purchasedDate = new Date();
                update.isPremium = true;
                update.premiumPlan = {
                    planTitle: planData.planTitle || planData.plan || 'Premium',
                    form: planData.form,
                    price: parsePlanPrice(planData.price, orderData.amount),
                    expiryDate: resolvePlanExpiryDate(planData, purchasedDate),
                    purchasedDate,
                    isPaymentPending: false,
                    paymentSource: DEFAULT_PAYMENT_SOURCE,
                };
                update.currentOrderId = orderId;
            }

            await User.findOneAndUpdate({ id: user.id }, { $set: update });

            return {
                message: 'User updated with order ID successfully',
                success: true,
                userId: user.id,
                planData,
                orderData
            };
        } catch (error) {
            throw new Error('Failed to update user with order ID: ' + error.message);
        }
    }

    formatNotesForClient(noteDoc, userId = null) {
        if (!noteDoc) {
            return { id: userId, notes: {} };
        }
        const { _id, id, createdAt, updatedAt, __v, ...noteFields } = noteDoc;
        return { id: id || userId, notes: normalizeNotesObject(noteFields) };
    }

    async getNotes(userId) {
        try {
            const noteDoc = await Note.findOne({ id: userId }).lean();
            return this.formatNotesForClient(noteDoc, userId);
        } catch (error) {
            throw new Error('Failed to get notes: ' + error.message);
        }
    }

    async addNote(note, userId, admin) {
        try {
            if (!admin?.email) {
                throw new Error('Admin email is required');
            }

            const noteKey = encodeNoteKey(admin.email);
            const brokenKey = legacyBrokenNoteKey(admin.email);
            const unsetFields = { [noteKey]: 1 };
            if (brokenKey) unsetFields[brokenKey] = 1;

            if (note === '') {
                await Note.updateOne(
                    { id: userId },
                    { $unset: unsetFields }
                );
                this.invalidateCache('notes');
                this.invalidateCache(`user:${userId}`);
                return {
                    message: 'Note deleted successfully',
                    adminEmail: admin.email
                };
            }

            const setFields = {
                id: userId,
                [noteKey]: {
                    note,
                    createdAt: new Date().toISOString()
                }
            };
            const update = { $set: setFields };
            if (brokenKey) {
                update.$unset = { [brokenKey]: 1 };
            }

            await Note.findOneAndUpdate(
                { id: userId },
                update,
                { upsert: true, new: true }
            );

            this.invalidateCache('notes');
            this.invalidateCache(`user:${userId}`);

            return {
                message: 'Note added successfully',
                adminEmail: admin.email
            };
        } catch (error) {
            throw new Error('Failed to save note: ' + error.message);
        }
    }
}

export default new UserService();
