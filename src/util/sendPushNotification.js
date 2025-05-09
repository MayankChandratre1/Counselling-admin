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