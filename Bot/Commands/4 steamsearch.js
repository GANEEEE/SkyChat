const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verifysearch')
        .setDescription('Search for Steam accounts by Discord user or Steam ID')
        .addUserOption(option =>
            option
                .setName('discord')
                .setDescription('Discord ID, mention, or username (optional)')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('steam')
                .setDescription('Steam ID (17 digits) (optional)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        // الحصول على خيار المستخدم (User option)
        const discordUser = interaction.options.getUser('discord');
        const steamQuery = interaction.options.getString('steam');

        try {
            // جلب Moderate Role من قاعدة البيانات
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
                    .setDescription('No moderate role is configured. Please set a moderate role first using `/setrole`.');
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

            // التحقق من إدخال واحد على الأقل
            if (!discordUser && !steamQuery) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Missing Search Parameter')
                    .setImage(process.env.OrangeLine)
                    .setDescription('You must provide at least one search parameter.')
                    .addFields(
                        { name: '👤 Search by Discord', value: '• User ID: `123456789012345678`\n• Mention: `<@123456789012378>`\n• Username: `username`', inline: true },
                        { name: '🎮 Search by Steam', value: '• Steam ID: `12345678987654321`', inline: true },
                        { name: '💡 Example:', value: '`/steamsearch discord:Raivina`\n`/steamsearch steam:12345678987654321`', inline: false }
                    );
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // بناء استعلام البحث
            let searchQuery = '';
            let searchParams = [];
            let searchType = '';

            if (discordUser && steamQuery) {
                // البحث بالاثنين معاً
                searchType = 'discord + steam';

                // تنظيف Steam Query
                const cleanSteamId = steamQuery.trim();

                searchQuery = `
                    SELECT * FROM discord_verify_steam 
                    WHERE 
                        discord_id = $1
                        AND steam_id = $2
                    ORDER BY 
                        CASE WHEN status = 'verified' THEN 1 ELSE 2 END,
                        updated_at DESC
                    LIMIT 10
                `;
                searchParams = [
                    discordUser.id,
                    cleanSteamId
                ];
            } else if (discordUser) {
                // البحث بـ Discord فقط
                searchType = 'discord';

                searchQuery = `
                    SELECT * FROM discord_verify_steam 
                    WHERE discord_id = $1
                    ORDER BY 
                        CASE WHEN status = 'verified' THEN 1 ELSE 2 END,
                        updated_at DESC
                    LIMIT 10
                `;
                searchParams = [discordUser.id];
            } else if (steamQuery) {
                // البحث بـ Steam فقط
                searchType = 'steam';

                // تحقق من صيغة Steam ID
                if (!/^\d{17}$/.test(steamQuery)) {
                    const errorEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⚠️ Invalid Steam ID Format')
                        .setImage(process.env.OrangeLine)
                        .setDescription('Steam ID must be 17 digits.')
                        .addFields(
                            { name: '❌ What you entered:', value: `\`${steamQuery}\``, inline: false },
                            { name: '✅ Correct format:', value: '`12345678987654321`', inline: false },
                            { name: '💡 Tip:', value: 'Use `/steamlist` to browse all accounts', inline: false }
                        );
                    return interaction.editReply({ embeds: [errorEmbed] });
                }

                searchQuery = `
                    SELECT * FROM discord_verify_steam 
                    WHERE steam_id = $1
                    ORDER BY updated_at DESC
                    LIMIT 10
                `;
                searchParams = [steamQuery];
            }

            // تنفيذ البحث
            let results;
            if (searchQuery.includes('LIMIT 1')) {
                results = await dbManager.get(searchQuery, searchParams);
                results = results ? [results] : [];
            } else {
                results = await dbManager.all(searchQuery, searchParams);
            }

            if (!results || results.length === 0) {
                const noResultsEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('🔍 No Results Found')
                    //.setDescription('No Steam accounts found matching your search.')
                    .addFields(
                        { 
                            name: '👤 Discord Search', 
                            value: discordUser ? `<@${discordUser.id}>` : 'Not searched', 
                            inline: true 
                        },
                        { 
                            name: '🎮 Steam Search', 
                            value: steamQuery ? `\`${steamQuery}\`` : 'Not searched', 
                            inline: true 
                        },
                        { 
                            name: '💡 Search Tips:', 
                            value: '• Check spelling\n• Verify IDs are correct\n• Use `/steamlist` to browse all accounts', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: `No Steam accounts found matching your search` });

                return interaction.editReply({ embeds: [noResultsEmbed] });
            }

            // إنشاء Embed للنتائج
            const embed = new EmbedBuilder()
                .setTitle('🔍 | Account Search Results')
                .setColor(process.env.Bluecolor)
                /*.setFooter({ 
                    text: `Search type: ${searchType} • ${discordUser ? 'Discord: ' + discordUser.tag : ''} ${steamQuery ? 'Steam: ' + steamQuery : ''}` 
                });*/

            // إضافة خط إذا كان متوفراً
            if (process.env.BlueLine) {
                embed.setImage(process.env.BlueLine);
            }

            // بناء الوصف الرئيسي
            let foundText = results.length === 1 ? 'Found **1** account' : `Found **${results.length}** accounts`;
            //embed.setDescription(`#${index + 1}) | ${statusEmoji}`);

            // إضافة كل نتيجة كـ fields منفصلة
            results.forEach((result, index) => {
                // تنسيق الحالة
                let statusEmoji;
                if (result.status === 'verified') {
                    statusEmoji = '✅';
                } else if (result.status === 'pending') {
                    statusEmoji = '🔄';
                } else if (result.status === 'manual') {
                    statusEmoji = '🔧';
                } else {
                    statusEmoji = '❓';
                }

                // عنوان الحساب
                /*embed.addFields({
                    name: `📝 Account Details`,
                    value:  ` #${index + 1} | ${statusEmoji}`,
                    inline: false
                });*/

                // Discord Information FIRST
                if (result.discord_id) {
                    embed.addFields(
                        {
                            name: '👤 Discord User',
                            value: `<@${result.discord_id}>`,
                            inline: true
                        },
                        {
                            name: '📋 Discord ID',
                            value: `\`${result.discord_id}\``,
                            inline: true
                        },
                        {
                            name: '🏷️ Username',
                            value: result.discord_username || '*Not available*',
                            inline: true
                        }
                    );
                } else {
                    embed.addFields({
                        name: '👤 Discord',
                        value: '`Not linked`',
                        inline: false
                    });
                }

                // Steam Information SECOND
                embed.addFields(
                    {
                        name: '🎮 Steam Name',
                        value: result.steam_name || '*Not set*',
                        inline: true
                    },
                    {
                        name: '🆔 Steam ID',
                        value: `\`${result.steam_id}\``,
                        inline: true
                    },
                    {
                        name: '📊 Status',
                        value: `\`${statusEmoji} | ${result.status.toUpperCase()}\``,
                        inline: true
                    }
                );

                // Time Information
                embed.addFields(
                    {
                        name: '✅ Verified',
                        value: result.verified_at 
                            ? `<t:${Math.floor(new Date(result.verified_at).getTime() / 1000)}:F>` 
                            : '`Not verified`',
                        inline: false
                    },
                    {
                        name: '📅 Added',
                        value: `<t:${Math.floor(new Date(result.added_at).getTime() / 1000)}:F>`,
                        inline: false
                    },
                    {
                        name: '🔗 Profile',
                        value: result.steam_profile_url && result.steam_profile_url !== '#' 
                            ? `${result.steam_profile_url}` 
                            : '`No URL`',
                        inline: false
                    }
                );

                // فاصل بين الحسابات
                if (index < results.length - 1) {
                    embed.addFields({
                        name: '\u200B',
                        value: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
                        inline: false
                    });
                }
            });

            // إذا كان هناك أكثر من نتيجة، إضافة ملخص
            if (results.length > 1) {
                const verifiedCount = results.filter(r => r.status === 'verified').length;
                const pendingCount = results.filter(r => r.status === 'pending').length;
                const manualCount = results.filter(r => r.status === 'manual').length;

                embed.addFields({
                    name: '📊 Quick Summary',
                    value: `✅ **${verifiedCount}** Verified • 🔄 **${pendingCount}** Pending • 🔧 **${manualCount}** Manual`,
                    inline: false
                });
            }

            // إضافة ملخص النتائج
            const verifiedCount = results.filter(r => r.status === 'verified').length;
            const pendingCount = results.filter(r => r.status === 'pending').length;
            const manualCount = results.filter(r => r.status === 'manual').length;

            /*embed.addFields({
                name: '📊 Results Summary',
                value: `✅ Verified: **${verifiedCount}** | 🔄 Pending: **${pendingCount}** | 🔧 Manual: **${manualCount}**`,
                inline: false
            });*/

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in steamsearch command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Search Error')
                .setDescription(`An error occurred while searching: \`${error.message}\``)
                .addFields({
                    name: '🛠️ Database Issue',
                    value: 'The database query function might not be available. Check database.js methods.',
                    inline: false
                });

            // إضافة خط إذا كان متوفراً
            if (process.env.RedLine) {
                errorEmbed.setImage(process.env.RedLine);
            }

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};