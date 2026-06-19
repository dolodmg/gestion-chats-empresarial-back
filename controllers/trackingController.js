const Campaign = require('../models/Campaign');

function getOpenTrackingMinDelayMs() {
    const parsedValue = Number.parseInt(process.env.OPEN_TRACKING_MIN_DELAY_MS || '5000', 10);
    return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : 5000;
}

/**
 * Track email open
 */
exports.trackEmailOpen = async (req, res) => {
    try {
        const { campaignId, recipientId } = req.params;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return sendTrackingPixel(res);
        }

        const recipient = campaign.recipients.id(recipientId);
        if (!recipient) {
            return sendTrackingPixel(res);
        }

        const minDelayMs = getOpenTrackingMinDelayMs();
        if (recipient.sentAt && minDelayMs > 0) {
            const elapsedMs = Date.now() - new Date(recipient.sentAt).getTime();
            if (elapsedMs >= 0 && elapsedMs < minDelayMs) {
                return sendTrackingPixel(res);
            }
        }

        // Track the open
        const isFirstOpen = !recipient.opened;
        recipient.opened = true;
        recipient.openCount = (recipient.openCount || 0) + 1;

        if (isFirstOpen) {
            recipient.openedAt = new Date();
            campaign.uniqueOpens = (campaign.uniqueOpens || 0) + 1;
        }

        campaign.openCount = (campaign.openCount || 0) + 1;

        // Calculate open rate
        const sentCount = campaign.recipients.filter(r => r.status === 'sent').length;
        if (sentCount > 0) {
            campaign.openRate = Math.round((campaign.uniqueOpens / sentCount) * 100);
        }

        await campaign.save();

        sendTrackingPixel(res);
    } catch (error) {
        console.error('Error tracking email open:', error);
        sendTrackingPixel(res);
    }
};

/**
 * Track link click
 */
exports.trackLinkClick = async (req, res) => {
    try {
        const { campaignId, recipientId } = req.params;
        const { url } = req.query;

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).send('Campaign not found');
        }

        const recipient = campaign.recipients.id(recipientId);
        if (!recipient) {
            return res.status(404).send('Recipient not found');
        }

        // Track the click
        const isFirstClick = !recipient.clicked;
        recipient.clicked = true;
        recipient.clickCount = (recipient.clickCount || 0) + 1;

        if (isFirstClick) {
            recipient.clickedAt = new Date();
            campaign.uniqueClicks = (campaign.uniqueClicks || 0) + 1;
        }

        campaign.clickCount = (campaign.clickCount || 0) + 1;

        // Calculate click rate
        const sentCount = campaign.recipients.filter(r => r.status === 'sent').length;
        if (sentCount > 0) {
            campaign.clickRate = Math.round((campaign.uniqueClicks / sentCount) * 100);
        }

        await campaign.save();

        // Redirect to original URL
        if (url) {
            res.redirect(url);
        } else {
            res.send('Link tracked');
        }
    } catch (error) {
        console.error('Error tracking link click:', error);
        res.status(500).send('Error tracking click');
    }
};

/**
 * Helper function to send 1x1 transparent pixel
 */
function sendTrackingPixel(res) {
    const pixel = Buffer.from(
        'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
        'base64'
    );

    res.writeHead(200, {
        'Content-Type': 'image/gif',
        'Content-Length': pixel.length,
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    res.end(pixel);
}
