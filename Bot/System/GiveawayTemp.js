const { EmbedBuilder } = require('discord.js');

const GIVEAWAY_SETTINGS = {
    TEMP_ROLE_DURATION: '1w',
    GIVEAWAY_BOT_ID: '530082442967646230',
    // إضافة قائمة الـ Hosts الذين لا نريد إعطائهم الرول
    EXCLUDED_HOST_IDS: [
        '1363733513081454774', // ضع هنا الـ ID الخاص بالـ Host الأول
        // يمكنك إضافة المزيد من الـ IDs حسب الحاجة
    ]
};

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // تحقق سريع من الرسالة
        if (!isValidMessage(message)) return;

        //console.log(`🔔 giveawayAutoRole triggered! Author: ${message.author.tag}`);
        //console.log(`📝 Channel: ${message.channel.name} (${message.channel.id})`);

        // جلب الإعدادات من الداتابيز
        const settings = await getGiveawaySettings(client, message.guild.id);
        if (!settings) return;

        // تحقق من القناة المسموح بيها
        if (!isAllowedChannel(message, settings.allowedChannels)) return;

        //console.log('✅ Passed all checks');

        // تحقق من رسالة الفوز وإعطاء الرول
        if (isWinMessage(message)) {
            await handleGiveawayWin(message, client, settings);
        }
    }
};

// ============ الدوال المساعدة ============

function isValidMessage(message) {
    if (message.author.id !== GIVEAWAY_SETTINGS.GIVEAWAY_BOT_ID) {
        console.log(`❌ Not giveaway bot. Author ID: ${message.author.id}`);
        return false;
    }

    if (!message.guild) {
        console.log('❌ Not in a guild');
        return false;
    }

    return true;
}

async function getGiveawaySettings(client, guildId) {
    try {
        //console.log(`🔍 Loading giveaway settings for guild: ${guildId}`);

        // جلب champion rest role من الداتابيز
        const championRestRoleData = await client.dbManager.getBotSetting('championRestRole');
        if (!championRestRoleData) {
            console.log('❌ No champion rest role found in database');
            return null;
        }

        const roleInfo = JSON.parse(championRestRoleData.setting_value);
        //console.log(`✅ Champion rest role loaded: ${roleInfo.name} (${roleInfo.id})`);

        // جلب allowed channels من الداتابيز
        const allowedChannels = await getGiveawayAutoChannels(client, guildId);
        //console.log(`✅ Allowed channels loaded: ${allowedChannels.length} channels`);

        // استخدام الـ duration الثابت من GIVEAWAY_SETTINGS
        //console.log(`⏰ Role duration: ${GIVEAWAY_SETTINGS.TEMP_ROLE_DURATION}`);

        return {
            tempRoleId: roleInfo.id,
            allowedChannels: allowedChannels,
            duration: GIVEAWAY_SETTINGS.TEMP_ROLE_DURATION,
            excludedHostIds: GIVEAWAY_SETTINGS.EXCLUDED_HOST_IDS
        };

    } catch (error) {
        console.error('❌ Error loading giveaway settings:', error);
        return null;
    }
}

async function getGiveawayAutoChannels(client, guildId) {
    try {
        const channels = await client.dbManager.all(
            'SELECT channel_id FROM giveaway_auto_channels WHERE guild_id = ?',
            [guildId]
        );
        return channels.map(channel => channel.channel_id);
    } catch (error) {
        console.error('❌ Error loading giveaway auto channels:', error);
        return [];
    }
}

function isAllowedChannel(message, allowedChannels) {
    const isAllowed = allowedChannels.includes(message.channel.id);
    //console.log(`🔍 Channel check: ${isAllowed ? '✅ ALLOWED' : '❌ NOT ALLOWED'}`);
    return isAllowed;
}

function isWinMessage(message) {
    const hasMention = message.mentions.users.size > 0;
    //console.log(`🎯 Is win message: ${hasMention}`);
    return hasMention;
}

// ============ معالجة الفوز ============

