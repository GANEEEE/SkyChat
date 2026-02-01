const { EmbedBuilder } = require('discord.js');

const CHAT_REWARDS_SETTINGS = {
    TEMP_ROLE_DURATION: '3d',
    CHAT_REWARDS_BOT_ID: '1261512844948803710',
    TARGET_ROLE_IDS: [
        '1416539071605379162'
    ],
    // إعدادات الرولات المؤقتة
    TEMP_ROLES: {
        // الرول العام (لأي شخص)
        GENERAL: {
            roleId: '1433808946455380038',
            name: 'General SkyPass'
        },
        // الرول المشروط (يحتاج رولات معينة)
        CONDITIONAL: {
            roleId: '1436040584509919444',
            name: 'Premium SkyPass',
            // الرولات المطلوبة (يحتاج واحدة منها على الأقل)
            requiredRoleIds: [
                '1363754810645417994',
                '1374313963428253847'
            ]
        }
    },
    ALLOWED_CHANNEL_IDS: [
        '1434904222805004411'
    ],
    WAIT_DURATION: 60000 // 65 ثانية
};

async function execute(message, client) {
    if (!isValidMessage(message)) {
        console.log(`❌ Message validation failed`);
        return;
    }

    const settings = getChatRewardsSettings();
    if (!settings) {
        console.log(`❌ Failed to load settings`);
        return;
    }

    if (!isAllowedChannel(message, settings.allowedChannels)) {
        return;
    }

    if (isPurchaseMessage(message)) {
        await handleRolePurchase(message, client, settings);
    } else if (isRefundMessage(message)) {
        await handleRoleRefund(message, client, settings);
    } else {
        console.log(`❌ Not a purchase or refund message`);
    }
}

// ============ الدوال المساعدة ============

function isValidMessage(message) {
    if (!message.author.bot) {
        console.log(`❌ Message not from a bot`);
        return false;
    }

    if (message.author.id !== CHAT_REWARDS_SETTINGS.CHAT_REWARDS_BOT_ID) {
        console.log(`❌ Not chat rewards bot. Expected: ${CHAT_REWARDS_SETTINGS.CHAT_REWARDS_BOT_ID}, Got: ${message.author.id}`);
        return false;
    }

    if (!message.guild) {
        console.log('❌ Not in a guild');
        return false;
    }

    return true;
}

function getChatRewardsSettings() {
    try {
        const settings = {
            tempRoles: CHAT_REWARDS_SETTINGS.TEMP_ROLES,
            allowedChannels: CHAT_REWARDS_SETTINGS.ALLOWED_CHANNEL_IDS,
            duration: CHAT_REWARDS_SETTINGS.TEMP_ROLE_DURATION,
            targetRoleIds: CHAT_REWARDS_SETTINGS.TARGET_ROLE_IDS,
            waitDuration: CHAT_REWARDS_SETTINGS.WAIT_DURATION
        };

        return settings;
    } catch (error) {
        console.error('❌ Error loading chat rewards settings:', error);
        return null;
    }
}

function isAllowedChannel(message, allowedChannels) {
    return allowedChannels.includes(message.channel.id);
}

function isPurchaseMessage(message) {
    const hasEmbed = message.embeds && message.embeds.length > 0;
    if (hasEmbed) {
        const embed = message.embeds[0];
        const isPurchase = embed.description && 
            (embed.description.includes('purchased') || 
             embed.description.includes('bought') ||
             embed.description.includes('تم الشراء'));
        return isPurchase;
    }
    return false;
}

function isRefundMessage(message) {
    const hasEmbed = message.embeds && message.embeds.length > 0;
    if (hasEmbed) {
        const embed = message.embeds[0];
        const isRefund = embed.description && 
            (embed.description.includes('refund') || 
             embed.description.includes('استرجاع') ||
             embed.description.includes('إلغاء'));
        return isRefund;
    }
    return false;
}

// ============ معالجة شراء الرول ============

