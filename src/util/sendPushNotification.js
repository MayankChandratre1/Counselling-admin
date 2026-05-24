import axios from 'axios';

const getOneSignalConfig = () => {
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const apiKey = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY)?.trim();

  if (!appId) {
    throw new Error('ONESIGNAL_APP_ID is not configured');
  }

  if (!apiKey) {
    throw new Error('ONESIGNAL_API_KEY is not configured');
  }

  return { appId, apiKey };
};

export async function sendOneSignalNotification(playerId, title, message, additionalData = {}) {
  try {
    const { appId, apiKey } = getOneSignalConfig();
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: appId,
        include_player_ids: [playerId],
        headings: { en: title },
        contents: { en: message },
        data: additionalData
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${apiKey}`
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
    const { appId, apiKey } = getOneSignalConfig();
    const response = await axios.post(
      'https://onesignal.com/api/v1/notifications',
      {
        app_id: appId,
        include_player_ids: playerIds,
        headings: { en: title },
        contents: { en: message },
        data: additionalData,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${apiKey}`,
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

// Main function — additionalData should include notificationId and optional url
export async function sendToAllSubscribers(userOneSignalIds, title, message, additionalData = {}) {
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
