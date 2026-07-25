import User from '../models/user.model.js';
import UserList from '../models/userList.model.js';
import { getPaymentSourceDisplay } from '../constants/paymentSource.js';

/** Slim fields for dashboard cards — exclude stepsData (huge) and counsellingData. */
const PREMIUM_SLIM_PROJECTION = {
    id: 1,
    name: 1,
    phone: 1,
    email: 1,
    batch: 1,
    isPremium: 1,
    hasLoggedIn: 1,
    formFilled: 1,
    formFilledBy: 1,
    formFilledAt: 1,
    premiumPlan: 1,
};

const PREMIUM_DETAILS_PROJECTION = {
    id: 1,
    stepsData: 1,
    counsellingData: 1,
};

/**
 * Analytics Service
 * Main payload stays slim so M0 / Vercel don't socket-timeout.
 * Heavy stepsData + counsellingData load via getEnrolledDetails().
 */
class AnalyticsService {
    toEnrolledStub(u) {
        return {
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
        };
    }

    async getAnalytics() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [totalUsers, premiumUsers, assignedUserIds] = await Promise.all([
            User.countDocuments(),
            User.find({ isPremium: true }, PREMIUM_SLIM_PROJECTION).lean(),
            UserList.distinct('userId', {
                $or: [
                    { type: 'assigned' },
                    { type: { $exists: false } },
                    { type: null },
                    { type: '' },
                ],
            }),
        ]);

        const premiumIds = premiumUsers.map((u) => u.id).filter(Boolean);

        const premiumUserLists = premiumIds.length
            ? await UserList.find(
                { userId: { $in: premiumIds } },
                { userId: 1, type: 1, title: 1 }
            ).lean()
            : [];

        const userAssignedListIds = new Set(assignedUserIds);
        const userCreatedListIds = new Set();
        const userAssignedListTitles = {};
        const userCreatedListTitles = {};

        for (const ul of premiumUserLists) {
            const uid = ul.userId;
            if (ul.type === 'created') {
                userCreatedListIds.add(uid);
                if (!userCreatedListTitles[uid]) userCreatedListTitles[uid] = [];
                userCreatedListTitles[uid].push(ul.title || 'Unnamed');
            } else {
                if (!userAssignedListTitles[uid]) userAssignedListTitles[uid] = [];
                userAssignedListTitles[uid].push((ul.title || 'Unnamed') + ' #RL');
            }
        }

        const todayEnrolled = premiumUsers.filter((u) => {
            if (!u.premiumPlan?.purchasedDate) return false;
            return new Date(u.premiumPlan.purchasedDate) >= today;
        });
        const paymentPending = premiumUsers.filter((u) => u.premiumPlan?.isPaymentPending);

        const premiumPlanDistribution = premiumUsers.reduce((acc, u) => {
            const plan = u.premiumPlan?.planTitle || 'Unknown';
            acc[plan] = (acc[plan] || 0) + 1;
            return acc;
        }, {});

        const usersWithLists = userAssignedListIds.size;
        const usersWithoutLists = Math.max(0, totalUsers - usersWithLists);

        const withLists = {};
        const withoutLists = {};
        const withCreated = {};
        const withoutCreated = {};

        for (const u of premiumUsers) {
            const plan = u.premiumPlan?.planTitle || 'Unknown';
            const uid = u.id;
            const assignedTitles = userAssignedListTitles[uid] || [];
            const createdTitles = userCreatedListTitles[uid] || [];

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
                lists: [...assignedTitles, ...createdTitles],
            };

            if (!withLists[plan]) withLists[plan] = [];
            if (!withoutLists[plan]) withoutLists[plan] = [];
            if (userAssignedListIds.has(uid)) {
                withLists[plan].push({ ...stub, lists: assignedTitles });
            } else {
                withoutLists[plan].push({ ...stub, lists: [] });
            }

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
                    users: premiumUsers.map((u) => this.toEnrolledStub(u)),
                },
                todayEnrolled: {
                    total: todayEnrolled.length,
                    users: todayEnrolled.map((u) => this.toEnrolledStub(u)),
                },
                paymentPending: {
                    total: paymentPending.length,
                    users: paymentPending.map((u) => this.toEnrolledStub(u)),
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
            detailsPending: true,
        };
    }

    /**
     * Heavy fields only — call after main analytics (form progress / CSV export).
     * Returns { [userId]: { stepsData, counsellingData } }
     */
    async getEnrolledDetails() {
        const rows = await User.find({ isPremium: true }, PREMIUM_DETAILS_PROJECTION).lean();
        const byId = {};
        for (const u of rows) {
            byId[u.id] = {
                stepsData: u.stepsData || null,
                counsellingData: u.counsellingData || null,
            };
        }
        return { byId, count: rows.length };
    }
}

export default new AnalyticsService();
