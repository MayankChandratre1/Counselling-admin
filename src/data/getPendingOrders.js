import { readFileSync } from 'fs';
import { join } from 'path';

// Read and parse the users.json file
function readUsersData() {
    try {
        const filePath = 'src\\data\\users.json';
        const data = readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error reading users.json:', error);
        return [];
    }
}

// Extract pending orders information for users with no completed orders
function getPendingOrders() {
    const users = readUsersData();
    const pendingOrders = [];

    users.forEach(user => {
        // Check if user has orders array
        if (!user.name.includes("Demo") && !user.name.includes("Mayank") && user.orders && Array.isArray(user.orders)) {
            // Check if user has any completed orders
            const hasCompletedOrders = user.orders.some(order => 
                order.paymentStatus === 'completed'
            );
            
            // Only process users who have NO completed orders
            if (!hasCompletedOrders) {
                user.orders.forEach(order => {
                    // Check if order has pending payment status
                    if (order.paymentStatus === 'pending') {
                        pendingOrders.push({
                            orderId: order.orderId,
                            phone: user.phone,
                            name: user.name || 'N/A',
                            amount: order.amount,
                            currency: order.currency || 'INR',
                            customerPlan: order.notes?.customerPlan || 'N/A',
                            createdAt: order.createdAt
                        });
                    }
                });
            }
        }
    });

    return pendingOrders;
}

// Format and display results
function displayPendingOrders() {
    const pendingOrders = getPendingOrders();
    
    console.log('\n=== PENDING ORDERS REPORT (Users with NO completed orders) ===');
    console.log(`Total pending orders found: ${pendingOrders.length}`);
    console.log('=' .repeat(60));
    
    if (pendingOrders.length === 0) {
        console.log('No pending orders found for users without completed orders.');
        return;
    }
    
    pendingOrders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order ID: ${order.orderId}`);
        console.log(`   Phone: ${order.phone}`);
        console.log(`   Name: ${order.name}`);
        console.log(`   Amount: ${order.amount} ${order.currency}`);
        console.log(`   Plan: ${order.customerPlan}`);
        if (order.createdAt) {
            const date = new Date(order.createdAt._seconds * 1000);
            console.log(`   Created: ${date.toLocaleString()}`);
        }
    });
    
    console.log('\n' + '='.repeat(60));
}

// Export functions for use in other modules
export default {
    getPendingOrders,
    displayPendingOrders,
    readUsersData
};

// Run the script if called directly
displayPendingOrders();