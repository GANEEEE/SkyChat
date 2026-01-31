const { EmbedBuilder } = require('discord.js');

const GIVEAWAY_SETTINGS = {
    GIVEAWAY_BOT_ID: '530082442967646230',
    // إضافة قائمة الـ Hosts الذين لا نريد إعطائهم النقاط
    EXCLUDED_HOST_IDS: [
        '1363733513081454774', // ضع هنا الـ ID الخاص بالـ Host الأول
        // يمكنك إضافة المزيد من الـ IDs حسب الحاجة
    ]
};

// تعريف القنوات وأنواع النقاط
const POINTS_SETTINGS = {
    CHANNEL_MAPPINGS: {
        '1386656754338627615': 'daily',       // ضع ID قناة الديلي
        '1386678571107618916': 'special',   // ضع ID قناة السبيشال
        '1387006240978108550': 'vip',           // ضع ID قناة الـ VIP
        '1386682733920653454': 'humbler' // ضع ID قناة الكوميونيتي
    },
    POINTS_PER_WIN: 1
};

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // تحقق سريع من الرسالة
        if (!isValidMessage(message)) return;

        // تحقق من رسالة الفوز وإضافة النقاط
        if (isWinMessage(message)) {
            await handleGiveawayWin(message, client);
        }
    }
};

// ============ الدوال المساعدة ============

function isValidMessage(message) {
    if (message.author.id !== GIVEAWAY_SETTINGS.GIVEAWAY_BOT_ID) {
        return false;
    }

    if (!message.guild) {
        return false;
    }

    return true;
}

function isWinMessage(message) {
    const hasMention = message.mentions.users.size > 0;
    return hasMention;
}

// ============ معالجة الفوز وإضافة النقاط ============

async function handleGiveawayWin(message, client) {
    //console.log(`\n🎁 === (AUTO - GIVEAWAY WIN DETECTED - FAME) ===`);
    //console.log(`📢 CHANNEL: ${message.channel.name} (${message.channel.id})`);
    //console.log(`👥 MENTIONS: ${message.mentions.users.size} user(s)`);

    try {
        const winners = extractWinners(message);
        if (winners.length === 0) {
            console.log('❌ No winners found');
            return;
        }

        //console.log(`🎯 Found ${winners.length} winners`);

        // تحديد نوع النقاط بناءً على القناة
        const pointsType = getPointsTypeFromChannel(message.channel.id);
        if (!pointsType) {
            console.log(`❌ Channel ${message.channel.id} not mapped for points`);
            return;
        }

        //console.log(`💰 Points type: ${pointsType.toUpperCase()}`);
       // console.log(`🔢 Points per win: ${POINTS_SETTINGS.POINTS_PER_WIN}`);

        for (const winner of winners) {
            // التحقق من أن الفائز ليس من الـ Hosts
            if (isExcludedHost(winner, GIVEAWAY_SETTINGS.EXCLUDED_HOST_IDS)) {
                //console.log(`🚫 Skipping points for excluded host: ${winner.tag} (${winner.id})`);
                continue;
            }

            await addPointsToWinner(client, winner, pointsType, message);
        }

        // تحديث الليدر بورد
        //await updateLeaderboards(client, message.guild);

        //console.log(`✅ Finished processing ${winners.length} winners`);
        //console.log(`🎁 === END GIVEAWAY PROCESSING (AUTO FAME) ===\n`);

    } catch (error) {
        console.error('💥 Error in handleGiveawayWin:', error);
    }
}

function extractWinners(message) {
    const winners = [];

    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach(user => {
            winners.push(user);
            //console.log(`✅ Winner: ${user.tag} (${user.id})`);
        });
    }

    return winners;
}

// دالة لتحديد نوع النقاط بناءً على القناة
function getPointsTypeFromChannel(channelId) {
    return POINTS_SETTINGS.CHANNEL_MAPPINGS[channelId];
}

// دالة للتحقق من أن الفائز ليس من الـ Hosts
function isExcludedHost(winner, excludedHostIds) {
    return excludedHostIds.includes(winner.id);
}

// ============ إضافة النقاط إلى الفائز ============

async function addPointsToWinner(client, winner, pointsType, originalMessage) {
    //console.log(`💰 Adding ${POINTS_SETTINGS.POINTS_PER_WIN} ${pointsType} points to ${winner.tag}...`);

    try {
        // استخدام نفس دالة الـ database اللي في الأمر اليدوي
        await client.dbManager.addFamePoints(
            winner.id, 
            winner.username, 
            pointsType, 
            POINTS_SETTINGS.POINTS_PER_WIN
        );

        //console.log(`✅ Added ${POINTS_SETTINGS.POINTS_PER_WIN} ${pointsType} points to ${winner.tag}`);

    } catch (error) {
        console.error(`❌ Error adding points to ${winner.tag}:`, error);
    }
}

/*// ============ تحديث الليدر بورد ============

async function updateLeaderboards(client, guild) {
    try {
        const { updateAllLeaderboards } = require('./2 fameleaderboard');
        await updateAllLeaderboards();
        console.log('📊 Leaderboards updated');
    } catch (error) {
        console.error('❌ Error updating leaderboards:', error);
    }
}*/

// ============ تحميل الإعدادات ============

module.exports.loadSettings = async function(client) {
    //console.log('\n🎯 Auto Fame Points Settings:');
    //console.log('============================');

    try {
        //console.log(`🤖 Giveaway Bot ID: ${GIVEAWAY_SETTINGS.GIVEAWAY_BOT_ID}`);
        //console.log(`🚫 Excluded Host IDs: ${GIVEAWAY_SETTINGS.EXCLUDED_HOST_IDS.join(', ') || 'None'}`);
        //console.log(`🔢 Points Per Win: ${POINTS_SETTINGS.POINTS_PER_WIN}`);

        //console.log('\n📊 Channel Mappings:');
        //console.log('-------------------');

        for (const [channelId, pointsType] of Object.entries(POINTS_SETTINGS.CHANNEL_MAPPINGS)) {
            try {
                const channel = await client.channels.fetch(channelId).catch(() => null);
                const channelName = channel ? channel.name : 'Unknown Channel';
                //console.log(`📌 ${channelName} (${channelId}) → ${pointsType.toUpperCase()}`);
            } catch (error) {
                console.log(`❌ Channel ${channelId} → ${pointsType.toUpperCase()} (Channel not found)`);
            }
        }

    } catch (error) {
        console.error('❌ Error loading settings:', error);
    }
};

// ============ دالة لإضافة قناة جديدة ============

module.exports.addChannelMapping = function(channelId, pointsType) {
    if (['daily', 'special', 'vip', 'humbler'].includes(pointsType.toLowerCase())) {
        POINTS_SETTINGS.CHANNEL_MAPPINGS[channelId] = pointsType.toLowerCase();
        //console.log(`✅ Added mapping: ${channelId} → ${pointsType}`);
        return true;
    }
    console.log(`❌ Invalid points type: ${pointsType}`);
    return false;
};

// ============ دالة لإزالة قناة ============

module.exports.removeChannelMapping = function(channelId) {
    if (POINTS_SETTINGS.CHANNEL_MAPPINGS[channelId]) {
        delete POINTS_SETTINGS.CHANNEL_MAPPINGS[channelId];
        //console.log(`✅ Removed mapping for channel: ${channelId}`);
        return true;
    }
    console.log(`❌ No mapping found for channel: ${channelId}`);
    return false;
};

// ============ دالة لعرض جميع المابينجس ============

module.exports.getChannelMappings = function() {
    return POINTS_SETTINGS.CHANNEL_MAPPINGS;
};