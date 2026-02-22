
import mongoose from 'mongoose';
import { CounsellingForm } from './src/models/forms.model.js';
import { LandingPage } from './src/models/landingPage.model.js';
import { UserList } from './src/models/userList.model.js';
import { Permission } from './src/models/misc.model.js';
import { Admin } from './src/models/admin.model.js';
import connectDB from './src/config/database.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    await connectDB();

    console.log('--- Database Integrity Check ---');
    try {
        const adminCount = await Admin.countDocuments();
        console.log(`Admins: ${adminCount}`);

        const permissionCount = await Permission.countDocuments();
        console.log(`Permissions: ${permissionCount}`);

        const formCount = await CounsellingForm.countDocuments();
        console.log(`CounsellingForms: ${formCount}`);

        const landingPageCount = await LandingPage.countDocuments();
        console.log(`LandingPages: ${landingPageCount}`);

        const landingPage = await LandingPage.findOne({});
        if (landingPage) {
            console.log(`PremiumPlans in LandingPage: ${landingPage.plans ? landingPage.plans.length : 0}`);
        } else {
            console.log('No LandingPage found (so no plans).');
        }

        const listCount = await UserList.countDocuments();
        console.log(`UserLists: ${listCount}`);

    } catch (e) {
        console.error('Error checking DB:', e);
    }

    console.log('--- End Check ---');
    process.exit();
};

run();
