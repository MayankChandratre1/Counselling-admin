import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { UserSchema } from './SchemasV3.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const User = mongoose.models.User || mongoose.model('User', UserSchema, 'users');
const BACKUP_USERS_DIR = join(__dirname, '..', 'backups', 'users');

function parseArgs() {
	const args = process.argv.slice(2);
	return {
		apply: args.includes('--apply'),
		verbose: args.includes('--verbose')
	};
}

function normalizePhone(phone) {
	if (!phone) return null;
	const digits = String(phone).replace(/\D/g, '');
	if (digits.length >= 10) return digits.slice(-10);
	return digits || null;
}

function safeDate(value) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
}

function parsePlanDetails(details) {
	if (!details) return null;
	if (typeof details === 'object') return details;
	if (typeof details !== 'string') return null;

	try {
		return JSON.parse(details);
	} catch {
		return null;
	}
}

function pickCompletedOrder(user) {
	const orders = Array.isArray(user?.orders) ? user.orders : [];
	const completed = orders.filter(order => {
		const paymentStatus = (order?.paymentStatus || '').toLowerCase();
		if (paymentStatus === 'completed') return true;

		const status = (order?.status || '').toLowerCase();
		return status === 'paid';
	});

	if (completed.length === 0) return null;

	completed.sort((a, b) => {
		const aDate = safeDate(a?.updatedAt || a?.createdAt)?.getTime() || 0;
		const bDate = safeDate(b?.updatedAt || b?.createdAt)?.getTime() || 0;
		return bDate - aDate;
	});

	return completed[0];
}

function buildPremiumPlan(sourceUser) {
	const sourcePlan = sourceUser?.premiumPlan && typeof sourceUser.premiumPlan === 'object'
		? sourceUser.premiumPlan
		: {};

	const latestCompletedOrder = pickCompletedOrder(sourceUser);
	const orderNotes = latestCompletedOrder?.notes || {};
	const details = parsePlanDetails(orderNotes?.planDetails);

	const purchasedDate = safeDate(
		sourcePlan.purchasedDate
		|| latestCompletedOrder?.updatedAt
		|| latestCompletedOrder?.createdAt
		|| sourceUser?.createdAt
	);

	let expiryDate = safeDate(sourcePlan.expiryDate);
	if (!expiryDate && purchasedDate && details?.expiry) {
		const expiryDays = Number(details.expiry);
		if (!Number.isNaN(expiryDays) && expiryDays > 0) {
			expiryDate = new Date(purchasedDate.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
		}
	}

	const planTitle = sourcePlan.planTitle || orderNotes.planTitle || orderNotes.customerPlan || details?.plan || null;
	const form = sourcePlan.form || details?.form || null;
	const pending = sourcePlan.isPaymentPending;

	const normalized = {
		id: sourcePlan.id || null,
		planTitle,
		form,
		purchasedDate,
		expiryDate,
		isPaymentPending: typeof pending === 'boolean' ? pending : !latestCompletedOrder
	};

	return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== null && value !== undefined));
}

function hasPremiumSignal(user) {
	if (!user || typeof user !== 'object') return false;
	if (user.isPremium === true) return true;
	if (user?.premiumPlan && typeof user.premiumPlan === 'object' && Object.keys(user.premiumPlan).length > 0) return true;
	return false;
}

function readAllBackupUsers() {
	if (!existsSync(BACKUP_USERS_DIR)) {
		throw new Error(`Backup users directory not found: ${BACKUP_USERS_DIR}`);
	}

	const files = readdirSync(BACKUP_USERS_DIR)
		.filter(file => file.endsWith('.json'))
		.sort();

	const dedupById = new Map();

	for (const file of files) {
		const fullPath = join(BACKUP_USERS_DIR, file);
		try {
			const parsed = JSON.parse(readFileSync(fullPath, 'utf-8'));
			const rows = Array.isArray(parsed) ? parsed : [parsed];
			for (const user of rows) {
				if (user?.id) dedupById.set(user.id, user);
			}
		} catch (error) {
			console.warn(`Skipping ${file}: ${error.message}`);
		}
	}

	return [...dedupById.values()];
}

