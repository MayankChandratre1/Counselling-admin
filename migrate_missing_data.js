
import mongoose from 'mongoose';
import { CounsellingForm, RegistrationForm } from './src/models/forms.model.js';
import { LandingPage } from './src/models/landingPage.model.js';
import { Permission } from './src/models/misc.model.js';
import { Admin } from './src/models/admin.model.js';
import connectDB from './src/config/database.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const defaultPermissions = [
    {
        id: 'perm_super_admin',
        role: 'super-admin',
        pages: ['dashboard', 'users', 'analytics', 'forms', 'content', 'settings', 'payments', 'notifications']
    },
    {
        id: 'perm_admin',
        role: 'admin',
        pages: ['dashboard', 'users', 'analytics', 'forms', 'content']
    }
];

const defaultForms = [
    {
        id: 'form_engineering',
        steps: [
            { number: 1, title: "Personal Details", status: "Pending" },
            { number: 2, title: "Academic Details", status: "Pending" },
            { number: 3, title: "Documents Upload", status: "Pending" },
            { number: 4, title: "Payment", status: "Pending" }
        ]
    }
];

const defaultLandingPage = {
    id: 'landing_page_main',
    title: { english: "Counselling App", marathi: "Counselling App" },
    plans: [
        {
            title: "Basic Plan",
            price: 499,
            form: "form_engineering",
            benefits: ["Basic Support", "Form Filling"]
        },
        {
            title: "Premium Plan",
            price: 999,
            form: "form_engineering",
            benefits: ["Priority Support", "Form Filling", "Call Support"]
        }
    ]
};

const run = async () => {
    await connectDB();
    console.log('Starting Migration...');

    // 1. Permissions
    const permCount = await Permission.countDocuments();
    if (permCount === 0) {
        console.log('Seeding Permissions...');
        await Permission.insertMany(defaultPermissions);
    } else {
        console.log('Permissions already exist.');
    }

    // 2. Forms
    const formCount = await CounsellingForm.countDocuments();
    if (formCount === 0) {
        console.log('Seeding CounsellingForms...');
        await CounsellingForm.insertMany(defaultForms);
    } else {
        console.log('CounsellingForms already exist.');
    }

    // 3. Landing Page (Plans)
    const lpCount = await LandingPage.countDocuments();
    if (lpCount === 0) {
        console.log('Seeding LandingPage...');
        await LandingPage.create(defaultLandingPage);
    } else {
        // Check if plans exist, if not update
        const lp = await LandingPage.findOne({});
        if (!lp.plans || lp.plans.length === 0) {
            console.log('Updating LandingPage with default plans...');
            lp.plans = defaultLandingPage.plans;
            await lp.save();
        } else {
            console.log('LandingPage plans already exist.');
        }
    }

    // 4. Ensure Admin has a role causing permissions
    // (Optional: reset first admin to super-admin if needed)

    console.log('Migration Complete.');
    process.exit();
};

run();
