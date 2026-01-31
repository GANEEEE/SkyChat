const { Events } = require('discord.js');
const dbManager = require('../Data/database');

// التحقق إذا كانت القناة محسوبة
async function isChannelCounted(guildId, channelId) {
    try {
        const result = await dbManager.get(
            'SELECT COUNT(*) as count FROM counted_channels WHERE guild_id = ? AND channel_id = ?',
            [guildId, channelId]
        );
        return result.count > 0;
    } catch (error) {
        console.error('Error checking if channel is counted:', error);
        return false;
    }
}

// زيادة عدد الرسائل
async function incrementMessageCount(userId, username, guildId, channelId) {
    // التحقق إذا كانت القناة محسوبة
    const shouldCount = await isChannelCounted(guildId, channelId);

    if (!shouldCount) {
        //console.log(`❌ Ignoring message in channel ${channelId} (not in counted channels)`);
        return;
    }

    try {
        await dbManager.incrementMessageCount(userId, username);
        //console.log(`✅ Counted message from ${username} in channel ${channelId}`);
    } catch (error) {
        console.error('Error incrementing message count:', error);
    }
}

// زيادة عدد الرسائل المحذوفة
async function incrementDeletedMessageCount(userId, guildId, channelId) {
    // التحقق إذا كانت القناة محسوبة
    const shouldCount = await isChannelCounted(guildId, channelId);

    if (!shouldCount) {
        //console.log(`❌ Ignoring deleted message in channel ${channelId} (not in counted channels)`);
        return;
    }

    try {
        await dbManager.incrementDeletedMessageCount(userId);
        //console.log(`✅ Counted deleted message from user ${userId} in channel ${channelId}`);
    } catch (error) {
        console.error('Error incrementing deleted message count:', error);
    }
}

// تهيئة نظام عد الرسائل
function setupMessageTracking(client) {
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.bot || message.system || !message.guild) return;

        await incrementMessageCount(
            message.author.id, 
            message.author.username, 
            message.guild.id, 
            message.channel.id
        );
    });

    client.on(Events.MessageDelete, async (message) => {
        if (message.author?.bot || !message.guild) return;

        if (message.author) {
            await incrementDeletedMessageCount(
                message.author.id, 
                message.guild.id, 
                message.channel.id
            );
        }
    });

    console.log('✅ Message Counting System is Running Successfully (Counted Channels Only).');
}

// التصدير
module.exports = {
    setupMessageTracking
};