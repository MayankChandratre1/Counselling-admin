import axios from 'axios';

export async function sendOneSignalNotification(playerId, title, message, additionalData = {}) {
  try {
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: process.env.ONESIGNAL_APP_ID, // Store this in your .env file
        include_player_ids: [playerId],
        headings: { en: title },
        contents: { en: message },
        data: {}
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}` // Store this in your .env file
        }
      }
    );

    console.log(response.data);
    
    
    return response.data;
  } catch (error) {
    console.error('Error sending OneSignal notification:', error.response?.data || error.message);
    throw error;
  }
}


// Helper to chunk array into groups of N
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export async function sendOneSignalBatch(playerIds, title, message, additionalData = {}) {
  try {
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: process.env.ONESIGNAL_APP_ID,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
        data: additionalData,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
        }
      }
    );

    console.log('Batch sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in batch:', error.response?.data || error.message);
    throw error;
  }
}

// Main function
export async function sendToAllSubscribers(userOneSignalIds, title, message, userIds) {
  const additionalData = { userId: userIds };
  const BATCH_SIZE = 2000; // OneSignal max limit
  const batches = chunkArray(userOneSignalIds, BATCH_SIZE);

  for (const batch of batches) {
    try {
      await sendOneSignalBatch(batch, title, message, additionalData);
    } catch (err) {
      console.error('Failed to send to batch:', err.message);
    }
  }
}
