const { EmbedBuilder } = require('discord.js');

// تعريفات الرتب حسب عدد الرسائل
const MESSAGES_ROLES_CONFIG = {
    ROLE_250_MESSAGES: {
        id: '1453692596785254480',
        minMessages: 50,
        name: '50+ Messages',
        title: 'Voice Access Role Granted',
        description: 'Voice role has been granted',
        color: process.env.Bluecolor // لون أخضر لرتبة 250
    },
    ROLE_500_MESSAGES: {
        id: '1450288685126914128',
        minMessages: 500,
        name: '500+ Messages',
        title: 'Media Access Role Granted',
        description: 'Media access role has been granted',
        color: process.env.Bluecolor // لون برتقالي لرتبة 500
    }
};

// دالة للتحقق من رتب الرسائل لكل مستخدم
async function checkMessagesRoles(client, userId) {
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.log('❌ Server not found');
            return false;
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) {
            console.log('❌ Member not found');
            return false;
        }

        // جلب عدد الرسائل الإجمالي من قاعدة البيانات
        const messagesData = await client.dbManager.get(
            'SELECT total FROM message_stats WHERE user_id = ?',
            [userId]
        );

        if (!messagesData || !messagesData.total) {
            return false;
        }

        const totalMessages = messagesData.total;
        let rolesGranted = [];

        // معالجة كل رتبة من الرتب المحددة
        for (const [roleKey, roleInfo] of Object.entries(MESSAGES_ROLES_CONFIG)) {
            if (!roleInfo.id || roleInfo.id === '') {
                console.log(`⚠️ Role ID not set for ${roleKey}`);
                continue;
            }

            const hasRole = member.roles.cache.has(roleInfo.id);

            // منح الرتبة فقط إذا كان مؤهلاً لها وليس لديهها بالفعل
            if (totalMessages >= roleInfo.minMessages && !hasRole) {
                const role = guild.roles.cache.get(roleInfo.id);
                if (!role) {
                    console.log(`❌ Role not found with the ID: ${roleInfo.id}`);
                    continue;
                }

                try {
                    await member.roles.add(role);
                    console.log(`🎉 Messages role added "${role.name}" to ${member.user.tag} (${totalMessages} messages)`);

                    // تخزين معلومات الرتبة الممنوحة
                    rolesGranted.push({
                        role: role,
                        roleInfo: roleInfo,
                        totalMessages: totalMessages
                    });

                } catch (err) {
                    console.error('⚠️ Failed to grant messages role:', err.message);
                }
            }
        }

        // إرسال إيمبد منفصل لكل رتبة تم منحها
        if (rolesGranted.length > 0) {
            for (const grantedRole of rolesGranted) {
                await sendMessagesRoleGrantedLog(client, guild, member, grantedRole);
            }
        }

        return rolesGranted.length > 0;
    } catch (error) {
        console.error(`❌ Error in checkMessagesRoles for user ${userId}:`, error);
        return false;
    }
}

// دالة لإرسال سجلات منح رتب الرسائل مع إيمبد منفصل لكل حالة
async function sendMessagesRoleGrantedLog(client, guild, member, grantedRole) {
    try {
        // جلب قناة اللوجات من قاعدة البيانات
        const logChannels = await client.dbManager.all(
            'SELECT * FROM log_channels WHERE guild_id = ? AND channel_type IN (?, ?, ?)',
            [guild.id, 'communitycommands', 'messages', 'general']
        );

        let logChannel = null;

        // البحث عن قناة مناسبة
        for (const channelType of ['communitycommands', 'messages', 'general']) {
            const channelData = logChannels.find(c => c.channel_type === channelType);
            if (channelData) {
                logChannel = await client.channels.fetch(channelData.channel_id).catch(() => null);
                if (logChannel) break;
            }
        }

        if (!logChannel) {
            const systemChannel = guild.systemChannel;
            if (systemChannel) {
                logChannel = systemChannel;
            }
        }

        if (logChannel) {
            const embed = createRoleEmbed(grantedRole.roleInfo, member, grantedRole.totalMessages, grantedRole.role, guild);
            await logChannel.send({ embeds: [embed] });
            console.log(`📢 ${grantedRole.roleInfo.name} notification sent in ${logChannel.name}`);
        }
    } catch (error) {
        console.error('Error sending messages role granted log:', error);
    }
}