async function handleGiveawayWin(message, client, settings) {
    //console.log('🎉 Starting to handle giveaway win...');

    try {
        // إضافة الكونسول لوج المطلوبة هنا
        /*console.log(`\n🎁 === GIVEAWAY BOT DETECTED ===`);
        console.log(`👥 MENTIONS: [ ${Array.from(message.mentions.users.values()).map(u => u.username).join(', ')} ]`);
        console.log(`📋 MENTION COUNT: ${message.mentions.users.size}`);
        console.log(`👤 AUTHOR: ${message.author.tag} (${message.author.id})`);
        //console.log(`📢 CHANNEL: ${message.channel.name} (${message.channel.id})`);
        //console.log(`🏰 GUILD: ${message.guild.name} (${message.guild.id})`);
        //console.log(`🔢 MESSAGE ID: ${message.id}`);
        console.log(`⏰ TIMESTAMP: ${new Date().toISOString()}`);
        console.log(`🎁 === END GIVEAWAY MESSAGE ===\n`);*/

        const winners = extractWinners(message);
        if (winners.length === 0) {
            console.log('❌ No winners found');
            return;
        }

        //console.log(`🎯 Found ${winners.length} winners`);

        // إضافة سجل تفصيلي للفائزين
        //console.log(`🏆 WINNERS LIST: ${winners.map(w => `${w.tag} (${w.id})`).join(', ')}`);

        for (const winner of winners) {
            // التحقق من أن الفائز ليس من الـ Hosts
            if (isExcludedHost(winner, settings.excludedHostIds)) {
                //console.log(`🚫 Skipping role assignment for excluded host: ${winner.tag} (${winner.id})`);
                continue;
            }

            const winnerMember = await findMember(message.guild, winner);
            if (!winnerMember) {
                console.log(`❌ Member ${winner.tag} not found in guild`);
                continue;
            }

            await giveTempRole(client, winnerMember, message, settings);
        }

        // إضافة سجل نهائي
        //console.log(`✅ Finished processing ${winners.length} winners`);

    } catch (error) {
        console.error('💥 Error in handleGiveawayWin:', error);
    }
}

function extractWinners(message) {
    const winners = [];

    if (message.mentions.users.size > 0) {
        // جلب جميع المستخدمين المذكورين في الرسالة
        message.mentions.users.forEach(user => {
            winners.push(user);
            //console.log(`✅ Winner: ${user.tag} (${user.id})`);
        });
    }

    //console.log(`🎯 Total winners extracted: ${winners.length}`);
    return winners;
}

// دالة للتحقق من أن الفائز ليس من الـ Hosts
function isExcludedHost(winner, excludedHostIds) {
    const isExcluded = excludedHostIds.includes(winner.id);
    //console.log(`🔍 Host check for ${winner.tag}: ${isExcluded ? '🚫 EXCLUDED' : '✅ ALLOWED'}`);
    return isExcluded;
}

async function findMember(guild, winner) {
    try {
        if (winner.id) {
            return await guild.members.fetch(winner.id);
        }

        console.log('❌ Invalid winner format');
        return null;
    } catch (error) {
        console.log(`❌ Error finding member ${winner.tag}:`, error.message);
        return null;
    }
}

// ============ إعطاء الرول المؤقت ============

async function giveTempRole(client, winnerMember, originalMessage, settings) {
    //console.log(`🎁 Giving temp role to ${winnerMember.user.tag}...`);

    try {
        const tempRole = originalMessage.guild.roles.cache.get(settings.tempRoleId);
        if (!tempRole) {
            console.log(`❌ Role with ID ${settings.tempRoleId} not found`);
            return;
        }

        //console.log(`✅ Role found: ${tempRole.name}`);

        // التحقق إذا كان العضو لديه الرول بالفعل
        if (winnerMember.roles.cache.has(tempRole.id)) {
            //console.log(`ℹ️ ${winnerMember.user.tag} already has the role, skipping...`);
            return;
        }

        // إعطاء الرول
        await winnerMember.roles.add(tempRole);
        //console.log(`✅ Role added to ${winnerMember.user.tag}`);

        // جدولة الإزالة
        await scheduleTempRoleRemoval(client, winnerMember, tempRole, originalMessage, settings.duration);

        // إرسال الإشعار
        await sendAnnouncement(client, winnerMember, tempRole, originalMessage, settings.duration);

    } catch (error) {
        console.error(`❌ Error giving temp role to ${winnerMember.user.tag}:`, error);
    }
}

async function scheduleTempRoleRemoval(client, winnerMember, tempRole, originalMessage, duration) {
    try {
        const parseDuration = require('../System/durationParser');
        const durationMs = parseDuration(duration);

        if (!durationMs) {
            console.log('❌ Invalid duration format');
            return;
        }

        const expiresAt = new Date(Date.now() + durationMs);

        // حفظ في الداتابيز
        const tempRoleData = {
            userId: winnerMember.id,
            userName: winnerMember.user.tag,
            roleId: tempRole.id,
            roleName: tempRole.name,
            guildId: originalMessage.guild.id,
            guildName: originalMessage.guild.name,
            expiresAt: expiresAt,
            duration: duration,
            assignedBy: client.user.id,
            assignedByName: client.user.tag,
            initialMessageId: null,
            channelId: originalMessage.channelId
        };

        await client.dbManager.addTempRole(tempRoleData);

        // جدولة الإزالة
        const { scheduleRoleRemoval } = require('../Commands/5 temprole');
        scheduleRoleRemoval(
            client, 
            winnerMember.id, 
            tempRole.id, 
            originalMessage.guild.id, 
            expiresAt, 
            duration, 
            client.user.id, 
            null, 
            originalMessage.channelId
        );

        console.log(`✅ Role scheduled for removal in ${duration} for ${winnerMember.user.tag}`);

    } catch (error) {
        console.error('❌ Error scheduling role removal:', error);
    }
}