function isDifferentPlan(existingPlan = {}, incomingPlan = {}) {
	const keys = ['id', 'planTitle', 'form', 'purchasedDate', 'expiryDate', 'isPaymentPending'];
	for (const key of keys) {
		const a = existingPlan?.[key];
		const b = incomingPlan?.[key];

		if ((a instanceof Date || b instanceof Date) || key === 'purchasedDate' || key === 'expiryDate') {
			const aTime = a ? new Date(a).getTime() : null;
			const bTime = b ? new Date(b).getTime() : null;
			if (aTime !== bTime) return true;
			continue;
		}

		if ((a ?? null) !== (b ?? null)) return true;
	}
	return false;
}

async function run() {
	const { apply, verbose } = parseArgs();
	const mongoURI = process.env.MONGO_URI_NEW || process.env.MONGO_URI;

	if (!mongoURI) {
		throw new Error('Missing MONGO_URI_NEW / MONGO_URI in .env');
	}

	console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
	await mongoose.connect(mongoURI);

	const backupUsers = readAllBackupUsers().filter(hasPremiumSignal);
	const ids = backupUsers.map(user => user.id).filter(Boolean);
	const phones = backupUsers.map(user => normalizePhone(user.phone)).filter(Boolean);

	const dbUsers = await User.find({
		$or: [
			{ id: { $in: ids } },
			{ phone: { $in: phones } }
		]
	}).lean();

	const dbById = new Map();
	const dbByPhone = new Map();
	for (const user of dbUsers) {
		if (user.id) dbById.set(user.id, user);
		const phone = normalizePhone(user.phone);
		if (phone) dbByPhone.set(phone, user);
	}

	const ops = [];
	let matched = 0;
	let noMatch = 0;
	let unchanged = 0;

	for (const sourceUser of backupUsers) {
		const target = dbById.get(sourceUser.id) || dbByPhone.get(normalizePhone(sourceUser.phone));
		if (!target) {
			noMatch += 1;
			if (verbose) {
				console.log(`No DB match for backup user id=${sourceUser.id || 'N/A'} phone=${sourceUser.phone || 'N/A'}`);
			}
			continue;
		}

		matched += 1;
		const incomingPlan = buildPremiumPlan(sourceUser);
		const mergedPlan = {
			...(target.premiumPlan || {}),
			...incomingPlan
		};

		const premiumFromSource = sourceUser.isPremium === true || Object.keys(incomingPlan).length > 0;
		const needsPlanUpdate = isDifferentPlan(target.premiumPlan || {}, mergedPlan);
		const needsPremiumFlag = premiumFromSource && target.isPremium !== true;

		if (!needsPlanUpdate && !needsPremiumFlag) {
			unchanged += 1;
			continue;
		}

		ops.push({
			updateOne: {
				filter: { _id: target._id },
				update: {
					$set: {
						premiumPlan: mergedPlan,
						...(premiumFromSource ? { isPremium: true } : {})
					}
				}
			}
		});
	}

	console.log(`Backup premium candidates: ${backupUsers.length}`);
	console.log(`Matched in MongoDB: ${matched}`);
	console.log(`No DB match: ${noMatch}`);
	console.log(`Already up-to-date: ${unchanged}`);
	console.log(`Planned updates: ${ops.length}`);

	if (!apply || ops.length === 0) {
		console.log(apply ? 'No updates needed.' : 'Dry-run complete. Re-run with --apply to persist changes.');
		await mongoose.disconnect();
		return;
	}

	const result = await User.collection.bulkWrite(ops, { ordered: false });
	console.log('Applied updates:');
	console.log(`- matchedCount: ${result.matchedCount || 0}`);
	console.log(`- modifiedCount: ${result.modifiedCount || 0}`);

	await mongoose.disconnect();
}

run()
	.then(() => {
		console.log('Premium plan migration finished.');
		process.exit(0);
	})
	.catch(async (error) => {
		console.error('Premium plan migration failed:', error.message);
		try {
			await mongoose.disconnect();
		} catch {
			// no-op
		}
		process.exit(1);
	});
