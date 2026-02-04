const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle
} = require('discord.js');
const voiceSystem = require('../LevelSystem/voicesystem');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voice-status')
        .setDescription('Check current voice system status'),

    async execute(interaction) {
        // الطريقة الآمنة للوصول لـ voiceUsers
        let voiceUsers = new Map();
        let activeUsers = [];

        try {
            // حاول الوصول للبيانات بطرق مختلفة
            if (voiceSystem.voiceUsers && voiceSystem.voiceUsers instanceof Map) {
                voiceUsers = voiceSystem.voiceUsers;
            } else if (global.voiceUsers && global.voiceUsers instanceof Map) {
                voiceUsers = global.voiceUsers;
            }

            // جلب المستخدمين من voiceUsers
            if (voiceUsers && voiceUsers.size > 0) {
                console.log(`Found ${voiceUsers.size} users in voice system`);

                for (const [userId, userData] of voiceUsers.entries()) {
                    // تحقق من بيانات المستخدم
                    if (userData && userData.username) {
                        activeUsers.push({
                            username: userData.username,
                            type: userData.userType || 'active',
                            rewardsGiven: userData.rewardsGiven || 0,
                            isVIP: userData.isVIP || false,
                            isStreaming: userData.isStreaming || false,
                            channelId: userData.channelId,
                            guildId: userData.guildId
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error accessing voiceUsers:', error);
        }

        // جلب إحصائيات النظام
        const stats = voiceSystem.getVoiceSystemStats ? voiceSystem.getVoiceSystemStats() : {
            totalUsers: 0,
            activeUsers: 0,
            mutedUsers: 0,
            streamingUsers: 0,
            vipUsers: 0,
            rewardsGiven: 0,
            totalXP: 0,
            totalCoins: 0,
            totalCrystals: 0,
            minUsersRequired: 3
        };

        // ========== جلب معلومات القنوات وعدد المستخدمين ==========
        const channelStats = new Map();
        if (activeUsers.length > 0) {
            for (const user of activeUsers) {
                if (!channelStats.has(user.channelId)) {
                    channelStats.set(user.channelId, {
                        count: 0,
                        users: [],
                        eligible: false
                    });
                }
                const channel = channelStats.get(user.channelId);
                channel.count++;
                channel.users.push(user.username);
            }

            // تحديث حالة الأهلية لكل قناة
            for (const [channelId, data] of channelStats.entries()) {
                data.eligible = data.count >= (stats.minUsersRequired || 3);
            }
        }

        // إنشاء الإمبدد
        const embed = new EmbedBuilder()
            .setTitle('Voice System Status')
            .setColor(activeUsers.length > 0 ? 0x00FF00 : 0xFF0000)
            .setFooter({ text: `🎖️ VIP Users: ${stats.vipUsers || 0}` });

        // ========== إضافة معلومات الشرط الجديد ==========
        const minUsers = stats.minUsersRequired || 3;
        const eligibleChannels = Array.from(channelStats.values()).filter(ch => ch.eligible).length;

        embed.addFields(
            {
                name: '🎙️ Talker',
                value: `**${stats.activeUsers || 0}**`,
                inline: true
            },
            {
                name: '🔇 Muted',
                value: `**${stats.mutedUsers || 0}**`,
                inline: true
            },
            {
                name: '🎥 Streaming',
                value: `**${stats.streamingUsers || 0}**`,
                inline: true
            },
            {
                name: '⭐ Total Rewards',
                value: `**${stats.rewardsGiven || 0}**`,
                inline: true
            },
            {
                name: '📈 Total XP',
                value: `**${stats.totalXP || 0}**`,
                inline: true
            },
            {
                name: '💰 Total Coins',
                value: `**${stats.totalCoins || 0}**`,
                inline: true
            }
        );

        // إضافة قائمة المستخدمين النشطين مع معلومات القنوات
        if (activeUsers.length > 0) {
            // ترتيب المستخدمين حسب عدد الجوائز (الأكثر أولا)
            const sortedUsers = [...activeUsers].sort((a, b) => b.rewardsGiven - a.rewardsGiven);

            let userList = '';
            sortedUsers.slice(0, 10).forEach((u, index) => {
                // تحديد الإيموجي المناسب
                let emoji = '🎤'; // الافتراضي active
                if (u.type === 'stream' || u.isStreaming) {
                    emoji = '🎥';
                } else if (u.type === 'muted') {
                    emoji = '🔇';
                }

                const vipIcon = u.isVIP ? '🎖️ ' : '';

                // التحقق إذا كان المستخدم في قناة مؤهلة
                const channelInfo = channelStats.get(u.channelId);
                const eligibilityIcon = channelInfo?.eligible ? '✅' : '❌';

                const num = (index + 1).toString().padStart(2, '0');
                userList += `\`${num}\` ${eligibilityIcon} ${vipIcon}${emoji} **${u.username}** | ⭐ ${u.rewardsGiven}\n`;
            });

            embed.addFields({
                name: `📋 Active Users (${activeUsers.length})`,
                value: userList || '*No active users*',
                inline: false
            });

            // إضافة معلومات عن القنوات
            if (channelStats.size > 0) {
                let channelInfo = '';
                let channelNum = 1;

                for (const [channelId, data] of channelStats.entries()) {
                    const status = data.eligible ? '✅ Eligible' : '❌ Not Eligible';
                    const usersText = data.users.slice(0, 3).join(', ') + (data.users.length > 3 ? '...' : '');
                    channelInfo += `**${channelNum}.** ${status} - **${data.count}** users\n`;
                    channelNum++;
                }

                if (channelInfo) {
                    embed.addFields({
                        name: `Voice Channels (${channelStats.size})`,
                        value: channelInfo,
                        inline: false
                    });
                }
            }

            if (activeUsers.length > 10) {
                embed.addFields({
                    name: '📝 More Users',
                    value: `*... and ${activeUsers.length - 10} more users*`,
                    inline: false
                });
            }
        } else {
            embed.addFields({
                name: '📋 Active Users',
                value: '**No users currently in voice channels**\n*Join a voice channel to see your status here!*',
                inline: false
            });
        }

        // إنشاء زر التحديث
        const refreshButton = new ButtonBuilder()
            .setCustomId('refresh_voice')
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Primary);

        const actionRow = new ActionRowBuilder().addComponents(refreshButton);

        // إرسال الرسالة
        const message = await interaction.reply({
            embeds: [embed],
            components: [actionRow],
            fetchReply: true
        });

        // إنشاء الكوليكتور للأزرار
        const collector = message.createMessageComponentCollector({
            filter: (i) => i.customId === 'refresh_voice' && i.user.id === interaction.user.id,
            time: 300000 // 5 دقائق
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate();

            // تحديث البيانات
            let refreshedVoiceUsers = new Map();
            let refreshedActiveUsers = [];

            try {
                if (voiceSystem.voiceUsers && voiceSystem.voiceUsers instanceof Map) {
                    refreshedVoiceUsers = voiceSystem.voiceUsers;
                } else if (global.voiceUsers && global.voiceUsers instanceof Map) {
                    refreshedVoiceUsers = global.voiceUsers;
                }

                if (refreshedVoiceUsers && refreshedVoiceUsers.size > 0) {
                    for (const [userId, userData] of refreshedVoiceUsers.entries()) {
                        if (userData && userData.username) {
                            refreshedActiveUsers.push({
                                username: userData.username,
                                type: userData.userType || 'active',
                                rewardsGiven: userData.rewardsGiven || 0,
                                isVIP: userData.isVIP || false,
                                isStreaming: userData.isStreaming || false,
                                channelId: userData.channelId,
                                guildId: userData.guildId
                            });
                        }
                    }
                }
            } catch (error) {
                console.error('Error refreshing voice data:', error);
            }

            // جلب إحصائيات النظام المحدثة
            const refreshedStats = voiceSystem.getVoiceSystemStats ? voiceSystem.getVoiceSystemStats() : stats;

            // ========== تحديث معلومات القنوات ==========
            const refreshedChannelStats = new Map();
            if (refreshedActiveUsers.length > 0) {
                for (const user of refreshedActiveUsers) {
                    if (!refreshedChannelStats.has(user.channelId)) {
                        refreshedChannelStats.set(user.channelId, {
                            count: 0,
                            users: [],
                            eligible: false
                        });
                    }
                    const channel = refreshedChannelStats.get(user.channelId);
                    channel.count++;
                    channel.users.push(user.username);
                }

                // تحديث حالة الأهلية لكل قناة
                for (const [channelId, data] of refreshedChannelStats.entries()) {
                    data.eligible = data.count >= (refreshedStats.minUsersRequired || 3);
                }
            }

            // تحديث الإمبدد
            const updatedEmbed = new EmbedBuilder()
                .setTitle('Voice System Status (Refreshed)')
                .setColor(refreshedActiveUsers.length > 0 ? 0x00FF00 : 0xFF0000)
                .setFooter({ text: `🎖️ VIP Users: ${refreshedStats.vipUsers || 0}` });

            // ========== تحديث معلومات الشرط الجديد ==========
            const refreshedMinUsers = refreshedStats.minUsersRequired || 3;
            const refreshedEligibleChannels = Array.from(refreshedChannelStats.values()).filter(ch => ch.eligible).length;

            updatedEmbed.addFields(
                {
                    name: '📊 System Requirements',
                    value: `**Minimum Users:** ${refreshedMinUsers}+ per channel\n**Eligible Channels:** ${refreshedEligibleChannels}/${refreshedChannelStats.size}`,
                    inline: false
                },
                {
                    name: '🎙️ Active',
                    value: `**${refreshedStats.activeUsers || 0}**`,
                    inline: true
                },
                {
                    name: '🔇 Muted',
                    value: `**${refreshedStats.mutedUsers || 0}**`,
                    inline: true
                },
                {
                    name: '📡 Streaming',
                    value: `**${refreshedStats.streamingUsers || 0}**`,
                    inline: true
                },
                {
                    name: '⭐ Total Rewards',
                    value: `**${refreshedStats.rewardsGiven || 0}**`,
                    inline: true
                },
                {
                    name: '📈 Total XP',
                    value: `**${refreshedStats.totalXP || 0}**`,
                    inline: true
                },
                {
                    name: '💰 Total Coins',
                    value: `**${refreshedStats.totalCoins || 0}**`,
                    inline: true
                }
            );

            // تحديث قائمة المستخدمين
            if (refreshedActiveUsers.length > 0) {
                const sortedUsers = [...refreshedActiveUsers].sort((a, b) => b.rewardsGiven - a.rewardsGiven);

                let userList = '';
                sortedUsers.slice(0, 10).forEach((u, index) => {
                    let emoji = '🎤';
                    if (u.type === 'stream' || u.isStreaming) {
                        emoji = '📡';
                    } else if (u.type === 'muted') {
                        emoji = '🔇';
                    }

                    const vipIcon = u.isVIP ? '🎖️ ' : '';

                    // التحقق إذا كان المستخدم في قناة مؤهلة
                    const channelInfo = refreshedChannelStats.get(u.channelId);
                    const eligibilityIcon = channelInfo?.eligible ? '✅' : '❌';

                    const num = (index + 1).toString().padStart(2, '0');
                    userList += `\`${num}\` ${eligibilityIcon} ${vipIcon}${emoji} **${u.username}** | ⭐ ${u.rewardsGiven}\n`;
                });

                updatedEmbed.addFields({
                    name: `Active Users (${refreshedActiveUsers.length})`,
                    value: userList || '*No active users*',
                    inline: false
                });

                // إضافة معلومات عن القنوات المحدثة
                if (refreshedChannelStats.size > 0) {
                    let channelInfo = '';
                    let channelNum = 1;

                    for (const [channelId, data] of refreshedChannelStats.entries()) {
                        const status = data.eligible ? '✅ Eligible' : '❌ Not Eligible';
                        channelInfo += `**${channelNum}.** ${status} - **${data.count}** users\n`;
                        channelNum++;
                    }

                    if (channelInfo) {
                        updatedEmbed.addFields({
                            name: `Voice Channels (${refreshedChannelStats.size})`,
                            value: channelInfo,
                            inline: false
                        });
                    }
                }

                if (refreshedActiveUsers.length > 10) {
                    updatedEmbed.addFields({
                        name: '📝 More Users',
                        value: `*... and ${refreshedActiveUsers.length - 10} more users*`,
                        inline: false
                    });
                }
            } else {
                updatedEmbed.addFields({
                    name: '📋 Active Users',
                    value: '**No users currently in voice channels**\n*Join a voice channel to see your status here!*',
                    inline: false
                });
            }

            // تحديث الرسالة
            await i.editReply({
                embeds: [updatedEmbed],
                components: [actionRow]
            });
        });

        collector.on('end', async (collected) => {
            try {
                // تعطيل الزر عند انتهاء الوقت
                const disabledButton = new ButtonBuilder()
                    .setCustomId('refresh_voice_expired')
                    .setLabel('🔄 Refresh (Expired)')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true);

                const disabledActionRow = new ActionRowBuilder().addComponents(disabledButton);

                await message.edit({
                    components: [disabledActionRow]
                });
            } catch (error) {
                console.error('Error disabling button:', error);
            }
        });
    }
};