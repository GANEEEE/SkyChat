const { EmbedBuilder } = require('discord.js');

const CHAT_REWARDS_SETTINGS = {
    CHAT_REWARDS_BOT_ID: '1261512844948803710',
    TARGET_ROLE_IDS: [
        '1417641311422382171' // Sky break role ID
    ],
    ALLOWED_CHANNEL_IDS: [
        '1434904222805004411'
    ],
    // Role settings
    CHAMPION_REST_ROLE_ID: '1394820353775112212' // champion rest role ID
};

// Variable to store timers and message references
const pendingRefunds = new Map();

async function execute(message, client) {
    if (!isValidMessage(message)) {
        console.log(`❌ Message validation failed`);
        return;
    }

    //console.log(`🎯 === CHAT REWARDS BOT DETECTED ===`);

    const settings = getChatRewardsSettings();
    if (!settings) {
        console.log(`❌ Failed to load settings`);
        return;
    }

    if (!isAllowedChannel(message, settings.allowedChannels)) {
        return;
    }

    // Extract data once and use it for both checks
    const extractedData = await extractData(message, settings.targetRoleIds);

    if (!extractedData) {
        console.log('❌ No valid data found in embed');
        //console.log(`🎯 === END CHAT REWARDS MESSAGE ===`);
        return;
    }

    //console.log(`👥 USER: ${extractedData.user.tag}`);
    //console.log(`🎯 Role: ${extractedData.roleName}`);

    if (isPurchaseMessage(message)) {
        //console.log(`📊 State: Purchased`);
        await handleRolePurchase(message, client, settings, extractedData);
    } else if (isRefundMessage(message)) {
        //console.log(`📊 State: Refunded`);
        await handleRoleRefund(message, client, settings, extractedData);
    } else {
        console.log(`❌ Not a purchase or refund message`);
    }

    //console.log(`🎯 === END CHAT REWARDS MESSAGE ===`);
}

// ============ Helper Functions ============

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
            allowedChannels: CHAT_REWARDS_SETTINGS.ALLOWED_CHANNEL_IDS,
            targetRoleIds: CHAT_REWARDS_SETTINGS.TARGET_ROLE_IDS,
            championRestRoleId: CHAT_REWARDS_SETTINGS.CHAMPION_REST_ROLE_ID,
            skyBreakRoleId: CHAT_REWARDS_SETTINGS.TARGET_ROLE_IDS[0]
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
             /✅.*purchased|✅.*bought/i.test(embed.description));
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
             embed.description.includes('cancel') ||
             /🔄.*refund|❌.*cancel/i.test(embed.description));
        return isRefund;
    }

    return false;
}

// ============ Unified Data Extraction Function ============

async function extractData(message, targetRoleIds) {
    if (!message.embeds || message.embeds.length === 0) {
        console.log('❌ No embeds found in message');
        return null;
    }

    const embed = message.embeds[0];
    //console.log(`🔍 Embed description: ${embed.description}`);

    if (!embed.description) {
        console.log('❌ No description in embed');
        return null;
    }

    const userMatch = embed.description.match(/<@!?(\d+)>/);
    //console.log(`🔍 User match: ${userMatch ? userMatch[1] : 'NOT FOUND'}`);

    if (!userMatch) {
        console.log('❌ Could not find user mention in embed');
        return null;
    }

    let roleId = null;

    // Search for target roles in description
    for (const targetRoleId of targetRoleIds) {
        if (embed.description.includes(targetRoleId)) {
            roleId = targetRoleId;
            //console.log(`✅ Found role ID in description: ${roleId}`);
            break;
        }
    }

    // If not found in description, try fields
    if (!roleId && embed.fields && embed.fields.length > 0) {
        for (const field of embed.fields) {
            for (const targetRoleId of targetRoleIds) {
                if (field.value && field.value.includes(targetRoleId)) {
                    roleId = targetRoleId;
                    //console.log(`✅ Found role ID in field: ${roleId}`);
                    break;
                }
            }
            if (roleId) break;
        }
    }

    // If still not found, try title
    if (!roleId && embed.title) {
        for (const targetRoleId of targetRoleIds) {
            if (embed.title.includes(targetRoleId)) {
                roleId = targetRoleId;
                //console.log(`✅ Found role ID in title: ${roleId}`);
                break;
            }
        }
    }

    if (!roleId) {
        console.log('❌ Could not find target role ID in embed');
        return null;
    }

    const userId = userMatch[1];
    //console.log(`🔍 Extracted user ID: ${userId}`);

    // Try to find user
    let user = message.client.users.cache.get(userId);

    if (!user) {
        try {
            //console.log(`🔍 Fetching user ${userId} from API...`);
            user = await message.client.users.fetch(userId);
        } catch (fetchError) {
            console.log(`❌ Error fetching user: ${fetchError.message}`);
            return null;
        }
    }

    if (!user) {
        console.log(`❌ User not found for ID: ${userId}`);
        return null;
    }

    const role = message.guild.roles.cache.get(roleId);
    const roleName = role ? role.name : `Role (${roleId})`;

    //console.log(`✅ Successfully extracted data - User: ${user.tag}, Role: ${roleName}`);

    return {
        user: user,
        roleId: roleId,
        roleName: roleName
    };
}