async function handleRolePurchase(message, client, settings) {
    try {
        const purchaseData = await extractPurchaseData(message, settings.targetRoleIds);
        if (!purchaseData) {
            console.log('❌ No valid purchase data found in embed');
            return;
        }

        const buyerMember = await findMember(message.guild, purchaseData.user);
        if (!buyerMember) {
            console.log(`❌ Member ${purchaseData.user.tag} not found in guild`);
            return;
        }

        console.log(`⏳ Waiting 65 seconds before processing role assignment for ${buyerMember.user.tag}...`);

        // الانتظار 65 ثانية قبل المعالجة
        setTimeout(async () => {
            await processRoleAssignment(client, buyerMember, message, settings);
        }, settings.waitDuration);

    } catch (error) {
        console.error('💥 Error in handleRolePurchase:', error);
    }
}

// ============ معالجة الـ Refund ============

async function handleRoleRefund(message, client, settings) {
    try {
        const refundData = await extractRefundData(message, settings.targetRoleIds);
        if (!refundData) {
            console.log('❌ No valid refund data found in embed');
            return;
        }

        const userMember = await findMember(message.guild, refundData.user);
        if (!userMember) {
            console.log(`❌ Member ${refundData.user.tag} not found in guild`);
            return;
        }

        // إزالة جميع الرولات المؤقتة فوراً
        await removeAllTempRoles(client, userMember, message, settings);

    } catch (error) {
        console.error('💥 Error in handleRoleRefund:', error);
    }
}

// ============ معالجة إعطاء الرولات بعد الانتظار ============

async function processRoleAssignment(client, member, originalMessage, settings) {
    console.log(`🎯 Processing role assignment for ${member.user.tag} after 65 seconds`);

    try {
        // التحقق من وجود الرول المستهدف
        const hasTargetRole = member.roles.cache.has(settings.targetRoleIds[0]);

        if (!hasTargetRole) {
            await notifyNoTargetRole(client, member, originalMessage);
            return;
        }

        // تحديد أي الرولات يمكن إعطاؤها
        const rolesToAssign = await getEligibleTempRoles(member, settings);

        if (rolesToAssign.length === 0) {
            console.log(`ℹ️ No eligible temp roles for ${member.user.tag}`);
            return;
        }

        // إعطاء الرولات المؤهلة
        const assignedRoles = [];
        for (const roleData of rolesToAssign) {
            const success = await assignTempRole(client, member, roleData, originalMessage, settings);
            if (success) {
                assignedRoles.push(roleData);
            }
        }

        // إرسال إيمبد واحد يضم كل الرولات المعطاة
        if (assignedRoles.length > 0) {
            await sendCombinedAnnouncement(client, member, assignedRoles, originalMessage, settings.duration, 'purchase');
        }

        console.log(`✅ Finished processing role assignment for ${member.user.tag}`);

    } catch (error) {
        console.error(`💥 Error processing role assignment for ${member.user.tag}:`, error);
    }
}

// ============ تحديد الرولات المؤهلة ============

async function getEligibleTempRoles(member, settings) {
    const eligibleRoles = [];

    // الرول العام (لأي شخص)
    if (settings.tempRoles.GENERAL && settings.tempRoles.GENERAL.roleId) {
        eligibleRoles.push(settings.tempRoles.GENERAL);
    }

    // الرول المشروط (يحتاج رولات معينة)
    if (settings.tempRoles.CONDITIONAL && settings.tempRoles.CONDITIONAL.roleId) {
        const hasRequiredRole = settings.tempRoles.CONDITIONAL.requiredRoleIds.some(roleId => 
            member.roles.cache.has(roleId)
        );

        if (hasRequiredRole) {
            eligibleRoles.push(settings.tempRoles.CONDITIONAL);
        }
    }

    return eligibleRoles;
}

// ============ إعطاء الرول المؤقت ============

