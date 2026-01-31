const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');

// دالة مساعدة لتحديث الكاش
function updateChannelCache(client, guildId, channelType, channelId, channelName) {
    try {
        if (!client.logChannels) client.logChannels = {};
        if (!client.logChannels[guildId]) client.logChannels[guildId] = {};

        client.logChannels[guildId][channelType] = {
            id: channelId,
            name: channelName
        };

        console.log(`✅ Cache updated for ${channelType} channel: ${channelName}`);
    } catch (error) {
        console.error(`❌ Error updating cache for ${channelType}:`, error);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlogchannel')
        .setDescription('Set the channels for bot logs (All channels are optional)')
        .addChannelOption(option =>
            option.setName('welcome')
                .setDescription('Select the Welcome log channel (optional)'))
        .addChannelOption(option =>
            option.setName('modcommands')
                .setDescription('Select the Mod Commands log channel (optional)'))
        .addChannelOption(option =>
            option.setName('communitycommands')
                .setDescription('Select the Community Commands log channel (optional)'))
        .addChannelOption(option =>
            option.setName('tweets')
                .setDescription('Select the Tweets channel (optional)'))
        .addChannelOption(option =>
            option.setName('counted')
                .setDescription('Select channel to add/remove from message counting (optional)'))
        .addChannelOption(option =>
            option.setName('announcements')
                .setDescription('Select the Announcements channel (optional)'))
        .addChannelOption(option =>
            option.setName('leave')
                .setDescription('Select the Leave log channel (optional)'))
        .addChannelOption(option =>
            option.setName('giveaway_auto')
                .setDescription('Select channel to add/remove from auto giveaway role (optional)')),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        try {
            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من أن المستخدم لديه Moderate Role
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setImage(process.env.RedLine)
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error checking moderate role:', error);
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while checking permissions.');
            return interaction.editReply({ embeds: [embed] });
        }

        const welcomeChannel = interaction.options.getChannel('welcome');
        const modCommandsChannel = interaction.options.getChannel('modcommands');
        const communityCommandsChannel = interaction.options.getChannel('communitycommands');
        const tweetsChannel = interaction.options.getChannel('tweets');
        const countedChannel = interaction.options.getChannel('counted');
        const announcementsChannel = interaction.options.getChannel('announcements');
        const leaveChannel = interaction.options.getChannel('leave');
        const giveawayAutoChannel = interaction.options.getChannel('giveaway_auto');

        // التحقق من نوع القنوات المقدمة فقط
        if (welcomeChannel && !welcomeChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Welcome** Channel!')
                .setImage(process.env.RedLine)
                .setDescription('`Welcome channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        if (modCommandsChannel && !modCommandsChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Mod-Commands** Channel!')
                .setImage(process.env.RedLine)
                .setDescription('`Mod-Commands channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        if (communityCommandsChannel && !communityCommandsChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Community-Commands** Channel!')
                .setImage(process.env.RedLine)
                .setDescription('`Community-Commands channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        if (tweetsChannel && !tweetsChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Tweets** Channel!')
                .setImage(process.env.RedLine)
                .setDescription('`Tweets channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        if (countedChannel && !countedChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Counted** Channel')
                .setImage(process.env.RedLine)
                .setDescription('`Counted channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        if (announcementsChannel && !announcementsChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Announcements** Channel')
                .setImage(process.env.RedLine)
                .setDescription('`Announcments channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        if (leaveChannel && !leaveChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Leave** Channel')
                .setImage(process.env.RedLine)
                .setDescription('`Leave channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        if (giveawayAutoChannel && !giveawayAutoChannel.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Invalid **Giveaway Auto** Channel')
                .setImage(process.env.RedLine)
                .setDescription('`Giveaway Auto channel must support text messages, Please select a valid text channel.`');
            return interaction.editReply({ embeds: [embed] });
        }

        // التحقق من وجود قناة واحدة على الأقل
        if (!welcomeChannel && !modCommandsChannel && !communityCommandsChannel && 
            !tweetsChannel && !countedChannel && !announcementsChannel && !leaveChannel && !giveawayAutoChannel) {
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ No Channels Selected')
                .setImage(process.env.OrangeLine)
                .setDescription('`No channels selected, Please choose one or more channels to continue.`');
            return interaction.editReply({ embeds: [embed] });
        }

        try {
            let countedAction = null;
            let giveawayAutoAction = null;

            // تحديث قنوات السجل
            if (welcomeChannel) {
                await dbManager.setLogChannel(
                    interaction.guild.id,
                    'welcome',
                    welcomeChannel.id,
                    welcomeChannel.name,
                    interaction.user.id
                );
                updateChannelCache(client, interaction.guild.id, 'welcome', welcomeChannel.id, welcomeChannel.name);
            }

            if (modCommandsChannel) {
                await dbManager.setLogChannel(
                    interaction.guild.id,
                    'modcommands',
                    modCommandsChannel.id,
                    modCommandsChannel.name,
                    interaction.user.id
                );
                updateChannelCache(client, interaction.guild.id, 'modcommands', modCommandsChannel.id, modCommandsChannel.name);
            }

            if (communityCommandsChannel) {
                await dbManager.setLogChannel(
                    interaction.guild.id,
                    'communitycommands',
                    communityCommandsChannel.id,
                    communityCommandsChannel.name,
                    interaction.user.id
                );
                updateChannelCache(client, interaction.guild.id, 'communitycommands', communityCommandsChannel.id, communityCommandsChannel.name);
            }

            if (tweetsChannel) {
                await dbManager.setLogChannel(
                    interaction.guild.id,
                    'tweets',
                    tweetsChannel.id,
                    tweetsChannel.name,
                    interaction.user.id
                );
                updateChannelCache(client, interaction.guild.id, 'tweets', tweetsChannel.id, tweetsChannel.name);
            }

            if (announcementsChannel) {
                await dbManager.setLogChannel(
                    interaction.guild.id,
                    'announcements',
                    announcementsChannel.id,
                    announcementsChannel.name,
                    interaction.user.id
                );
                updateChannelCache(client, interaction.guild.id, 'announcements', announcementsChannel.id, announcementsChannel.name);
            }

            if (leaveChannel) {
                await dbManager.setLogChannel(
                    interaction.guild.id,
                    'leave',
                    leaveChannel.id,
                    leaveChannel.name,
                    interaction.user.id
                );
                updateChannelCache(client, interaction.guild.id, 'leave', leaveChannel.id, leaveChannel.name);
            }

            // معالجة القنوات المحسوبة
            if (countedChannel) {
                countedAction = await dbManager.toggleCountedChannel(
                    interaction.guild.id,
                    countedChannel.id,
                    countedChannel.name,
                    interaction.user.id
                );
            }

            // معالجة قنوات الجيف ااوي التلقائي
            if (giveawayAutoChannel) {
                giveawayAutoAction = await dbManager.toggleGiveawayAutoChannel(
                    interaction.guild.id,
                    giveawayAutoChannel.id,
                    giveawayAutoChannel.name,
                    interaction.user.id
                );
            }

            // إعداد رسالة التأكيد
            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('✅ Channels Updated')
                .setDescription('Successfully updated selected channels:')
                .setImage(process.env.BlueLine)
                .setTimestamp();

            // إضافة الحقول للقنوات المحدثة فقط
            if (welcomeChannel) {
                successEmbed.addFields({
                    name: 'Welcome Channel',
                    value: welcomeChannel.toString(),
                    inline: true
                });
            }

            if (modCommandsChannel) {
                successEmbed.addFields({
                    name: 'Mod Commands Channel',
                    value: modCommandsChannel.toString(),
                    inline: true
                });
            }

            if (communityCommandsChannel) {
                successEmbed.addFields({
                    name: 'Community Commands Channel',
                    value: communityCommandsChannel.toString(),
                    inline: true
                });
            }

            if (tweetsChannel) {
                successEmbed.addFields({
                    name: 'Tweets Channel',
                    value: tweetsChannel.toString(),
                    inline: true
                });
            }

            if (announcementsChannel) {
                successEmbed.addFields({
                    name: 'Announcements Channel',
                    value: announcementsChannel.toString(),
                    inline: true
                });
            }

            if (leaveChannel) {
                successEmbed.addFields({
                    name: 'Leave Channel',
                    value: leaveChannel.toString(),
                    inline: true
                });
            }

            if (countedChannel) {
                successEmbed.addFields({
                    name: 'Message Counting',
                    value: `${countedChannel.toString()} ${countedAction === 'added' ? '✅ Added to' : '❌ Removed from'} counted channels`,
                    inline: true
                });
            }

            if (giveawayAutoChannel) {
                successEmbed.addFields({
                    name: 'Auto Giveaway Role',
                    value: `${giveawayAutoChannel.toString()} ${giveawayAutoAction === 'added' ? '✅ Added to' : '❌ Removed from'} auto giveaway channels`,
                    inline: true
                });
            }

            // إظهار القنوات المحسوبة الحالية
            const countedChannels = await dbManager.getCountedChannels(interaction.guild.id);
            if (countedChannels.length > 0) {
                const countedList = countedChannels.map(channel => {
                    const discordChannel = interaction.guild.channels.cache.get(channel.channel_id);
                    return discordChannel ? discordChannel.toString() : `#${channel.channel_name} (${channel.channel_id})`;
                }).join('\n');

                successEmbed.addFields({
                    name: '📊 Current Counted Channels',
                    value: countedList || 'No channels set for message counting',
                    inline: false
                });
            }

            // إظهار قنوات الجيف ااوي التلقائي الحالية
            const giveawayAutoChannels = await dbManager.getGiveawayAutoChannels(interaction.guild.id);
            if (giveawayAutoChannels.length > 0) {
                const giveawayList = giveawayAutoChannels.map(channel => {
                    const discordChannel = interaction.guild.channels.cache.get(channel.channel_id);
                    return discordChannel ? discordChannel.toString() : `#${channel.channel_name} (${channel.channel_id})`;
                }).join('\n');

                successEmbed.addFields({
                    name: '🎉 Current Auto Giveaway Channels',
                    value: giveawayList || 'No channels set for auto giveaway role',
                    inline: false
                });
            }

            successEmbed.addFields({
                name: 'Updated By',
                value: interaction.user.toString(),
                inline: false
            });

            await interaction.editReply({ embeds: [successEmbed] });

            // تسجيل تفعيل القنوات في الكونسول
            console.log('📝 Channels Updated:');
            if (welcomeChannel) console.log(`- Welcome Channel: ${welcomeChannel.name} (${welcomeChannel.id})`);
            if (modCommandsChannel) console.log(`- Mod Commands Channel: ${modCommandsChannel.name} (${modCommandsChannel.id})`);
            if (communityCommandsChannel) console.log(`- Community Commands Channel: ${communityCommandsChannel.name} (${communityCommandsChannel.id})`);
            if (tweetsChannel) console.log(`- Tweets Channel: ${tweetsChannel.name} (${tweetsChannel.id})`);
            if (announcementsChannel) console.log(`- Announcements Channel: ${announcementsChannel.name} (${announcementsChannel.id})`);
            if (leaveChannel) console.log(`- Leave Channel: ${leaveChannel.name} (${leaveChannel.id})`);
            if (countedChannel) console.log(`- Counted Channel: ${countedChannel.name} (${countedChannel.id}) ${countedAction === 'added' ? 'ADDED' : 'REMOVED'}`);
            if (giveawayAutoChannel) console.log(`- Giveaway Auto Channel: ${giveawayAutoChannel.name} (${giveawayAutoChannel.id}) ${giveawayAutoAction === 'added' ? 'ADDED' : 'REMOVED'}`);
            console.log(`Configured by: ${interaction.user.tag}`);

        } catch (error) {
            console.error('Error setting channels:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while setting the channels.');
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // دالة لتحميل قنوات السجل عند بدء تشغيل البوت
    async loadLogChannels(client) {
        try {
            // جلب جميع قنوات السجل من قاعدة البيانات
            const allLogChannels = await dbManager.all('SELECT * FROM log_channels');

            // تجميع القنوات حسب الجuild
            const guildChannels = {};

            for (const channel of allLogChannels) {
                if (!guildChannels[channel.guild_id]) {
                    guildChannels[channel.guild_id] = {};
                }

                guildChannels[channel.guild_id][channel.channel_type] = {
                    id: channel.channel_id,
                    name: channel.channel_name,
                    guildId: channel.guild_id,
                    setBy: channel.set_by,
                    setAt: channel.set_at
                };
            }

            // تخزين القنوات في العميل
            client.logChannels = guildChannels;

            console.log(`✅ Loaded log channels for ${Object.keys(guildChannels).length} guilds`);
            return true;
        } catch (error) {
            console.error('Error loading log channels:', error);
            return false;
        }
    }
};