// ============ Champion Rest Check Function ============

async function hasChampionRestRole(member, championRestRoleId) {
    try {
        if (!championRestRoleId || championRestRoleId === 'ID_HERE') {
            //console.log('⚠️ Champion rest role ID not configured');
            return false;
        }

        const hasRole = member.roles.cache.has(championRestRoleId);
        //console.log(`🔍 Champion rest check for ${member.user.tag}: ${hasRole ? '✅ HAS ROLE' : '❌ NO ROLE'}`);
        return hasRole;
    } catch (error) {
        console.error('❌ Error checking champion rest role:', error);
        return false;
    }
}

// ============ Get Community Commands Channel ============

async function getCommunityCommandsChannel(client, guildId) {
    try {
        // Check if logChannels exists in client
        if (!client.logChannels) {
            console.log('❌ client.logChannels not initialized');
            return null;
        }

        // Get guild channels
        const guildChannels = client.logChannels[guildId];
        if (!guildChannels) {
            console.log(`❌ No log channels found for guild ${guildId}`);
            return null;
        }

        // Get community commands channel
        const communityChannel = guildChannels.communitycommands;
        if (!communityChannel) {
            console.log(`❌ No community commands channel found for guild ${guildId}`);
            return null;
        }

        // Get the actual channel object
        const channel = await client.channels.fetch(communityChannel.id);
        if (!channel) {
            console.log(`❌ Could not fetch community commands channel ${communityChannel.id}`);
            return null;
        }

        //console.log(`✅ Found community commands channel: ${channel.name}`);
        return channel;

    } catch (error) {
        console.error('❌ Error getting community commands channel:', error);
        return null;
    }
}

// ============ Send and Manage Warning Message ============