async function assignTempRole(client, member, roleData, originalMessage, settings) {
    //console.log(`🎁 Assigning ${roleData.name} to ${member.user.tag}...`);

    try {
        const tempRole = originalMessage.guild.roles.cache.get(roleData.roleId);
        if (!tempRole) {
            console.log(`❌ Role with ID ${roleData.roleId} not found`);
            return false;
        }

        // التحقق إذا كان العضو لديه الرول بالفعل
        if (member.roles.cache.has(tempRole.id)) {
            //console.log(`ℹ️ ${member.user.tag} already has ${roleData.name}, skipping...`);
            return false;
        }

        // إعطاء الرول
        await member.roles.add(tempRole);
        //console.log(`✅ ${roleData.name} added to ${member.user.tag}`);

        // جدولة الإزالة
        await scheduleTempRoleRemoval(client, member, tempRole, originalMessage, settings.duration, roleData.name);

        return true;

    } catch (error) {
        console.error(`❌ Error assigning ${roleData.name} to ${member.user.tag}:`, error);
        return false;
    }
}

// ============ إزالة جميع الرولات المؤقتة ============

async function removeAllTempRoles(client, member, originalMessage, settings) {
    //console.log(`🗑️ Removing all temp roles from ${member.user.tag} due to refund...`);

    try {
        const removedRoles = [];

        // إزالة الرول العام
        if (settings.tempRoles.GENERAL) {
            const removed = await removeSingleTempRole(client, member, settings.tempRoles.GENERAL, originalMessage);
            if (removed) {
                removedRoles.push(settings.tempRoles.GENERAL);
            }
        }

        // إزالة الرول المشروط
        if (settings.tempRoles.CONDITIONAL) {
            const removed = await removeSingleTempRole(client, member, settings.tempRoles.CONDITIONAL, originalMessage);
            if (removed) {
                removedRoles.push(settings.tempRoles.CONDITIONAL);
            }
        }

        // إرسال إيمبد واحد يضم كل الرولات المزالة
        if (removedRoles.length > 0) {
            await sendCombinedRefundAnnouncement(client, member, removedRoles, originalMessage);
        }

    } catch (error) {
        console.error(`❌ Error removing temp roles from ${member.user.tag}:`, error);
    }
}

async function removeSingleTempRole(client, member, roleData, originalMessage) {
    try {
        const tempRole = originalMessage.guild.roles.cache.get(roleData.roleId);
        if (!tempRole) {
            console.log(`❌ Role with ID ${roleData.roleId} not found`);
            return false;
        }

        if (!member.roles.cache.has(tempRole.id)) {
            //console.log(`ℹ️ ${member.user.tag} doesn't have ${roleData.name}, skipping...`);
            return false;
        }

        // إزالة الرول
        await member.roles.remove(tempRole);
        //console.log(`✅ ${roleData.name} removed from ${member.user.tag}`);

        // إلغاء الجدولة من الداتابيز
        await cancelScheduledRemoval(client, member.id, tempRole.id, originalMessage.guild.id);

        return true;

    } catch (error) {
        console.error(`❌ Error removing ${roleData.name} from ${member.user.tag}:`, error);
        return false;
    }
}

// ============ الإشعارات المجمعة ============

