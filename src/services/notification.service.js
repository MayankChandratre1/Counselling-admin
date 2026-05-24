import crypto from 'crypto';
import { User } from '../models/user.model.js';
import { UserList } from '../models/userList.model.js';
import { Notification } from '../models/notification.model.js';
import { UserNotification } from '../models/userNotification.model.js';
import { sendOneSignalBatch } from '../util/sendPushNotification.js';

const BATCH_SIZE = 2000;
const INBOX_INSERT_BATCH = 500;

function generateId() {
    return crypto.randomUUID().replace(/-/g, '').substring(0, 24);
}

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

class NotificationService {
    generateId() {
        return generateId();
    }

    getTargetAudience(toAll, filters, userIds) {
        if (toAll) return 'all';
        if (userIds?.length > 0) return 'specific';
        return 'filtered';
    }

    async resolveRecipients({ toAll = false, filters = null, userIds = [] }) {
        if (toAll) {
            return User.find({}).select('id oneSignalId').lean();
        }

        if (filters) {
            const query = {};

            if (filters.isPremium) query.isPremium = true;
            if (filters.isFree) query.isPremium = false;
            if (filters.plan && filters.plan !== 'all' && filters.plan.length > 0) {
                query['premiumPlan.planTitle'] = filters.plan;
            }
            if (filters.listAssigned || filters.listsNotAssigned) {
                const usersWithLists = await UserList.distinct('userId');
                if (filters.listAssigned) {
                    query.id = { $in: usersWithLists };
                } else if (filters.listsNotAssigned) {
                    query.id = { $nin: usersWithLists };
                }
            }

            return User.find(query).select('id oneSignalId').lean();
        }

        if (userIds.length > 0) {
            return User.find({ id: { $in: userIds } }).select('id oneSignalId').lean();
        }

        return [];
    }

    async persistUserInbox(notificationId, recipients) {
        const inboxRows = recipients.map((user) => ({
            id: generateId(),
            notificationId,
            userId: user.id,
            isRead: false,
            readAt: null,
        }));

        for (const batch of chunkArray(inboxRows, INBOX_INSERT_BATCH)) {
            await UserNotification.insertMany(batch, { ordered: false });
        }
    }

    async sendOneSignalToRecipients(notificationId, title, message, url, recipients) {
        const pushRecipients = recipients.filter((u) => u.oneSignalId);
        const playerIds = pushRecipients.map((u) => u.oneSignalId);
        const additionalData = { notificationId };
        if (url) additionalData.url = url;

        let sentCount = 0;
        for (const batch of chunkArray(playerIds, BATCH_SIZE)) {
            try {
                await sendOneSignalBatch(batch, title, message, additionalData);
                sentCount += batch.length;
            } catch (err) {
                console.error('Failed to send OneSignal batch:', err.message);
            }
        }

        return sentCount;
    }

    /**
     * Send a notification to users, persist inbox rows, and deliver via OneSignal.
     */
    async sendNotificationToUsers({
        title,
        message,
        url = null,
        toAll = false,
        filters = null,
        userIds = [],
        plan = null,
        sentBy = null,
    }) {
        try {
            if (!title || !message) throw new Error('title and message are required');

            const recipients = await this.resolveRecipients({ toAll, filters, userIds });
            if (recipients.length === 0) {
                return { success: false, message: 'No recipients specified' };
            }

            const notificationId = generateId();
            const targetAudience = this.getTargetAudience(toAll, filters, userIds);
            const selectedPlan = plan || filters?.plan || null;
            const isPlanSpecific = !!(selectedPlan && selectedPlan !== 'all' && selectedPlan.length > 0);

            await Notification.create({
                id: notificationId,
                title,
                message,
                targetAudience,
                sentBy,
                isPlanSpecific,
                plan: isPlanSpecific ? selectedPlan : null,
                url: url || null,
                filters: filters || null,
                recipientCount: recipients.length,
                sentCount: 0,
            });

            await this.persistUserInbox(notificationId, recipients);

            const sentCount = await this.sendOneSignalToRecipients(
                notificationId,
                title,
                message,
                url,
                recipients
            );

            await Notification.updateOne({ id: notificationId }, { sentCount });

            return {
                success: true,
                message: `Notification sent to ${recipients.length} users`,
                notificationId,
                recipientCount: recipients.length,
                sentCount,
            };
        } catch (error) {
            console.error('Send group notification error:', error);
            throw error;
        }
    }

    async listNotifications({ page = 1, limit = 20 } = {}) {
        const skip = (Math.max(1, page) - 1) * limit;
        const [items, total] = await Promise.all([
            Notification.find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments({}),
        ]);

        return {
            notifications: items,
            total,
            page: Math.max(1, page),
            limit,
            totalPages: Math.ceil(total / limit) || 1,
        };
    }

    async getNotificationById(id) {
        const notification = await Notification.findOne({ id }).lean();
        if (!notification) return null;

        const [readCount, unreadCount] = await Promise.all([
            UserNotification.countDocuments({ notificationId: id, isRead: true }),
            UserNotification.countDocuments({ notificationId: id, isRead: false }),
        ]);

        return {
            ...notification,
            readCount,
            unreadCount,
        };
    }
}

export default new NotificationService();