// دالة لإنشاء إيمبد مخصص لكل نوع رتبة
function createRoleEmbed(roleInfo, member, totalMessages, role, guild) {
    const embed = new EmbedBuilder();

    // تعيين اللون بناءً على الرتبة
    const embedColor = roleInfo.color || (roleInfo.minMessages === 250 ? '#00FF00' : '#FFA500');

    // تعيين العنوان بناءً على الرتبة
    const embedTitle = roleInfo.title || `${roleInfo.minMessages}+ Messages Role`;

    // تعيين الوصف بناءً على الرتبة
    const embedDescription = roleInfo.description || `${role} has been granted to ${member}`;

    // إيمبد لرتبة 250 رسالة (Voice Role)
    if (roleInfo.minMessages === 50) {
        embed
            .setColor(embedColor)
            .setTitle(`<:Bell:1416158884942446682> ${embedTitle}`)
            //.setDescription(embedDescription)
            .setImage(process.env.BlueLine || '')
            .addFields(
                { 
                    name: 'Granted Role', 
                    value: `${role}`, 
                    inline: true 
                },
                { 
                    name: 'Member', 
                    value: `${member}`, 
                    inline: true 
                },
                { 
                    name: 'Milestone', 
                    value: '**50 Messages Milestone Unlocked!**', 
                    inline: false 
                }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ 
                text: `Voice Access System | ${guild.name}`,
                iconURL: guild.iconURL()
            })
    }
    // إيمبد لرتبة 500 رسالة (Media Access)
    else if (roleInfo.minMessages === 500) {
        embed
            .setColor(embedColor)
            .setTitle(`<:Bell:1416158884942446682> ${embedTitle}`)
            //.setDescription(embedDescription)
            .setImage(process.env.BlueLine || '')
            .addFields(
                { 
                    name: 'Granted Role', 
                    value: `${role}`, 
                    inline: true 
                },
                { 
                    name: 'Member', 
                    value: `${member}`, 
                    inline: true 
                },
                { 
                    name: 'Milestone', 
                    value: '**500 Messages Milestone Unlocked!**', 
                    inline: false 
                }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ 
                text: `Media Access System | ${new Date().toLocaleDateString()}`,
                iconURL: guild.iconURL()
            })
    }
    // إيمبد عام للرتب الأخرى (إذا أضفت رتب أكثر في المستقبل)
    else {
        embed
            .setColor(embedColor)
            .setTitle(`<:Bell:1416158884942446682> ${embedTitle}`)
            //.setDescription(embedDescription)
            .setImage(process.env.BlueLine || '')
            .addFields(
                { 
                    name: 'Granted Role', 
                    value: `${role}`, 
                    inline: true 
                },
                { 
                    name: 'Member', 
                    value: `${member}`, 
                    inline: true 
                },
                { 
                    name: 'Required Messages', 
                    value: roleInfo.minMessages.toString(), 
                    inline: false 
                }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setFooter({ 
                text: `Auto Role System | ${guild.name}`,
                iconURL: guild.iconURL()
            })
    }

    return embed;
}

