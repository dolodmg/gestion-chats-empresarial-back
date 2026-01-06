const crypto = require('crypto');
const axios = require('axios');

/**
 * Normalize phone number to international format (digits only)
 */
function normalizePhoneNumber(phoneNumber) {
    return phoneNumber.replace(/\D/g, '');
}

/**
 * Hash phone number using SHA-256
 */
function hashPhoneNumber(phoneNumber) {
    const normalized = normalizePhoneNumber(phoneNumber);
    return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Generate unique event ID for deduplication
 */
function generateEventId(chatId, timestamp) {
    const data = `${chatId}_${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Send conversion event to Meta CAPI
 */
async function sendConversionEvent(config, eventData) {
    try {
        const { metaDatasetId, metaAccessToken, metaTestEventCode } = config;
        const { eventName, phoneNumber, chatId, value, currency = 'USD', ctwaClid } = eventData;

        // Validate required fields
        if (!metaDatasetId || !metaAccessToken) {
            throw new Error('Meta configuration is incomplete');
        }

        if (!eventName || !phoneNumber || !chatId) {
            throw new Error('Event data is incomplete');
        }

        // Generate event timestamp and ID
        const eventTime = Math.floor(Date.now() / 1000);
        const eventId = generateEventId(chatId, eventTime);

        // Hash phone number
        const hashedPhone = hashPhoneNumber(phoneNumber);

        // Determine action_source based on ctwa_clid availability
        const actionSource = ctwaClid ? 'business_messaging' : 'system_generated';

        console.log(`📊 Enviando evento a Meta con action_source: ${actionSource}${ctwaClid ? ' (con ctwa_clid)' : ''}`);

        // Build event data matching Meta's format
        const event = {
            event_name: eventName,
            event_time: eventTime,
            event_id: eventId,
            action_source: actionSource,
            user_data: {
                ph: [hashedPhone]
            },
            original_event_data: {
                event_name: eventName,
                event_time: eventTime
            }
        };

        // Add ctwa_clid and messaging_channel if available
        if (ctwaClid) {
            event.messaging_channel = 'whatsapp';
            event.ctwa_clid = ctwaClid;
            console.log(`🔑 Usando ctwa_clid: ${ctwaClid}`);
        }

        // Add custom_data if value is provided
        if (value !== null && value !== undefined) {
            event.custom_data = {
                currency: currency,
                value: value.toString()
            };
        }

        // Build final payload
        const payload = {
            data: [event]
        };

        // Add test event code if provided
        if (metaTestEventCode) {
            payload.test_event_code = metaTestEventCode;
        }

        // Log the payload for debugging
        console.log('📤 Sending to Meta CAPI:', JSON.stringify(payload, null, 2));

        // Send to Meta CAPI
        const url = `https://graph.facebook.com/v24.0/${metaDatasetId}/events`;
        const response = await axios.post(url, payload, {
            params: {
                access_token: metaAccessToken
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Meta CAPI event sent successfully:', {
            eventName,
            eventId,
            response: response.data
        });

        return {
            success: true,
            eventId,
            response: response.data
        };

    } catch (error) {
        console.error('Error sending Meta CAPI event:', error.response?.data || error.message);

        throw {
            success: false,
            error: error.response?.data?.error?.message || error.message,
            details: error.response?.data
        };
    }
}

module.exports = {
    normalizePhoneNumber,
    hashPhoneNumber,
    generateEventId,
    sendConversionEvent
};
