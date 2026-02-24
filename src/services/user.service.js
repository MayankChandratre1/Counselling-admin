import { User } from '../models/user.model.js';
import { UserList } from '../models/userList.model.js';
import cache from '../config/cache.js';
import PaymentService from './payment.service.js';
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

    /**
     * Paginated user list with rich filters.
     * Mirrors admin.service.js getAll / getUsers (lines 47–600)
     */
    async getAllUsers(page = 1, limit = 10, filters = null) {
        try {
            const query = {};

            if (filters) {
                // Text search
                if (filters.search) {
                    query.$or = [
                        { name: { $regex: filters.search, $options: 'i' } },
                        { email: { $regex: filters.search, $options: 'i' } },
                        { phone: { $regex: filters.search, $options: 'i' } }
                    ];
                }

                // Premium filter
                if (filters.isPremium === 'true' || filters.isPremium === true) query.isPremium = true;
                if (filters.isPremium === 'false' || filters.isPremium === false) query.isPremium = false;

                // Date range
                if (filters.startDate || filters.endDate) {
                    query.createdAt = {};
                    if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
                    if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
                }

                // Plan filter
                if (filters.plan && filters.plan !== 'all') {
                    query['premiumPlan.planTitle'] = { $regex: filters.plan, $options: 'i' };
                }

                // Form filled
                if (filters.formFilled === 'true') query.formFilled = true;
                if (filters.formFilled === 'false') query.formFilled = { $ne: true };

                // Payment pending
                if (filters.isPaymentPending === 'true') {
                    query['premiumPlan.isPaymentPending'] = true;
                }
            }

            const skip = (parseInt(page) - 1) * parseInt(limit);

            const [users, total] = await Promise.all([
                User.find(query).sort({ createdAt: -1, _id: 1 }).skip(skip).limit(parseInt(limit)).lean(),
                User.countDocuments(query)
            ]);

            // Fetch lists for each user from UserList collection
            const userIds = users.map(u => u.id);
            const userLists = await UserList.find({ userId: { $in: userIds } })
                .select('userId title type')
                .lean();

            // Group lists by userId
            const listsByUser = {};
            userLists.forEach(list => {
                if (!listsByUser[list.userId]) {
                    listsByUser[list.userId] = [];
                }
                listsByUser[list.userId].push({
                    id: list.id,
                    title: list.title,
                    type: list.type
                });
            });

            // Attach lists to each user
            const usersWithLists = users.map(user => ({
                ...user,
                lists: listsByUser[user.id] || []
            }));

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

    /**
     * Get a single user by their string `id` field.
     */
    async getUser(userId) {
        try {
            const user = await User.findOne({ id: userId }).lean();
            if (!user) throw new Error('User not found');
            if (user.phone) {
                user.paymentHistory = await PaymentService.getUserPayment(user.phone);
            } else {
                user.paymentHistory = [];
            }
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
            return await User.find({
                $or: [
                    { name: { $regex: searchQuery, $options: 'i' } },
                    { email: { $regex: searchQuery, $options: 'i' } },
                    { phone: { $regex: searchQuery, $options: 'i' } }
                ]
            }).limit(20).lean();
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
            // Find user by orderIds array or currentOrderId
            let user = await User.findOne({ orderIds: orderId });
            if (!user) user = await User.findOne({ currentOrderId: orderId });
            if (!user) {
                // Last resort: search inside embedded orders array
                user = await User.findOne({ 'orders.orderId': orderId });
            }

            if (!user) {
                console.log('No user found with orderId:', orderId);
                return { success: false, message: 'No user found with the provided order ID' };
            }

            // Update the matching order inside the orders array
            const updatedOrders = (user.orders || []).map(order =>
                order.orderId === orderId
                    ? {
                        ...order.toObject(),
                        ...orderData,
                        paymentStatus: orderData.status === 'paid' ? 'completed' : orderData.status
                    }
                    : order.toObject()
            );

            const update = { orders: updatedOrders };

            if (orderData.status === 'paid') {
                update.isPremium = true;
                update.premiumPlan = {
                    ...planData,
                    purchasedDate: new Date(),
                    isPaymentPending: false
                };
                update.currentOrderId = orderId;
            }

            await User.findOneAndUpdate({ id: user.id }, { $set: update });

            return {
                message: 'User updated with order ID successfully',
                userId: user.id,
                planData,
                orderData
            };
        } catch (error) {
            throw new Error('Failed to update user with order ID: ' + error.message);
        }
    }
}

export default new UserService();