async function sendWarningMessage(client, guild, member) {
    try {
        const communityChannel = await getCommunityCommandsChannel(client, guild.id);
        if (!communityChannel) {
            console.log('❌ Could not send warning message - no community commands channel');
            return null;
        }

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`**${member.user.tag} Doesn't have ChampionRest**`)
            .setImage(process.env.OrangeLine)
            .setDescription(`**Purchased Sky Break without Champion Rest!**\n\n• 60 seconds to get Champion Rest\n• Auto Champion Rest for 7 days if not\n• Required for server balance\n\n**Refund now if mistake**`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Auto SkyBreak Roles | ${guild.name}`, 
                iconURL: guild.iconURL() 
            });

        const warningMessage = await communityChannel.send({ embeds: [embed] });
        //console.log(`✅ Warning message sent for ${member.user.tag}`);

        return warningMessage;

    } catch (error) {
        console.error('❌ Error sending warning message:', error);
        return null;
    }
}

async function updateWarningToChampionRest(message, member) {
    try {
        // استخدم guild من الـ message
        const guild = message.guild;

        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('<:Alarm:1429538046986158220> **Champion Rest Assigned**')
            .setImage(process.env.BlueLine)
            .setDescription(`${member} assigned <@&1394820353775112212> because didn't refund SkyBreak in time (60s)`)
            .addFields(
                { name: 'Assigned Role', value: `<@&1394820353775112212>`, inline: true },
                { name: 'Duration', value: `**2 Weeks**`, inline: true },
                { name: 'Expires', value: `<t:${Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000)}:F>`, inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Auto SkyBreak Roles | ${guild.name}`, 
                iconURL: guild.iconURL() 
            });

        await message.edit({ embeds: [embed] });
        //console.log(`✅ Warning message updated to Champion Rest for ${member.user.tag}`);

    } catch (error) {
        console.error('❌ Error updating warning message:', error);
    }
}

async function updateWarningToRefund(message, member) {
    try {
        // استخدم guild من الـ message
        const guild = message.guild;

        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('**Refund Processed**')
            .setImage(process.env.BlueLine)
            .setDescription(`${member} **refunded SkyBreak**`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true}))
            .setFooter({ 
                text: `Auto SkyBreak Roles | ${guild.name}`, 
                iconURL: guild.iconURL() 
            });

        await message.edit({ embeds: [embed] });
        //console.log(`✅ Warning message updated to Refund for ${member.user.tag}`);

    } catch (error) {
        console.error('❌ Error updating warning message to refund:', error);
    }
}

// ============ Simple Community Embeds (for other cases) ============

async function sendChampionRestRemovedEmbed(client, guild, member) {
    try {
        const communityChannel = await getCommunityCommandsChannel(client, guild.id);
        if (!communityChannel) {
            console.log('❌ Could not send embed - no community commands channel');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('🐦‍🔥 **ChampionRest Removed**')
            .setImage(process.env.BlueLine)
            .setDescription(`${member} **Champion Rest removed**`)
            .addFields(
                { name: 'State', value: ' **Sky Break purchase complete**', inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true}))
            .setFooter({ 
                text: `Auto SkyBreak RoLes | ${guild.name}`, 
                iconURL: guild.iconURL() 
            });

        await communityChannel.send({ embeds: [embed] });
        //console.log(`✅ Champion Rest removed embed sent for ${member.user.tag}`);

    } catch (error) {
        console.error('❌ Error sending champion rest removed embed:', error);
    }
}

async function sendRefundWithRestEmbed(client, guild, member) {
    try {
        const communityChannel = await getCommunityCommandsChannel(client, guild.id);
        if (!communityChannel) {
            console.log('❌ Could not send embed - no community commands channel');
            return;
        }

        const embed = new EmbedBuilder()
            .setColor('#0073ff')
            .setTitle('<:Alarm:1429538046986158220> **Champion Rest Assigned**')
            .setImage(process.env.BlueLine)
            .setDescription(`${member} assigned <@&1394820353775112212>`)
            .addFields(
                { name: 'Assigned Role', value: `<@&1394820353775112212>`, inline: true },
                { name: 'Duration', value: `**2 Weeks**`, inline: true },
                { name: 'Expires', value: `<t:${Math.floor((Date.now() + 14 * 24 * 60 * 60 * 1000) / 1000)}:F>`, inline: false }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ 
                text: `Auto SkyBreak Roles | ${guild.name}`, 
                iconURL: guild.iconURL() 
            });

        await communityChannel.send({ embeds: [embed] });
        //console.log(`✅ Refund with rest embed sent for ${member.user.tag}`);

    } catch (error) {
        console.error('❌ Error sending refund with rest embed:', error);
    }
}

// ============ Role Purchase Handling ============

async function handleRolePurchase(message, client, settings, purchaseData) {
    try {
        //console.log(`🎯 Processing purchase - User: ${purchaseData.user.tag}, Role: ${purchaseData.roleName}`);

        const buyerMember = await findMember(message.guild, purchaseData.user);
        if (!buyerMember) {
            console.log(`❌ Member ${purchaseData.user.tag} not found in guild`);
            return;
        }

        // Check if purchased role is Sky break
        const isSkyBreakPurchase = purchaseData.roleId === settings.skyBreakRoleId;

        if (isSkyBreakPurchase) {
            // Check for champion rest
            const hasChampionRest = await hasChampionRestRole(buyerMember, settings.championRestRoleId);

            if (!hasChampionRest) {
                //console.log(`⚠️ User ${buyerMember.user.tag} purchased Sky break without champion rest`);

                // Send warning message and store reference
                const warningMessage = await sendWarningMessage(client, message.guild, buyerMember);

                await handlePurchaseWithoutChampionRest(client, buyerMember, message, settings, warningMessage);
                return;
            } else {
                // If has champion rest, remove it and send community embed
                //console.log(`✅ User ${buyerMember.user.tag} has champion rest - removing it`);
                await sendChampionRestRemovedEmbed(client, message.guild, buyerMember);
                await removeChampionRestRole(client, buyerMember, settings.championRestRoleId);
            }
        }

    } catch (error) {
        console.error('💥 Error in handleRolePurchase:', error);
    }
}

// ============ Purchase Without Champion Rest Handling ============

async function handlePurchaseWithoutChampionRest(client, member, message, settings, warningMessage) {
    try {
        // Store pending refund data with message reference
        const refundData = {
            member: member,
            settings: settings,
            client: client,
            originalMessage: message,
            guild: message.guild,
            warningMessage: warningMessage,
            timerActive: true
        };

        // Start 60 second timer
        const timer = setTimeout(async () => {
            await processAutoChampionRest(member.id, client);
        }, 60000);

        // Save timer in data
        refundData.timer = timer;
        pendingRefunds.set(member.id, refundData);

        //console.log(`⏰ Started 60s timer for ${member.user.tag}`);

    } catch (error) {
        console.error('❌ Error in handlePurchaseWithoutChampionRest:', error);
    }
}

// ============ Auto Champion Rest Processing ============

async function processAutoChampionRest(memberId, client) {
    try {
        const refundData = pendingRefunds.get(memberId);
        if (!refundData) {
            console.log(`❌ No pending refund data for member ${memberId}`);
            return;
        }

        const { member, settings, guild, warningMessage } = refundData;

        // Check if timer is still active (not cancelled)
        if (!refundData.timerActive) {
            //console.log(`✅ Timer was cancelled for ${member.user.tag}`);
            return;
        }

        // Check if user still has the role
        const currentMember = await guild.members.fetch(memberId);
        const hasSkyBreak = currentMember.roles.cache.has(settings.skyBreakRoleId);

        if (hasSkyBreak && warningMessage) {
            // If still has role after timer, update warning message and give champion rest
            //console.log(`✅ Giving champion rest to ${currentMember.user.tag} (auto after 60s)`);
            await updateWarningToChampionRest(warningMessage, currentMember);
            await giveChampionRestRole(client, currentMember, settings.championRestRoleId, refundData.originalMessage);
        }

        // Clear data from memory
        pendingRefunds.delete(memberId);

    } catch (error) {
        console.error('❌ Error in processAutoChampionRest:', error);
    }
}

// ============ Cancel Timer on Refund ============

async function cancelPendingTimer(memberId) {
    try {
        const refundData = pendingRefunds.get(memberId);
        if (!refundData) {
            return false;
        }

        // Cancel timer
        if (refundData.timer) {
            clearTimeout(refundData.timer);
        }

        // Disable timer
        refundData.timerActive = false;
        pendingRefunds.set(memberId, refundData);

        //console.log(`✅ Cancelled timer for member ${memberId}`);
        return true;

    } catch (error) {
        console.error('❌ Error cancelling timer:', error);
        return false;
    }
}

// ============ Refund Handling ============

async function handleRoleRefund(message, client, settings, refundData) {
    try {
        //console.log(`🎯 Processing refund - User: ${refundData.user.tag}, Role: ${refundData.roleName}`);

        const userMember = await findMember(message.guild, refundData.user);
        if (!userMember) {
            console.log(`❌ Member ${refundData.user.tag} not found in guild`);
            return;
        }

        // If there's an active timer for user, cancel it and update message
        const refundDataFromMap = pendingRefunds.get(userMember.id);

        if (refundDataFromMap && refundDataFromMap.warningMessage) {
            //console.log(`✅ Cancelled pending timer for ${userMember.user.tag} - updating message`);
            await updateWarningToRefund(refundDataFromMap.warningMessage, userMember);
            await cancelPendingTimer(userMember.id);
        } else {
            // If no timer (either expired or never started)
            // Give champion rest for 7 days
            //console.log(`✅ Giving champion rest to ${userMember.user.tag} (refund after timer)`);
            await sendRefundWithRestEmbed(client, message.guild, userMember);
            await giveChampionRestRole(client, userMember, settings.championRestRoleId, message);
        }

        // Clear data from memory
        pendingRefunds.delete(userMember.id);

    } catch (error) {
        console.error('💥 Error in handleRoleRefund:', error);
    }
}

// ============ Give Champion Rest Role ============

async function giveChampionRestRole(client, member, championRestRoleId, originalMessage) {
    try {
        const championRestRole = originalMessage.guild.roles.cache.get(championRestRoleId);
        if (!championRestRole) {
            console.log(`❌ Champion rest role with ID ${championRestRoleId} not found`);
            return;
        }

        // Give the role
        await member.roles.add(championRestRole);
        //console.log(`✅ Added champion rest role to ${member.user.tag}`);

        // Schedule role removal after 7 days
        await scheduleChampionRestRemoval(client, member, championRestRole, originalMessage);

    } catch (error) {
        console.error(`❌ Error giving champion rest role to ${member.user.tag}:`, error);
    }
}

// ============ Remove Champion Rest Role ============

async function removeChampionRestRole(client, member, championRestRoleId) {
    try {
        const championRestRole = member.guild.roles.cache.get(championRestRoleId);
        if (!championRestRole) {
            console.log(`❌ Champion rest role with ID ${championRestRoleId} not found`);
            return;
        }

        // Remove the role
        await member.roles.remove(championRestRole);
        //console.log(`✅ Removed champion rest role from ${member.user.tag}`);

        // Cancel scheduling from database
        await cancelChampionRestScheduledRemoval(client, member.id, championRestRoleId, member.guild.id);

    } catch (error) {
        console.error(`❌ Error removing champion rest role from ${member.user.tag}:`, error);
    }
}

// ============ Schedule Champion Rest Removal ============

async function scheduleChampionRestRemoval(client, member, championRestRole, originalMessage) {
    try {
        const duration = '2w'; // 2 Weeks
        const parseDuration = require('../System/durationParser');
        const durationMs = parseDuration(duration);

        if (!durationMs) {
            console.log('❌ Invalid duration format');
            return;
        }

        const expiresAt = new Date(Date.now() + durationMs);

        const tempRoleData = {
            userId: member.id,
            userName: member.user.tag,
            roleId: championRestRole.id,
            roleName: championRestRole.name,
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

        const { scheduleRoleRemoval } = require('../Commands/5 temprole');
        scheduleRoleRemoval(
            client, 
            member.id, 
            championRestRole.id, 
            originalMessage.guild.id, 
            expiresAt, 
            duration, 
            client.user.id, 
            null, 
            originalMessage.channelId
        );

        //console.log(`✅ Scheduled champion rest removal for ${member.user.tag} after 7 days`);

    } catch (error) {
        console.error('❌ Error scheduling champion rest removal:', error);
    }
}

// ============ Cancel Champion Rest Scheduling ============

async function cancelChampionRestScheduledRemoval(client, userId, roleId, guildId) {
    try {
        await client.dbManager.run(
            'DELETE FROM temp_roles WHERE user_id = ? AND role_id = ? AND guild_id = ?',
            [userId, roleId, guildId]
        );
        //console.log(`✅ Cancelled champion rest scheduled removal for user ${userId}`);
    } catch (error) {
        console.error('❌ Error cancelling champion rest scheduled removal:', error);
    }
}

// ============ Helper Functions ============

async function findMember(guild, user) {
    try {
        return await guild.members.fetch(user.id);
    } catch (error) {
        console.log(`❌ Error finding member ${user.tag}:`, error.message);
        return null;
    }
}

module.exports = { execute };