// ============ الإشعارات ============

async function sendAnnouncement(client, winnerMember, tempRole, originalMessage, duration) {
    try {
        const communityChannel = await getCommunityChannel(client, originalMessage.guild.id);

        if (communityChannel) {
            const announcementChannel = client.channels.cache.get(communityChannel.id);
            if (announcementChannel) {
                await sendToChannel(announcementChannel, winnerMember, tempRole, originalMessage, duration, 'community');
                return;
            }
        }

        // إذا مفيش قناة community، ابعت في القناة الأصلية
        await sendToOriginalChannel(winnerMember, tempRole, originalMessage, duration);

    } catch (error) {
        console.error('❌ Error sending announcement:', error);
        await sendToOriginalChannel(winnerMember, tempRole, originalMessage, duration);
    }
}

async function getCommunityChannel(client, guildId) {
    try {
        const channelData = await client.dbManager.get(
            'SELECT * FROM log_channels WHERE guild_id = ? AND channel_type = ?',
            [guildId, 'communitycommands']
        );

        return channelData ? {
            id: channelData.channel_id,
            name: channelData.channel_name
        } : null;
    } catch (error) {
        console.error('❌ Error getting community channel:', error);
        return null;
    }
}

async function sendToChannel(channel, winnerMember, tempRole, originalMessage, duration, type) {
    const guild = originalMessage.guild;
    const durationText = formatDurationText(duration);
    const expiresTimestamp = Math.floor((Date.now() + parseDuration(duration)) / 1000);

    const embed = new EmbedBuilder()
        .setColor('#0073ff')
        .setTitle('**ChampionRest Assigned**')
        .setImage(process.env.BlueLine)
        //.setDescription(`${winnerMember} assigned ${tempRole}`)
        .addFields(
            { name: 'Assigned Role', value: `${tempRole}`, inline: true },
            { name: 'Member', value: `${winnerMember}`, inline: true },
            { name: 'Duration', value: `**${durationText}**`, inline: false },
            { name: 'Expires', value: `<t:${expiresTimestamp}:F>`, inline: false }
        )
        .setThumbnail(winnerMember.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ 
            text: `Auto ChampionRest Roles | ${guild.name}`, 
            iconURL: guild.iconURL() 
        });

    /*const content = type === 'community' 
        ? `🎉 ${winnerMember} Congratulations on winning the giveaway!`
        : `🎉 ${winnerMember}`;*/

    await channel.send({ embeds: [embed] });
    //console.log(`✅ Announcement sent in ${channel.name} for ${winnerMember.user.tag}`);
}

async function sendToOriginalChannel(winnerMember, tempRole, originalMessage, duration) {
    await sendToChannel(originalMessage.channel, winnerMember, tempRole, originalMessage, duration, 'original');
}

// ============ Utilities ============

function formatDurationText(duration) {
    const unitMap = {
        's': 'Seconds',
        'm': 'Minutes', 
        'h': 'Hours',
        'd': 'Days',
        'w': 'Weeks',
        'M': 'Months',
        'y': 'Years'
    };

    const match = duration.match(/^(\d+)([smhdwMy])$/);
    if (match) {
        const value = match[1];
        const unit = unitMap[match[2]] || match[2];
        return `${value} ${unit}`;
    }

    return duration; // Fallback to original if can't parse
}

function parseDuration(duration) {
    try {
        const parseDuration = require('../System/durationParser');
        return parseDuration(duration);
    } catch (error) {
        console.error('❌ Error parsing duration:', error);
        return 7 * 24 * 60 * 60 * 1000; // Default 7 days in ms
    }
}

// ============ تحميل الإعدادات ============

module.exports.loadSettings = async function(client) {
    console.log('🎯 Current Giveaway Settings:');

    try {
        const championRestRoleData = await client.dbManager.getBotSetting('championRestRole');
        if (championRestRoleData) {
            const roleInfo = JSON.parse(championRestRoleData.setting_value);
            //console.log(`🎁 Champion Rest Role: ${roleInfo.name} (${roleInfo.id})`);
        } else {
            console.log(`🎁 Champion Rest Role: ❌ Not set in database`);
        }

        //console.log(`⏰ Role Duration: ${GIVEAWAY_SETTINGS.TEMP_ROLE_DURATION}`);
        //console.log(`🚫 Excluded Host IDs: ${GIVEAWAY_SETTINGS.EXCLUDED_HOST_IDS.join(', ') || 'None'}`);

    } catch (error) {
        console.error('❌ Error loading settings:', error);
    }
};