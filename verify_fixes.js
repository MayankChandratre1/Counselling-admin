
const BASE_URL = 'http://localhost:3009/api/admin';

async function test() {
    console.log('Testing APIs...');

    try {
        // 1. Get Premium Plans
        const plansRes = await fetch(`${BASE_URL}/get-premium-plans`);
        if (!plansRes.ok) throw new Error(`get-premium-plans failed: ${plansRes.status}`);
        const plans = await plansRes.json();
        console.log(`Plans: ${Array.isArray(plans) ? plans.length : 'Not Array'}`);

        // 2. Get Form Steps
        const formsRes = await fetch(`${BASE_URL}/formsteps`);
        if (!formsRes.ok) throw new Error(`formsteps failed: ${formsRes.status}`);
        const forms = await formsRes.json();
        console.log(`Forms: ${Array.isArray(forms) ? forms.length : 'Not Array'}`);

        // 3. Get Analytics
        const analyticsRes = await fetch(`${BASE_URL}/get-analytics`);
        if (!analyticsRes.ok) throw new Error(`get-analytics failed: ${analyticsRes.status}`);
        const analytics = await analyticsRes.json();

        const dist = analytics.planListDistribution;
        console.log('Plan List Distribution:', JSON.stringify(dist, null, 2));

        if (dist && dist.length > 0) {
            const totalWithList = dist.reduce((acc, item) => acc + (item._id.hasList ? item.count : 0), 0);
            const totalWithCreatedList = dist.reduce((acc, item) => acc + (item._id.hasCreatedList ? item.count : 0), 0);
            console.log(`Total Users with Assigned Lists: ${totalWithList}`);
            console.log(`Total Users with Created Lists: ${totalWithCreatedList}`);
        } else {
            console.log('Plan List Distribution is empty.');
        }

    } catch (error) {
        console.error('Test Failed:', error.message);
    }
}

test();
