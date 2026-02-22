import { User } from '../models/user.model.js';
import { sendOneSignalNotification, sendToAllSubscribers } from '../util/sendPushNotification.js';

class NotificationService {
    /**
     * Send a templated notification to one user or all users.
     * Mirrors admin.service.js sendNotification (lines 2261–2341).
     *
     * @param {string|null} userId - target user (null when toAll = true)
     * @param {object} template    - { title, message, additionalData? }
     * @param {object} customData  - merged into additionalData
     * @param {boolean} toAll
     */
    async sendNotification(userId, template, customData = {}, toAll = false) {
        try {
            if (!template?.title || !template?.message) {
                throw new Error('Notification template must have title and message');
            }

            if (toAll) {
                const users = await User.find({ oneSignalId: { $exists: true, $ne: null } })
                    .select('id oneSignalId').lean();

                console.log(`Sending notification to ${users.length} users`);
                const sends = users.map(u =>
                    sendOneSignalNotification(
                        u.oneSignalId,
                        template.title,
                        template.message,
                        { ...template.additionalData, ...customData, userId: u.id }
                    ).catch(err => console.error(`Failed for user ${u.id}:`, err))
                );
                await Promise.allSettled(sends);
                return { success: true, message: `Notification sent to ${users.length} users` };
            }

            const user = await User.findOne({ id: userId }).select('id oneSignalId').lean();
            if (!user) throw new Error('User not found');
            if (!user.oneSignalId) {
                console.log(`No OneSignal ID for user ${userId}`);
                return null;
            }

            return await sendOneSignalNotification(
                user.oneSignalId,
                template.title,
                template.message,
                { ...template.additionalData, ...customData, userId }
            );
        } catch (error) {
            console.error('Send notification error:', error);
            return null; // Notifications must not break main flows
        }
    }

    /**
     * Send a notification to a filtered subset of users or all users.
     * Mirrors admin.service.js sendNotificationToUsers (lines 2344–2466).
     *
     * @param {object} options
     * @param {string} options.title
     * @param {string} options.message
     * @param {boolean} [options.toAll]
     * @param {object} [options.filters]   { isPremium, isFree, plan, listAssigned, listsNotAssigned }
     * @param {string[]} [options.userIds] - specific user IDs (leave empty to use filters)
     */
    async sendNotificationToUsers({ title, message, toAll = false, filters = null, userIds = [] }) {
        try {
            if (!title || !message) throw new Error('title and message are required');

            if (toAll) {
                const users = await User.find({ oneSignalId: { $exists: true, $ne: null } })
                    .select('id oneSignalId').lean();

                console.log(`Sending notification to ALL: ${users.length} users`);
                const ids = users.map(u => u.oneSignalId);
                await sendToAllSubscribers(ids, title, message, {});
                return { success: true, message: `Notification sent to ${users.length} users` };
            }

            if (filters) {
                const query = { oneSignalId: { $exists: true, $ne: null } };

                if (filters.isPremium) query.isPremium = true;
                if (filters.isFree) query.isPremium = false;
                if (filters.plan && filters.plan !== 'all' && filters.plan.length > 0) {
                    query['premiumPlan.planTitle'] = filters.plan;
                }
                if (filters.listAssigned) {
                    query['lists.0'] = { $exists: true };
                }
                if (filters.listsNotAssigned) {
                    query.$or = [{ lists: { $exists: false } }, { lists: { $size: 0 } }];
                }

                const users = await User.find(query).select('id oneSignalId').lean();
                const ids = users.map(u => u.oneSignalId).filter(Boolean);

                console.log(`Sending notification to filtered ${ids.length} users`);
                await sendToAllSubscribers(ids, title, message, {});
                return { success: true, message: `Notification sent to ${ids.length} filtered users` };
            }

            // Specific user IDs
            if (userIds.length > 0) {
                const users = await User.find({ id: { $in: userIds }, oneSignalId: { $exists: true, $ne: null } })
                    .select('id oneSignalId').lean();
                const ids = users.map(u => u.oneSignalId);
                await sendToAllSubscribers(ids, title, message, {});
                return { success: true, message: `Notification sent to ${ids.length} specific users` };
            }

            return { success: false, message: 'No recipients specified' };
        } catch (error) {
            console.error('Send group notification error:', error);
            return null;
        }
    }
}

export default new NotificationService();