// دالة للتحقق من جميع الأعضاء بشكل دوري بناءً على الرسائل
async function checkAllMembersMessagesRoles(client) {
    try {
        console.log('🔄 Starting periodic messages role check for all members...');

        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) {
            console.log('❌ GUILD_ID not set or invalid');
            return;
        }

        const allUsers = await client.dbManager.all(
            'SELECT user_id, total FROM message_stats WHERE total >= ?',
            [MESSAGES_ROLES_CONFIG.ROLE_250_MESSAGES.minMessages]
        );

        console.log(`📊 Found ${allUsers.length} users with ${MESSAGES_ROLES_CONFIG.ROLE_250_MESSAGES.minMessages}+ messages to check`);

        let checked = 0;
        let granted = 0;
        let skipped = 0;

        for (const userData of allUsers) {
            try {
                const member = await guild.members.fetch(userData.user_id).catch(() => null);
                if (!member) {
                    skipped++;
                    continue;
                }

                const roleGranted = await checkMessagesRoles(client, userData.user_id);

                if (roleGranted) {
                    granted++;
                }
                checked++;

                // تأخير 50ms لتجنب rate limits
                await new Promise(resolve => setTimeout(resolve, 50));

            } catch (error) {
                console.error(`Error checking messages roles for user ${userData.user_id}:`, error);
            }
        }

        console.log(`✅ Messages role check completed: ${checked} members checked, ${granted} roles granted, ${skipped} skipped (not in server)`);
        return { checked, granted, skipped };
    } catch (error) {
        console.error('Error in periodic messages role check:', error);
        return { checked: 0, granted: 0, skipped: 0 };
    }
}

// دالة لفحص رتبة معينة عند زيادة عدد الرسائل
async function checkMessagesOnIncrement(client, userId) {
    try {
        await checkMessagesRoles(client, userId);
    } catch (error) {
        console.error(`Error checking messages role on increment for user ${userId}:`, error);
    }
}

// دالة لتحديث النظام وإعادة فحص الجميع
async function refreshMessagesRoles(client) {
    try {
        console.log('🔄 Force refreshing all messages roles...');
        const result = await checkAllMembersMessagesRoles(client);
        console.log(`✅ Force refresh completed: ${result.granted} roles granted`);
        return result;
    } catch (error) {
        console.error('Error refreshing messages roles:', error);
        throw error;
    }
}

// دالة لمعرفة حالة المستخدم
async function getUserMessagesStatus(client, userId) {
    try {
        const guild = client.guilds.cache.get(process.env.GUILD_ID);
        if (!guild) return null;

        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return null;

        const messagesData = await client.dbManager.get(
            'SELECT total FROM message_stats WHERE user_id = ?',
            [userId]
        );

        const totalMessages = messagesData?.total || 0;

        const has250MessagesRole = MESSAGES_ROLES_CONFIG.ROLE_250_MESSAGES.id && 
                                 member.roles.cache.has(MESSAGES_ROLES_CONFIG.ROLE_250_MESSAGES.id);

        const has500MessagesRole = MESSAGES_ROLES_CONFIG.ROLE_500_MESSAGES.id && 
                                 member.roles.cache.has(MESSAGES_ROLES_CONFIG.ROLE_500_MESSAGES.id);

        return {
            userId: userId,
            username: member.user.tag,
            totalMessages: totalMessages,
            has250MessagesRole: has250MessagesRole,
            has500MessagesRole: has500MessagesRole,
            eligibleFor250MessagesRole: totalMessages >= MESSAGES_ROLES_CONFIG.ROLE_250_MESSAGES.minMessages,
            eligibleFor500MessagesRole: totalMessages >= MESSAGES_ROLES_CONFIG.ROLE_500_MESSAGES.minMessages,
            required250Messages: MESSAGES_ROLES_CONFIG.ROLE_250_MESSAGES.minMessages,
            required500Messages: MESSAGES_ROLES_CONFIG.ROLE_500_MESSAGES.minMessages
        };
    } catch (error) {
        console.error(`Error getting user messages status:`, error);
        return null;
    }
}

module.exports = { 
    checkMessagesRoles, 
    checkAllMembersMessagesRoles,
    checkMessagesOnIncrement,
    refreshMessagesRoles,
    getUserMessagesStatus,
    MESSAGES_ROLES_CONFIG
};