async function sendCombinedAnnouncement(client, member, assignedRoles, originalMessage, duration, type) {
    try {
        const guild = originalMessage.guild;
        const durationText = formatDurationText(duration);
        const expiresTimestamp = Math.floor((Date.now() + parseDuration(duration)) / 1000);

        // بناء وصف يضم كل الرولات المعطاة
        const rolesList = assignedRoles.map(role => {
            const roleObj = guild.roles.cache.get(role.roleId);
            return roleObj ? `${roleObj}` : role.name;
        }).join(', ');

        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('🎟️ **SkyPass Role/s Assigned**')
            .setImage(process.env.BlueLine)
            .setDescription(`${member} has been assigned the following roles`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Auto SkyPass System | ${guild.name}`, 
                iconURL: guild.iconURL() 
            });

        // إضافة فيلد منفصل لكل رول في البداية
        assignedRoles.forEach(role => {
            const roleObj = guild.roles.cache.get(role.roleId);
            if (roleObj) {
                embed.addFields({ 
                    name: role.name, 
                    value: `${roleObj}`, 
                    inline: true 
                });
            }
        });

        // إضافة باقي الفيلدات بعد الرولات
        embed.addFields(
            { name: 'Duration', value: `**${durationText}**`, inline: true },
            { name: 'Expires', value: `<t:${expiresTimestamp}:F>`, inline: false }
        );

        await sendToCommunityChannel(client, guild, embed, member, 'purchase');

    } catch (error) {
        console.error('❌ Error sending combined announcement:', error);
    }
}

async function sendCombinedRefundAnnouncement(client, member, removedRoles, originalMessage) {
    try {
        const guild = originalMessage.guild;

        // بناء وصف يضم كل الرولات المزالة
        const rolesList = removedRoles.map(role => {
            const roleObj = guild.roles.cache.get(role.roleId);
            return roleObj ? `${roleObj}` : role.name;
        }).join(', ');

        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('🎟️ **SkyPass Roles Refunded**')
            .setImage(process.env.RedLine)
            .setDescription(`${member} **(Refunded)** the following roles:\n${rolesList}`)
            .addFields(
                { name: 'Removed Roles', value: rolesList, inline: false },
                { name: 'Reason', value: '**Refund Processed**', inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Auto SkyPass System | ${guild.name}`, 
                iconURL: guild.iconURL() 
            });

        await sendToCommunityChannel(client, guild, embed, member, 'refund');

    } catch (error) {
        console.error('❌ Error sending combined refund announcement:', error);
    }
}

// ============ إشعار عدم وجود الرول المستهدف ============

async function notifyNoTargetRole(client, member, originalMessage) {
    try {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⚠️ **Role Assignment Failed**')
            .setDescription(`${member}, You don't have the required role to receive SkyPass.`)
            .addFields(
                { name: 'Status', value: '❌ **Cannot Assign SkyPass**', inline: true },
                { name: 'Reason', value: 'Missing required purchase role', inline: true }
            )
            .setFooter({ 
                text: `Auto SkyPass System | ${originalMessage.guild.name}`, 
                iconURL: originalMessage.guild.iconURL() 
            });

        await sendToCommunityChannel(client, originalMessage.guild, embed, member, 'warning');

        console.log(`⚠️ Notified ${member.user.tag} about missing target role`);

    } catch (error) {
        console.error('❌ Error sending missing role notification:', error);
    }
}

// ============ باقي الدوال (تبقى كما هي بدون تغيير) ============

async function extractPurchaseData(message, targetRoleIds) {
    if (!message.embeds || message.embeds.length === 0) {
        console.log('❌ No embeds found in message');
        return null;
    }

    const embed = message.embeds[0];

    if (embed.description) {
        const userMatch = embed.description.match(/<@!?(\d+)>/);

        let purchasedRoleId = null;
        for (const roleId of targetRoleIds) {
            if (embed.description.includes(roleId)) {
                purchasedRoleId = roleId;
                break;
            }
        }

        if (userMatch && purchasedRoleId) {
            const userId = userMatch[1];
            const user = message.client.users.cache.get(userId);

            if (user) {
                const role = message.guild.roles.cache.get(purchasedRoleId);
                const roleName = role ? role.name : `Role (${purchasedRoleId})`;

                return {
                    user: user,
                    roleId: purchasedRoleId,
                    roleName: roleName
                };
            } else {
                console.log(`❌ User not found in cache: ${userId}`);
                try {
                    const member = await message.guild.members.fetch(userId);
                    if (member) {
                        const role = message.guild.roles.cache.get(purchasedRoleId);
                        const roleName = role ? role.name : `Role (${purchasedRoleId})`;

                        return {
                            user: member.user,
                            roleId: purchasedRoleId,
                            roleName: roleName
                        };
                    }
                } catch (fetchError) {
                    console.log(`❌ Error fetching member: ${fetchError.message}`);
                }
            }
        }
    }

    console.log('❌ Could not extract purchase data from embed');
    return null;
}

