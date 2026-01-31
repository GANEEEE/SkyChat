const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../Data/database');
const axios = require('axios');
const VERIFIED_ROLE_ID = '1385519950919106571';
const VERIFIED_ROLE2_ID = '1386710923594436639'; // ⬅️ إضافة الرتبة الثانية
const UNVERIFIED_ROLE_ID = '1390001642069299280';
const VERIFIED_LOG_CHANNEL_ID = '1390437818530140161';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manverify')
        .setDescription('[MODERATOR] Manually add a verified Steam account')
        .addUserOption(option =>
            option
                .setName('discord')
                .setDescription('Discord user (REQUIRED)')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('steamid')
                .setDescription('Steam ID (17 digits) - REQUIRED')
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName('status')
                .setDescription('Verification status')
                .setRequired(false)
                .addChoices(
                    { name: '✅ Verified', value: 'verified' },
                    { name: '🔄 Pending', value: 'pending' }
                )
        ),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: true });

        const discordUser = interaction.options.getUser('discord');
        const steamId = interaction.options.getString('steamid');
        const status = interaction.options.getString('status') || 'verified';
        const addedBy = interaction.user.id;

        // متغير لتتبع التحذيرات
        let warnings = [];
        let requirementsMet = true;

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

            // ========== التحقق من المدخلات ==========

            // 1. تحقق من صيغة Steam ID
            if (!/^\d{17}$/.test(steamId)) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Invalid Steam ID Format')
                    .setImage(process.env.OrangeLine)
                    .setDescription('Steam ID must be exactly 17 digits.')
                    .addFields(
                        { name: '❌ What you entered:', value: `\`${steamId}\``, inline: false },
                        { name: '✅ Correct format:', value: '`12345678987654321`', inline: false },
                        { name: '💡 How to find:', value: '1. Visit Steam profile\n2. Copy numbers after `/profiles/`\n3. Make sure it\'s 17 digits', inline: false }
                    );
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // ========== التحقق من الشروط ==========
            const steamApiKey = process.env.STEAM_API_KEY;
            let steamName = null;
            let steamProfileUrl = `https://steamcommunity.com/profiles/${steamId}`;
            let steamData = null;
            let steamStats = null;

            let eligibleGames = [];
            let gamesChecked = 0;
            let totalAchievements = 0;

            try {

                if (steamApiKey) {
                    // 1. جلب بيانات الحساب
                    const response = await axios.get(
                        'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
                        {
                            params: {
                                key: steamApiKey,
                                steamids: steamId
                            },
                            timeout: 10000
                        }
                    );

                    const player = response.data?.response?.players?.[0];
                    if (player) {
                        steamData = player;
                        steamName = player.personaname;
                        steamProfileUrl = player.profileurl || steamProfileUrl;

                        // ========== الشروط ==========

                        // 1. التحقق من عمر حساب Discord
                        const discordUserAge = Date.now() - discordUser.createdTimestamp;
                        const discordDaysOld = Math.floor(discordUserAge / (24 * 60 * 60 * 1000));

                        if (discordDaysOld < 30) {
                            warnings.push(`❌ Discord account is only ${discordDaysOld} days old (needs 30+)`);
                            requirementsMet = false;
                        }

                        // 2. التحقق من عمر حساب Steam
                        if (player.timecreated) {
                            const steamAccountCreation = player.timecreated * 1000;
                            const steamAccountAge = Date.now() - steamAccountCreation;
                            const steamDaysOld = Math.floor(steamAccountAge / (24 * 60 * 60 * 1000));
                            const steamMonthsOld = Math.floor(steamDaysOld / 30);

                            if (steamDaysOld < 90) {
                                warnings.push(`❌ Steam account is only ${steamDaysOld} days old (${steamMonthsOld} months, needs 3+ months)`);
                                requirementsMet = false;
                            }
                        } else {
                            warnings.push(`⚠️ Could not determine Steam account age (timecreated not available)`);
                        }

                        // 3. التحقق من أن البروفايل public
                        if (player.communityvisibilitystate !== 3) {
                            warnings.push(`❌ Steam profile is not public (communityvisibilitystate: ${player.communityvisibilitystate})`);
                            requirementsMet = false;
                        }

                    } else {
                        warnings.push(`⚠️ Could not fetch Steam profile data`);
                    }

                    // 4. جلب ساعات اللعب والإنجازات
                    try {
                        // جلب كل الألعاب
                        const ownedGamesResponse = await axios.get(
                            'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/',
                            {
                                params: { 
                                    key: steamApiKey, 
                                    steamid: steamId,
                                    include_appinfo: 1,
                                    include_played_free_games: 1
                                },
                                timeout: 15000
                            }
                        );

                        const allGames = ownedGamesResponse.data?.response?.games || [];

                        // حساب وقت اللعب
                        let totalPlaytimeMinutes = 0;
                        allGames.forEach(game => {
                            totalPlaytimeMinutes += (game.playtime_forever || 0);
                        });

                        const totalPlaytimeHours = Math.floor(totalPlaytimeMinutes / 60);

                        // جلب إنجازات 5 الأكثر لعباً
                        const playedGames = allGames.filter(game => (game.playtime_forever || 0) > 0);

                        const maxAttempts = 10; // أقصى 10 محاولات

                        // النظام الذكي: تخطي الألعاب بدون إنجازات
                        eligibleGames = [];
                        gamesChecked = 0;
                        totalAchievements = 0;

                        // ترتيب الألعاب حسب ساعات اللعب
                        const sortedGames = playedGames
                            .filter(game => game.playtime_forever > 180)
                            .sort((a, b) => b.playtime_forever - a.playtime_forever);

                        // البحث عن 5 ألعاب بـ 10+ إنجازات
                        for (const game of sortedGames) {
                            if (eligibleGames.length >= 5) break;
                            if (gamesChecked >= maxAttempts) break;

                            gamesChecked++;

                            try {
                                const achievementsResponse = await axios.get(
                                    'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/',
                                    {
                                        params: { 
                                            key: steamApiKey, 
                                            steamid: steamId,
                                            appid: game.appid,
                                            l: 'english'
                                        },
                                        timeout: 8000
                                    }
                                );

                                if (achievementsResponse.data?.playerstats?.success === true) {
                                    const achievements = achievementsResponse.data.playerstats.achievements || [];
                                    const unlocked = achievements.filter(a => a.achieved === 1).length;

                                    // ⭐ الشرط الجديد: 10+ إنجازات في اللعبة
                                    if (unlocked >= 10) {
                                        eligibleGames.push({
                                            game: game.name,
                                            achievements: unlocked
                                        });
                                        totalAchievements += unlocked;
                                    } else {
                                        console.log(`⚠️ ${game.name}: Only ${unlocked} achievements (needs 10+)`);
                                    }
                                } else {
                                    // ⭐ لعبة بدون إنجازات → نتخطاها
                                    console.log(`➡️ ${game.name}: No achievements, skipping`);
                                    continue;
                                }
                            } catch (gameError) {
                                // ⭐ إذا كانت اللعبة بدون إنجازات أو خاصة
                                if (gameError.response?.status === 400) {
                                    console.log(`➡️ ${game.name}: No achievements available, skipping`);
                                }
                                continue; // ⭐ تخطي للعبة التالية
                            }
                        }

                        steamStats = {
                            totalPlaytime: totalPlaytimeHours,
                            totalAchievements: totalAchievements,
                            gamesCount: allGames.length,
                            hasEnoughPlaytime: totalPlaytimeHours >= 150,
                            hasEnoughAchievements: totalAchievements >= 50
                        };

                        // التحقق من ساعات اللعب
                        if (totalPlaytimeHours < 150) {
                            warnings.push(`❌ Insufficient playtime: ${totalPlaytimeHours} hours (needs 150+)`);
                            requirementsMet = false;
                        }

                        // التحقق من الإنجازات
                        if (totalAchievements < 50) {
                            warnings.push(`❌ Insufficient achievements: ${totalAchievements} (needs 50+ | needs 50+ from 5 games with 10+ each with 3+ hours of playing)`);
                            requirementsMet = false;
                        }

                    } catch (statsError) {
                        warnings.push(`⚠️ Could not fetch playtime/achievements: ${statsError.message}`);
                    }

                } else {
                    warnings.push(`⚠️ Steam API key not configured - cannot verify requirements`);
                }
            } catch (apiError) {
                console.log('[STEAMADD] Steam API error:', apiError.message);
                warnings.push(`❌ Steam API error: ${apiError.message}`);
            }

            // ========== عرض التحذيرات إذا وجدت ==========
            if (warnings.length > 0) {
                const warningEmbed = new EmbedBuilder()
                    .setColor(requirementsMet ? 0xFFA500 : 0x8B0000)
                    .setTitle(requirementsMet ? '⚠️ Requirements Check - Warnings' : '❌ Requirements Check - Failed')
                    .setDescription(`**Checking Steam account requirements for manual addition**`)
                    .addFields(
                        { 
                            name: '👤 Discord User', 
                            value: `${discordUser.username} (<@${discordUser.id}>)\nCreated: <t:${Math.floor(discordUser.createdTimestamp / 1000)}:R>`, 
                            inline: true 
                        },
                        { 
                            name: '🆔 Steam ID', 
                            value: `\`${steamId}\`\n${steamName ? `Name: ${steamName}` : 'Name: Not available'}`, 
                            inline: true 
                        }
                    );

                // إضافة التحذيرات
                if (steamStats) {
                    warningEmbed.addFields({
                        name: '🎮 Steam Stats',
                        value: `• Playtime: **${steamStats.totalPlaytime}h** / 150h ${steamStats.hasEnoughPlaytime ? '✅' : '❌'}\n• Games with 10+ achievements: **${eligibleGames.length}/5** ${eligibleGames.length >= 5 ? '✅' : '❌'}\n• Total achievements: **${totalAchievements}** ${totalAchievements >= 50 ? '✅' : '❌'}\n• Games checked: **${gamesChecked}**`,
                        inline: false
                    });
                }

                // إضافة التحذيرات في قائمة
                warningEmbed.addFields({
                    name: '📋 Requirements Check',
                    value: warnings.join('\n'),
                    inline: false
                });

                // إذا المتطلبات مش مكتملة، نعطي خيارين
                if (!requirementsMet) {
                    warningEmbed.addFields({
                        name: '❓ What would you like to do?',
                        value: '**Add Anyway** - Ignore requirements and add manually\n**Cancel** - Do not add this account',
                        inline: false
                    });

                    const warningMessage = await interaction.editReply({ 
                        embeds: [warningEmbed],
                        components: [
                            {
                                type: 1,
                                components: [
                                    {
                                        type: 2,
                                        label: '✅ Add Anyway',
                                        style: 3,
                                        custom_id: `steamadd_force_${steamId}_${discordUser.id}`
                                    },
                                    {
                                        type: 2,
                                        label: '❌ Cancel',
                                        style: 4,
                                        custom_id: 'steamadd_cancel'
                                    }
                                ]
                            }
                        ]
                    });

                    // انتظار رد المشرف
                    try {
                        const confirmation = await warningMessage.awaitMessageComponent({ 
                            time: 60000,
                            filter: i => i.user.id === interaction.user.id 
                        });

                        if (confirmation.customId === 'steamadd_cancel') {
                            await confirmation.update({
                                content: '❌ Manual addition cancelled.',
                                embeds: [],
                                components: []
                            });
                            return;
                        }

                        // إذا اختار "Add Anyway"، نكمل
                        await confirmation.update({
                            content: '⚠️ Proceeding with manual addition despite requirements...',
                            embeds: [],
                            components: []
                        });

                    } catch (timeoutError) {
                        await interaction.editReply({
                            content: '⏰ Timeout - Manual addition cancelled.',
                            embeds: [],
                            components: []
                        });
                        return;
                    }
                } else {
                    // إذا كل المتطلبات مكتملة بس فيه تحذيرات فقط
                    warningEmbed.addFields({
                        name: '✅ Requirements Met',
                        value: 'All requirements are satisfied. Proceeding with manual addition...',
                        inline: false
                    });

                    await interaction.editReply({ embeds: [warningEmbed] });
                    await new Promise(resolve => setTimeout(resolve, 3000)); // انتظار 3 ثواني
                }
            }

            // ========== التحقق إذا كان المستخدم موجود بالفعل ==========
            const discordId = discordUser.id;
            const discordUsername = discordUser.username;

            // التحقق من السجلات الموجودة
            const existingDiscordRecord = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE discord_id = $1',
                [discordId]
            );

            const existingSteamRecord = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE steam_id = $1 AND discord_id != $2',
                [steamId, discordId]
            );

            // ========== معالجة Steam ID مكرر مع مستخدم آخر ==========
            if (existingSteamRecord) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Steam ID Already Linked to Another User')
                    .addFields(
                        { 
                            name: '👤 Currently Linked To', 
                            value: existingSteamRecord.discord_id ? `<@${existingSteamRecord.discord_id}>` : 'Unknown', 
                            inline: true 
                        },
                        { 
                            name: '🆔 Steam ID', 
                            value: steamId, 
                            inline: true 
                        },
                        { 
                            name: '✅ Status', 
                            value: existingSteamRecord.status, 
                            inline: false 
                        },
                        { 
                            name: '📅 Linked Since', 
                            value: existingSteamRecord.verified_at ? 
                                `<t:${Math.floor(new Date(existingSteamRecord.verified_at).getTime() / 1000)}:F>` : 
                                'Not verified yet', 
                            inline: false 
                        }
                    );

                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // ========== المعالجة الرئيسية: UPDATE أو INSERT ==========
            let operation = 'created';
            let result;

            if (existingDiscordRecord) {
                // ⭐⭐ UPDATE: المستخدم موجود، نحدث بياناته
                operation = 'updated';

                const updateQuery = `
                    UPDATE discord_verify_steam 
                    SET steam_id = $1,
                        steam_name = $2,
                        steam_profile_url = $3,
                        status = $4,
                        verified_at = $5,
                        added_by = $6,
                        updated_at = CURRENT_TIMESTAMP,
                        verification_code = $7
                    WHERE discord_id = $8
                    RETURNING *
                `;

                const manualCode = `MU-${Date.now().toString(36).toUpperCase().substring(0, 8)}`;
                const verifiedAt = status === 'verified' ? new Date() : (existingDiscordRecord.verified_at || null);

                result = await dbManager.run(updateQuery, [
                    steamId,
                    steamName,
                    steamProfileUrl,
                    status,
                    verifiedAt,
                    addedBy,
                    manualCode,
                    discordId
                ]);

                console.log(`[MANVERIFY] Updated record for user ${discordId} with Steam ID ${steamId}`);

            } else {
                // ⭐⭐ INSERT: المستخدم مش موجود، نضيف جديد
                operation = 'created';

                const insertQuery = `
                    INSERT INTO discord_verify_steam 
                    (discord_id, discord_username, steam_id, steam_profile_url, steam_name, 
                     verification_code, status, verified_at, added_by, updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
                    RETURNING *
                `;

                const manualCode = `MA-${Date.now().toString(36).toUpperCase().substring(0, 8)}`;
                const verifiedAt = status === 'verified' ? new Date() : null;

                result = await dbManager.run(insertQuery, [
                    discordId,
                    discordUsername,
                    steamId,
                    steamProfileUrl,
                    steamName,
                    manualCode,
                    status,
                    verifiedAt,
                    addedBy
                ]);

                console.log(`[MANVERIFY] Created new record for user ${discordId} with Steam ID ${steamId}`);
            }

            if (!result || result.changes === 0) {
                throw new Error(`Failed to ${operation} Steam account record`);
            }

            // جلب السجل بعد العملية
            const newRecord = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE discord_id = $1',
                [discordId]
            );

            if (!newRecord) {
                throw new Error('Could not retrieve the record after operation');
            }

            // ========== إنشاء رسالة النجاح ==========
            const successEmbed = new EmbedBuilder()
                .setTitle(`✅ Steam Account ${operation === 'updated' ? 'Updated' : 'Added'} Successfully`)
                .setColor(process.env.Bluecolor)
                .setThumbnail(steamData?.avatarfull || null)
                .addFields(
                    { name: '👤 Discord User', value: `<@${discordId}>`, inline: true },
                    { name: '🆔 Steam ID', value: `\`${steamId}\``, inline: true },
                    { name: ' ', value: ` `, inline: false },
                    { name: '🎮 Steam Name', value: steamName || 'Not available', inline: true },
                    { name: '✅ Status', value: status, inline: true },
                    { name: '🔗 Profile URL', value: `${steamProfileUrl}`, inline: false },
                    { name: '🔄 Operation', value: operation === 'updated' ? 'Updated existing record' : 'Added new record', inline: true }
                );

            // إضافة الإحصائيات إذا كانت متوفرة
            if (steamStats) {
                successEmbed.addFields({
                    name: '📊 Steam Statistics',
                    value: `• Total Playtime: **${steamStats.totalPlaytime} hours**\n• Games with 10+ achievements: **${eligibleGames.length}/5**\n• Total achievements: **${totalAchievements}**\n• Games checked: **${gamesChecked}**`,
                    inline: false
                });
            }

            // إضافة ملاحظة إذا كان إضافة يدوية رغم عدم استيفاء الشروط
            if (!requirementsMet) {
                successEmbed.addFields({
                    name: '⚠️ Manual Addition',
                    value: 'This account was added manually using moderator override.',
                    inline: false
                });
            }

            successEmbed.addFields({
                name: '📅 Operation Time',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: false
            });

            // إظهار الرتب التي سيتم إعطاؤها فقط إذا كان verified
            if (status === 'verified') {
                successEmbed.addFields({
                    name: 'Roles Assigned',
                    value: `<@&${VERIFIED_ROLE_ID}>\n<@&${VERIFIED_ROLE2_ID}>`,
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [successEmbed] });

            // ========== تسجيل العملية ==========
            await this.logManualAddition(interaction, newRecord, addedBy, steamStats, requirementsMet, 
                eligibleGames, totalAchievements, gamesChecked, steamData, operation);

            // ========== إعطاء الرول إذا كان verified ==========
            if (status === 'verified') {
                await this.assignVerifiedRole(discordId, interaction.guild);
            }

        } catch (error) {
            console.error('Error in manverify command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Manual Operation Failed')
                .setDescription(`Failed to process Steam account: \`${error.message}\``)
                .addFields({
                    name: '🛠️ Common Issues:',
                    value: '• Database connection error\n• Invalid Steam ID format\n• Permission issues\n• Duplicate Steam ID',
                    inline: false
                });
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    },

    // دالة لتسجيل الإضافة اليدوية
    async logManualAddition(interaction, record, addedBy, steamStats, requirementsMet, 
        eligibleGames = [], totalAchievements = 0, gamesChecked = 0, steamData = null, operation = 'created') {
        try {
            if (!VERIFIED_LOG_CHANNEL_ID) {
                console.log('[MANVERIFY] No VERIFIED_LOG_CHANNEL_ID configured');
                return;
            }

            const logChannel = await interaction.client.channels.fetch(VERIFIED_LOG_CHANNEL_ID);
            if (!logChannel) return;

            const logEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle(`✅ │ Manual Steam ${operation === 'updated' ? 'Update' : 'Verification'}`)
                .setThumbnail(steamData ? steamData.avatarfull : null)
                .addFields(
                    { 
                        name: '👤 │ Discord User', 
                        value: `<@${record.discord_id}>`, 
                        inline: true 
                    },
                    { 
                        name: '🆔 │ Discord ID', 
                        value: `\`${record.discord_id}\``, 
                        inline: true 
                    },
                    { 
                        name: ' ', 
                        value: ` `, 
                        inline: false 
                    },
                    { 
                        name: '🎮 │ Steam Name', 
                        value: record.steam_name ? `\`${record.steam_name}\`` : '`Not set`', 
                        inline: true 
                    },
                    { 
                        name: '🆔 │ Steam ID', 
                        value: `\`${record.steam_id}\``, 
                        inline: true 
                    },
                    { 
                        name: ' ', 
                        value: ` `, 
                        inline: false 
                    },
                    { 
                        name: '🔄 │ Operation', 
                        value: operation === 'updated' ? '📝 Updated existing record' : '➕ Added new record', 
                        inline: true 
                    },
                    { 
                        name: '✅ │ Status', 
                        value: record.status, 
                        inline: true 
                    }
                );

            // إضافة الإحصائيات إذا كانت متوفرة
            if (steamStats) {
                logEmbed.addFields({
                    name: '📊 │ Steam Stats',
                    value: `**Playtime:** ${steamStats.totalPlaytime}h\n**Games with 10+ achievements:** ${eligibleGames.length}/5\n**Total achievements:** ${steamStats.totalAchievements}\n**Games checked:** ${gamesChecked}`,
                    inline: true
                });
            }

            logEmbed.addFields({
                name: '🔗 │ Profile URL',
                value: `${record.steam_profile_url}`,
                inline: false
            });

            logEmbed.addFields({
                name: '👨‍💼 │ Moderator',
                value: `<@${addedBy}>`,
                inline: true
            });

            await logChannel.send({ embeds: [logEmbed] });
        } catch (error) {
            console.error('[MANVERIFY] Logging error:', error.message);
        }
    },

    // دالة لإعطاء رول التحقق
    async assignVerifiedRole(userId, guild) {
        try {
            console.log(`[MANVERIFY] Starting role assignment for user ${userId}`);

            const member = await guild.members.fetch(userId);
            if (!member) {
                console.log(`[MANVERIFY] Member ${userId} not found`);
                return;
            }

            console.log(`[MANVERIFY] Found member: ${member.user.tag}`);

            // 1. إزالة رتبة UNVERIFIED إذا كانت موجودة
            if (UNVERIFIED_ROLE_ID) {
                try {
                    const unverifiedRole = await guild.roles.fetch(UNVERIFIED_ROLE_ID);
                    if (unverifiedRole && member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                        await member.roles.remove(unverifiedRole);
                        console.log(`[MANVERIFY] Removed UNVERIFIED role from ${member.user.tag}`);
                    }
                } catch (error) {
                    console.error('[MANVERIFY] Error removing UNVERIFIED role:', error.message);
                }
            }

            // 2. إضافة الرتبة الأولى VERIFIED_ROLE_ID
            if (VERIFIED_ROLE_ID) {
                try {
                    const role1 = await guild.roles.fetch(VERIFIED_ROLE_ID);
                    if (role1 && !member.roles.cache.has(VERIFIED_ROLE_ID)) {
                        await member.roles.add(role1);
                        console.log(`[MANVERIFY] Added first verified role to ${member.user.tag}`);
                        await new Promise(resolve => setTimeout(resolve, 500)); // انتظار 0.5 ثانية
                    }
                } catch (error) {
                    console.error('[MANVERIFY] Error adding first role:', error.message);
                }
            }

            // 3. إضافة الرتبة الثانية VERIFIED_ROLE2_ID
            if (VERIFIED_ROLE2_ID) {
                try {
                    const role2 = await guild.roles.fetch(VERIFIED_ROLE2_ID);
                    if (role2 && !member.roles.cache.has(VERIFIED_ROLE2_ID)) {
                        await member.roles.add(role2);
                        console.log(`[MANVERIFY] Added second verified role to ${member.user.tag}`);
                    }
                } catch (error) {
                    console.error('[MANVERIFY] Error adding second role:', error.message);
                }
            }

            console.log(`[MANVERIFY] Completed role assignment for ${member.user.tag}`);

        } catch (error) {
            console.error('[MANVERIFY] Role assignment error:', error.message);
        }
    },

    // دالة لمعالجة أزرار التحقق
    async buttonHandler(interaction) {
        if (interaction.customId.startsWith('steamadd_force_')) {
            // يتم التعامل مع هذا في awaitMessageComponent في الكود الأساسي
            return;
        }

        if (interaction.customId === 'steamadd_cancel') {
            await interaction.update({
                content: '❌ Manual addition cancelled.',
                embeds: [],
                components: []
            });
        }
    }
};