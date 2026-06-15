import User from '../models/user.model.js';
import UserList from '../models/userList.model.js';
import { getPaymentSourceDisplay } from '../constants/paymentSource.js';

/**
 * Analytics Service
 * Builds all dashboard metrics from MongoDB in one shot.
 *
 * Response shape (matches analyticsContext.jsx expectations):
 * {
 *   totalUsers,
 *   metrics: {
 *     installs: number,                          // total registered users
 *     enrolled:      { total, users[] },         // isPremium users
 *     todayEnrolled: { total, users[] },         // enrolled today
 *     paymentPending:{ total, users[] },         // isPaymentPending
 *   },
 *   premiumPlanDistribution: { [planTitle]: count },
 *   usersWithLists:    number,
 *   usersWithoutLists: number,
 *   listData: {
 *     userListDistributionWithLists:             { [plan]: userStub[] }
 *     userListDistributionWithoutLists:          { [plan]: userStub[] }
 *     userListDistributionWithCreatedLists:      { [plan]: userStub[] }
 *     userListDistributionWithoutCreatedLists:   { [plan]: userStub[] }
 *   }
 * }
 */
class AnalyticsService {
    async getAnalytics() {
        const allUsers = await User.find({}, {
            id: 1, name: 1, phone: 1, email: 1, batch: 1,
            isPremium: 1, hasLoggedIn: 1, formFilled: 1, formFilledBy: 1, formFilledAt: 1,
            premiumPlan: 1, stepsData: 1, counsellingData: 1,
        }).lean();

        const totalUsers = allUsers.length;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ── 2. Split users by premium status ──────────────────────────────────
        const premiumUsers = allUsers.filter(u => u.isPremium);
        const todayEnrolled = premiumUsers.filter(u => {
            if (!u.premiumPlan?.purchasedDate) return false;
            return new Date(u.premiumPlan.purchasedDate) >= today;
        });
        const paymentPending = premiumUsers.filter(u => u.premiumPlan?.isPaymentPending);

        // Helper: map a User doc to the slim stub the frontend uses
        const toEnrolledStub = (u) => ({
            id: u.id,
            name: u.name,
            phone: u.phone,
            email: u.email,
            batch: u.batch,
            planTitle: u.premiumPlan?.planTitle || '',
            purchasedDate: u.premiumPlan?.purchasedDate || null,
            expiryDate: u.premiumPlan?.expiryDate || null,
            amountPaid: u.premiumPlan?.amountPaid || 0,
            amountRemaining: u.premiumPlan?.amountRemaining || 0,
            isPaymentPending: !!u.premiumPlan?.isPaymentPending,
            paymentSource: u.premiumPlan?.paymentSource || 'App',
            paymentSourceLabel: u.premiumPlan?.paymentSourceLabel || '',
            paymentSourceDisplay: getPaymentSourceDisplay(u.premiumPlan),
            formFilled: u.formFilled || false,
            formFilledBy: u.formFilledBy || null,
            formFilledAt: u.formFilledAt || null,
            isPremium: u.isPremium,
            hasLoggedIn: u.hasLoggedIn || false,
            premiumPlan: u.premiumPlan,
            stepsData: u.stepsData,
            counsellingData: u.counsellingData,
        });

        // ── 3. Premium plan distribution ──────────────────────────────────────
        const premiumPlanDistribution = premiumUsers.reduce((acc, u) => {
            const plan = u.premiumPlan?.planTitle || 'Unknown';
            acc[plan] = (acc[plan] || 0) + 1;
            return acc;
        }, {});

        // ── 4. List data — query UserList collection ───────────────────────────
        // UserList type: 'assigned' = admin-assigned from MasterList
        //                'created'  = user-made list
        const allUserLists = await UserList.find({}, {
            userId: 1, type: 1, title: 1,
        }).lean();

        // Build per-user set of list types
        const userAssignedListIds = new Set();
        const userCreatedListIds = new Set();
        // Also track list titles for modal display
        const userAssignedListTitles = {}; // userId → [title, ...]
        const userCreatedListTitles = {}; // userId → [title, ...]

        for (const ul of allUserLists) {
            const uid = ul.userId;
            if (ul.type === 'assigned' || !ul.type) {
                userAssignedListIds.add(uid);
                if (!userAssignedListTitles[uid]) userAssignedListTitles[uid] = [];
                userAssignedListTitles[uid].push((ul.title || 'Unnamed') + ' #RL');
            } else if (ul.type === 'created') {
                userCreatedListIds.add(uid);
                if (!userCreatedListTitles[uid]) userCreatedListTitles[uid] = [];
                userCreatedListTitles[uid].push(ul.title || 'Unnamed');
            }
        }

        const usersWithLists = userAssignedListIds.size;
        const usersWithoutLists = totalUsers - usersWithLists;

        // ── 5. Build plan-keyed distribution maps for ListTracking ────────────
        // Shape: { [planTitle]: [ { id, name, phone, lists: [], formFilled, ... } ] }
        const withLists = {};   // premium, has assigned list
        const withoutLists = {};   // premium, no assigned list
        const withCreated = {}; // premium, has created list
        const withoutCreated = {}; // premium, no created list

        for (const u of premiumUsers) {
            const plan = u.premiumPlan?.planTitle || 'Unknown';
            const uid = u.id;

            const assignedTitles = userAssignedListTitles[uid] || [];
            const createdTitles = userCreatedListTitles[uid] || [];
            const allTitles = [...assignedTitles, ...createdTitles];

            const stub = {
                id: uid,
                name: u.name,
                phone: u.phone,
                email: u.email,
                batch: u.batch,
                planTitle: plan,
                purchasedDate: u.premiumPlan?.purchasedDate || null,
                formFilled: u.formFilled || false,
                formFilledBy: u.formFilledBy || null,
                formFilledAt: u.formFilledAt || null,
                isPremium: true,
                premiumPlan: u.premiumPlan,
                lists: allTitles,
            };

            // Assigned list buckets
            if (!withLists[plan]) withLists[plan] = [];
            if (!withoutLists[plan]) withoutLists[plan] = [];
            if (userAssignedListIds.has(uid)) {
                withLists[plan].push({ ...stub, lists: assignedTitles });
            } else {
                withoutLists[plan].push({ ...stub, lists: [] });
            }

            // Created list buckets
            if (!withCreated[plan]) withCreated[plan] = [];
            if (!withoutCreated[plan]) withoutCreated[plan] = [];
            if (userCreatedListIds.has(uid)) {
                withCreated[plan].push({ ...stub, lists: [...createdTitles, ...assignedTitles] });
            } else {
                withoutCreated[plan].push({ ...stub, lists: assignedTitles });
            }
        }

        return {
            totalUsers,
            metrics: {
                installs: totalUsers,
                enrolled: {
                    total: premiumUsers.length,
                    users: premiumUsers.map(toEnrolledStub),
                },
                todayEnrolled: {
                    total: todayEnrolled.length,
                    users: todayEnrolled.map(toEnrolledStub),
                },
                paymentPending: {
                    total: paymentPending.length,
                    users: paymentPending.map(toEnrolledStub),
                },
            },
            premiumPlanDistribution,
            usersWithLists,
            usersWithoutLists,
            listData: {
                userListDistributionWithLists: withLists,
                userListDistributionWithoutLists: withoutLists,
                userListDistributionWithCreatedLists: withCreated,
                userListDistributionWithoutCreatedLists: withoutCreated,
            },
        };
    }
}

export default new AnalyticsService();