async function extractRefundData(message, targetRoleIds) {
    if (!message.embeds || message.embeds.length === 0) {
        console.log('❌ No embeds found in message');
        return null;
    }

    const embed = message.embeds[0];

    if (embed.description) {
        const userMatch = embed.description.match(/<@!?(\d+)>/);

        let refundedRoleId = null;
        for (const roleId of targetRoleIds) {
            if (embed.description.includes(roleId)) {
                refundedRoleId = roleId;
                break;
            }
        }

        if (userMatch && refundedRoleId) {
            const userId = userMatch[1];
            const user = message.client.users.cache.get(userId);

            if (user) {
                const role = message.guild.roles.cache.get(refundedRoleId);
                const roleName = role ? role.name : `Role (${refundedRoleId})`;

                return {
                    user: user,
                    roleId: refundedRoleId,
                    roleName: roleName
                };
            } else {
                console.log(`❌ User not found in cache: ${userId}`);
                try {
                    const member = await message.guild.members.fetch(userId);
                    if (member) {
                        const role = message.guild.roles.cache.get(refundedRoleId);
                        const roleName = role ? role.name : `Role (${refundedRoleId})`;

                        return {
                            user: member.user,
                            roleId: refundedRoleId,
                            roleName: roleName
                        };
                    }
                } catch (fetchError) {
                    console.log(`❌ Error fetching member: ${fetchError.message}`);
                }
            }
        }
    }

    console.log('❌ Could not extract refund data from embed');
    return null;
}

async function scheduleTempRoleRemoval(client, member, tempRole, originalMessage, duration, roleName) {
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
            userId: member.id,
            userName: member.user.tag,
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
            member.id, 
            tempRole.id, 
            originalMessage.guild.id, 
            expiresAt, 
            duration, 
            client.user.id, 
            null, 
            originalMessage.channelId
        );

        //console.log(`✅ ${roleName} scheduled for removal in ${duration} for ${member.user.tag}`);

    } catch (error) {
        console.error('❌ Error scheduling role removal:', error);
    }
}

async function cancelScheduledRemoval(client, userId, roleId, guildId) {
    try {
        await client.dbManager.run(
            'DELETE FROM temp_roles WHERE user_id = ? AND role_id = ? AND guild_id = ?',
            [userId, roleId, guildId]
        );

        //console.log(`✅ Cancelled scheduled removal for user ${userId}`);

    } catch (error) {
        console.error('❌ Error cancelling scheduled removal:', error);
    }
}

async function sendToCommunityChannel(client, guild, embed, member, type) {
    try {
        let communityCommandsChannel = null;

        if (client.logChannels && client.logChannels[guild.id]) {
            const guildChannels = client.logChannels[guild.id];
            if (guildChannels.communitycommands) {
                communityCommandsChannel = guild.channels.cache.get(guildChannels.communitycommands.id);
            }
        }

        if (communityCommandsChannel) {
            await communityCommandsChannel.send({ embeds: [embed] });
            //console.log(`✅ ${type} announcement sent in community commands channel for ${member.user.tag}`);
        } else {
            console.log(`❌ No community commands channel found for ${type} announcement`);
        }

    } catch (error) {
        console.error(`❌ Error sending ${type} announcement:`, error);
    }
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

    return duration;
}

function parseDuration(duration) {
    try {
        const parseDuration = require('../System/durationParser');
        return parseDuration(duration);
    } catch (error) {
        console.error('❌ Error parsing duration:', error);
        return 7 * 24 * 60 * 60 * 1000;
    }
}

async function findMember(guild, user) {
    try {
        return await guild.members.fetch(user.id);
    } catch (error) {
        console.log(`❌ Error finding member ${user.tag}:`, error.message);
        return null;
    }
}

module.exports = { execute };