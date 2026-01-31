const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType
} = require('discord.js');
const dbManager = require('../Data/database');
const axios = require('axios');
const VERIFIED_ROLE_ID = '1385519950919106571';
const UNVERIFIED_ROLE_ID = '1390001642069299280';
const VERIFIED_LOG_CHANNEL_ID = '1390437818530140161';
const ALERT_CHANNEL_ID = '1390437818530140161';

//console.log(`✅ verify.js loaded successfully`);

class RateLimiter {
    constructor(maxTokens, refillTimeMs) {
        this.users = new Map();
        this.maxTokens = maxTokens;
        this.refillTimeMs = refillTimeMs;

        this.cleanupInterval = setInterval(() => this.cleanup(), 3600000);
    }

    checkLimit(userId) {
        const now = Date.now();
        let userData = this.users.get(userId);

        if (!userData) {
            userData = { 
                tokens: this.maxTokens - 1, 
                lastRefill: now,
                resetTime: now + this.refillTimeMs
            };
            this.users.set(userId, userData);
            return { 
                allowed: true, 
                remaining: this.maxTokens - 1,
                resetAfter: Math.ceil(this.refillTimeMs / 1000) // ⬅️ **أضف هذا**
            };
        }

        if (now >= userData.resetTime) {
            userData.tokens = this.maxTokens - 1;
            userData.lastRefill = now;
            userData.resetTime = now + this.refillTimeMs;
            this.users.set(userId, userData);
            return { 
                allowed: true, 
                remaining: this.maxTokens - 1,
                resetAfter: Math.ceil(this.refillTimeMs / 1000) // ⬅️ **أضف هذا**
            };
        }

        if (userData.tokens > 0) {
            userData.tokens--;
            this.users.set(userId, userData);
            const timeLeft = userData.resetTime - now;
            return { 
                allowed: true, 
                remaining: userData.tokens,
                resetAfter: Math.ceil(timeLeft / 1000) // ⬅️ **أضف هذا**
            };
        } else {
            const timeLeft = userData.resetTime - now;
            return { 
                allowed: false, 
                remaining: 0,
                resetAfter: Math.ceil(timeLeft / 1000) // ⬅️ **أضف هذا**
            };
        }
    }

    cleanup() {
        const now = Date.now();
        const hourAgo = now - 3600000;

        for (const [userId, data] of this.users.entries()) {
            if (data.resetTime < hourAgo) {
                this.users.delete(userId);
            }
        }
    }

    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

class VerifyCommand {
    constructor() {
        // ⭐ إنشاء الأمر الرئيسي مع subcommands
        this.data = new SlashCommandBuilder()
            .setName('verify')
            .setDescription('Verification system')
            .setDMPermission(false)

            // Subcommand 1: البدء في التحقق (للمستخدمين) - تم التغيير من start إلى me
            .addSubcommand(subcommand =>
                subcommand
                    .setName('me')
                    .setDescription('Start the verification process')
            )

            // Subcommand 2: إنشاء البانل (للمودريتورز)
            .addSubcommand(subcommand =>
                subcommand
                    .setName('panel')
                    .setDescription('Create verification panel (Moderators only)')
                    .addChannelOption(option =>
                        option
                            .setName('channel')
                            .setDescription('Channel to send panel in')
                            .setRequired(false)
                            .addChannelTypes(ChannelType.GuildText)
                    )
            );

        // ⭐ Rate Limiter للـ Steam API
        this.steamLimiter = {
            requestsThisSecond: 0,
            currentSecond: Math.floor(Date.now() / 1000),
            MAX_PER_SECOND: 10,
            BASE_DELAY: 300,

            async wait() {
                const now = Date.now();
                const sec = Math.floor(now / 1000);

                if (sec !== this.currentSecond) {
                    this.requestsThisSecond = 0;
                    this.currentSecond = sec;
                }

                if (this.requestsThisSecond >= this.MAX_PER_SECOND) {
                    const waitMs = (sec + 1) * 1000 - now;
                    console.log(`[STEAM] Reached limit (${this.MAX_PER_SECOND}/sec), waiting ${waitMs}ms`);
                    await new Promise(r => setTimeout(r, waitMs));

                    this.requestsThisSecond = 0;
                    this.currentSecond = Math.floor(Date.now() / 1000);
                }

                if (this.requestsThisSecond > 0) {
                    await new Promise(r => setTimeout(r, this.BASE_DELAY));
                }

                this.requestsThisSecond++;
                console.log(`[STEAM] Request #${this.requestsThisSecond} in second ${this.currentSecond}`);
            }
        };

        this.limiters = {
            captchaAttempts: new RateLimiter(3, 300000),
            linkSubmissions: new RateLimiter(2, 1800000),
            fullVerifications: new RateLimiter(1, 86400000)
        };

        this.captchaData = new Map();
        this.captchaCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, data] of this.captchaData.entries()) {
                if (now - data.timestamp > 120000) {
                    this.captchaData.delete(id);
                }
            }
        }, 60000);

        this.activeSessions = new Map();
        this.sessionCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [userId, session] of this.activeSessions.entries()) {
                if (now - session.lastActivity > 300000) {
                    this.activeSessions.delete(userId);
                }
            }
        }, 300000);
    }

    destroy() {
        clearInterval(this.captchaCleanupInterval);
        clearInterval(this.sessionCleanupInterval);

        for (const limiter of Object.values(this.limiters)) {
            limiter.destroy();
        }
    }

    updateSession(userId) {
        this.activeSessions.set(userId, {
            lastActivity: Date.now(),
            discordId: userId
        });
    }

    getFutureDate(daysToAdd) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + daysToAdd);
        return futureDate.toLocaleDateString();
    }

    // ⭐ Function to send suspicious attempt alert
    async sendDuplicateAlert(interaction, existingRecord, steamId) {
        try {
            // Use the global ALERT_CHANNEL_ID variable (defined at top)
            const alertChannel = await interaction.client.channels.fetch(ALERT_CHANNEL_ID).catch(() => null);
            if (!alertChannel) {
                console.error('[ALERT] Channel not found:', ALERT_CHANNEL_ID);
                return;
            }

            // Create alert message
            const alertEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('⛔ Suspicious Verification Attempt')
                .addFields(
                    { name: '👤 Current User', value: `<@${interaction.user.id}>`, inline: true },
                    { name: '🆔 Discord ID', value: `\`${interaction.user.id}\``, inline: true },
                    { name: ' ', value: '\u200b', inline: false },
                    { name: '🎮 Linked Steam', value: existingRecord.steam_name ? `\`${existingRecord.steam_name}\`` : '`Unknown`', inline: true },
                    { name: '🆔 Steam ID', value: `\`${existingRecord.steam_id}\``, inline: true },
                    { name: ' ', value: '\u200b', inline: false },
                    { name: '👤 Original Owner', value: existingRecord.discord_id ? `<@${existingRecord.discord_id}>` : '`Not found`', inline: true },
                    { name: '📅 Original Link Date', value: existingRecord.verified_at ? `<t:${Math.floor(new Date(existingRecord.verified_at).getTime() / 1000)}:F>` : '`Unknown`', inline: false }
                )
                .setThumbnail(interaction.user.displayAvatarURL())
                .setFooter({ text: 'Detected an attempt to link an already connected Steam account' });

            // Send alert to channel
            await alertChannel.send({ 
                content: `<@&1363754703648850011>`,
                embeds: [alertEmbed] 
            });
            console.log(`[ALERT] Sent duplicate attempt alert for user ${interaction.user.tag}`);

        } catch (error) {
            console.error('[ALERT] Failed to send alert:', error.message);
        }
    }
    
    // ⭐ التحقق من Moderate Role
    async checkModerateRole(interaction) {
        try {
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return { hasRole: false, embed };
            }

            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            return { 
                hasRole: hasModerateRole, 
                roleName: roleInfo.name,
                roleId: roleInfo.id,
                embed: hasModerateRole ? null : new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setDescription(`This command is available only for <@&${roleInfo.id}>`)
            };

        } catch (error) {
            console.error('Error checking moderate role:', error);
            return { 
                hasRole: false, 
                embed: new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Error Checking Permissions')
                    .setDescription('Error checking permissions.')
            };
        }
    }

    async checkAlreadyVerified(discordId) {
        try {
            // 1. التحقق إذا كان Discord ID مربوط من قبل
            const discordVerified = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE discord_id = $1 AND status = $2',
                [discordId, 'verified']
            );

            if (discordVerified) {
                return {
                    isTaken: true,
                    type: 'discord',
                    record: discordVerified,
                    message: 'Discord account is already linked to a Steam account.'
                };
            }

            return { isTaken: false };
        } catch (error) {
            console.error('[VERIFY] Error checking already verified:', error);
            return { isTaken: false, error: error.message };
        }
    }

    // ⭐ حفظ معلومات البانل
    async savePanelInfo(channelId, messageId) {
        await dbManager.run(
            `INSERT INTO verify_panel_settings 
             (panel_channel_id, panel_message_id) 
             VALUES ($1, $2)
             ON CONFLICT (id) 
             DO UPDATE SET 
                panel_channel_id = EXCLUDED.panel_channel_id,
                panel_message_id = EXCLUDED.panel_message_id,
                updated_at = CURRENT_TIMESTAMP`,
            [channelId, messageId]
        );
    }

    async getPanelInfo() {
        const result = await dbManager.get(
            'SELECT panel_channel_id, panel_message_id FROM verify_panel_settings WHERE id = 1'
        );
        return result;
    }

    // ⭐ إنشاء البانل (للمودريتورز فقط)
    async createPanel(interaction) {
        // التحقق من Moderate Role
        const roleCheck = await this.checkModerateRole(interaction);
        if (!roleCheck.hasRole) {
            return interaction.reply({ 
                embeds: [roleCheck.embed], 
                flags: 64 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        // تحديد القناة
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        // إنشاء الإيمبد
        const embed = new EmbedBuilder()
            .setColor(process.env.Bluecolor)
            .setTitle('🔐 Profile Verification')
            //.setDescription(`**Verify your Steam account to unlock exclusive features and rewards!**`)
            .addFields(
                { 
                    name: '📋 │ Discord Requirements', 
                    value: 
                        '```\n' +
                        '• Account age: 30+ days old\n' +
                        //'• Verified email address\n' +
                        //'• Not in other servers excessively\n' +
                        //'• Good standing (no recent bans)\n' +
                        '```',
                    inline: false
                },
                { 
                    name: '🎮 │ Steam Requirements', 
                    value: 
                        '```\n' +
                        '• Account age: 3+ months old\n' +
                        '• Playtime: 150+ hours\n' +
                        '• Achievements: 50+\n' +
                        '• Profile visibility: Public\n' +
                        '• Real Name field: Visible\n' +
                        '```',
                    inline: false
                },
                /*{
                    name: '⚠️ │ Important Notes',
                    value: '──────────────────────',
                    inline: false
                },*/
                {
                    name: '🔑 │ Code Instructions',
                    value: '```\n• Place the code temporarily in the Steam "Real Name" field\n• The code is temporary for verification only\n• You can remove the code after verification is completed\n```',
                    inline: false
                },
                {
                    name: '⚡ │ Process Time',
                    value: '```\n• Verification takes 10-30 seconds\n```',
                    inline: false
                },
            )
            .setFooter({ 
                text: 'Click "Start Verification" below to begin the process', 
            })

        const button = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('start_verification_panel')
                    .setLabel('Start Verification')
                    .setStyle(ButtonStyle.Secondary)
                    //.setEmoji('🎮')
            );

        try {
            // جلب معلومات البانل القديم
            const panelInfo = await this.getPanelInfo();

            // إذا كان فيه بانل قديم في نفس القناة
            if (panelInfo && panelInfo.panel_channel_id === targetChannel.id) {
                try {
                    // محاولة تحديث الرسالة القديمة
                    const oldMessage = await targetChannel.messages.fetch(panelInfo.panel_message_id);
                    await oldMessage.edit({ 
                        embeds: [embed],
                        components: [button]
                    });

                    await this.savePanelInfo(targetChannel.id, oldMessage.id);

                    await interaction.editReply({
                        content: `✅ Verification panel has been updated in ${targetChannel}!`
                    });

                } catch (error) {
                    // إذا الرسالة القديمة مش موجودة، أنشئ جديدة
                    //console.log('[PANEL] Old message not found, creating new one');
                    const newMessage = await targetChannel.send({ 
                        embeds: [embed],
                        components: [button]
                    });

                    await this.savePanelInfo(targetChannel.id, newMessage.id);
                    await interaction.editReply({
                        content: `✅ New verification panel has been created in ${targetChannel}!`
                    });
                }
            } else {
                // مفيش بانل، أنشئ جديد
                const newMessage = await targetChannel.send({ 
                    embeds: [embed],
                    components: [button]
                });

                await this.savePanelInfo(targetChannel.id, newMessage.id);
                await interaction.editReply({
                    content: `✅ Verification panel has been created in ${targetChannel}!`
                });
            }

        } catch (error) {
            console.error('[PANEL] Error creating panel:', error);
            await interaction.editReply({
                content: '❌ Error creating verification panel. Check bot permissions in the channel.'
            });
        }
    }

    // ⭐ التحقق من عمر حساب Discord (30 يوم)
    async isDiscordAccountOldEnough(userId, client, minDays = 30) {
        try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) {
                console.log(`[VERIFY] Could not fetch user ${userId}, allowing verification`);
                return true;
            }

            const accountAge = Date.now() - user.createdTimestamp;
            const minAge = minDays * 24 * 60 * 60 * 1000;

            const isOldEnough = accountAge >= minAge;

            //console.log(`[VERIFY] Discord account age check for ${userId}:`);
            //console.log(`  - Created: ${new Date(user.createdTimestamp).toLocaleDateString()}`);
            //console.log(`  - Age: ${Math.floor(accountAge / (24 * 60 * 60 * 1000))} days`);
            //console.log(`  - Required: ${minDays} days`);
            //console.log(`  - Result: ${isOldEnough ? 'OLD ENOUGH' : 'TOO NEW'}`);

            return isOldEnough;
        } catch (error) {
            console.error('[VERIFY] Error checking Discord account age:', error);
            return false;
        }
    }

    // ⭐ التحقق من عمر حساب Steam (3 شهور)
    async isSteamAccountOldEnough(steamId, apiKey) {
        await this.steamLimiter.wait();

        try {
            //console.log(`[STEAM] Checking Steam account age for: ${steamId}`);

            const response = await axios.get(
                'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
                {
                    params: { 
                        key: apiKey, 
                        steamids: steamId 
                    },
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Discord-Verification-Bot/1.0'
                    }
                }
            );

            const player = response.data?.response?.players?.[0];
            if (!player) {
                console.log(`[STEAM] Could not fetch player data for ${steamId}`);
                return false;
            }

            // وقت إنشاء الحساب من timecreated
            if (!player.timecreated) {
                console.log(`[STEAM] No creation time available for ${steamId}`);
                return false;
            }

            const steamAccountCreation = player.timecreated * 1000; // تحويل من seconds إلى milliseconds
            const steamAccountAge = Date.now() - steamAccountCreation;

            // 3 شهور = 90 يوم تقريباً
            const minAge = 90 * 24 * 60 * 60 * 1000;
            const isOldEnough = steamAccountAge >= minAge;

            const daysOld = Math.floor(steamAccountAge / (24 * 60 * 60 * 1000));
            const daysNeeded = 90 - daysOld;
            const createdDate = new Date(steamAccountCreation).toLocaleDateString();

            //console.log(`[STEAM] Steam account age check for ${steamId}:`);
            //console.log(`  - Created: ${createdDate}`);
            //console.log(`  - Age: ${daysOld} days`);
            //console.log(`  - Required: 90+ days (3+ months)`);
            //console.log(`  - Result: ${isOldEnough ? 'OLD ENOUGH' : 'TOO NEW'}`);

            return {
                isOldEnough,
                daysOld,
                daysNeeded,
                createdDate,
                steamAccountCreation
            };

        } catch (error) {
            console.error('[STEAM] Error checking Steam account age:', error.message);
            return {
                isOldEnough: false,
                daysOld: 0,
                daysNeeded: 90,
                createdDate: 'Unknown',
                error: error.message
            };
        }
    }

    // ⭐ دالة الحصول على ساعات اللعب والإنجازات
    async getSteamPlaytimeAndAchievements(steamId, apiKey) {
        await this.steamLimiter.wait();

        try {
            // 1. جلب كل الألعاب
            const ownedGamesResponse = await axios.get(
                'https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/',
                {
                    params: { 
                        key: apiKey, 
                        steamid: steamId,
                        include_appinfo: 1,
                        include_played_free_games: 1
                    },
                    timeout: 20000
                }
            );

            const allGames = ownedGamesResponse.data?.response?.games || [];

            // 2. حساب وقت اللعب الكلي
            let totalPlaytimeMinutes = 0;
            allGames.forEach(game => {
                totalPlaytimeMinutes += (game.playtime_forever || 0);
            });

            const totalPlaytimeHours = Math.floor(totalPlaytimeMinutes / 60);

            // 3. ترتيب الألعاب حسب ساعات اللعب (تنازلي)
            const sortedGames = [...allGames]
                .filter(game => (game.playtime_forever || 0) > 180) // ⭐ 3+ ساعات فقط
                .sort((a, b) => b.playtime_forever - a.playtime_forever);

            // 4. البحث عن 5 ألعاب بـ 10+ إنجازات (مع تخطي الألعاب بدون إنجازات)
            const eligibleGames = [];
            let gamesChecked = 0;
            const maxAttempts = 10; // ⭐ أقصى 10 محاولات

            for (const game of sortedGames) {
                if (eligibleGames.length >= 5) break; // وجدنا ما يكفي
                if (gamesChecked >= maxAttempts) break; // وصلنا الحد الأقصى

                gamesChecked++;
                await this.steamLimiter.wait();

                try {
                    const achievementsResponse = await axios.get(
                        'https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/',
                        {
                            params: { 
                                key: apiKey, 
                                steamid: steamId,
                                appid: game.appid
                            },
                            timeout: 8000
                        }
                    );

                    if (achievementsResponse.data?.playerstats?.success === true) {
                        const achievements = achievementsResponse.data.playerstats.achievements || [];
                        const unlocked = achievements.filter(a => a.achieved === 1).length;

                        // ⭐ الشرط: 10+ إنجازات في اللعبة
                        if (unlocked >= 10) {
                            eligibleGames.push({
                                name: game.name,
                                appid: game.appid,
                                achievements: unlocked,
                                totalAchievements: achievements.length,
                                playtimeHours: Math.floor(game.playtime_forever / 60),
                                percentage: Math.round((unlocked / achievements.length) * 100)
                            });
                            console.log(`✅ [STEAM] ${game.name}: ${unlocked} achievements`);
                        } else {
                            console.log(`⚠️ [STEAM] ${game.name}: Only ${unlocked} achievements (needs 10+)`);
                        }
                    } else {
                        // ⭐ اللعبة بدون إنجازات → نتخطاها ونبحث في التالية
                        console.log(`➡️ [STEAM] ${game.name}: No achievements, skipping to next game`);
                        continue;
                    }
                } catch (gameError) {
                    // ⭐ إذا كانت اللعبة بدون إنجازات أو خاصة
                    if (gameError.response?.status === 400) {
                        console.log(`➡️ [STEAM] ${game.name}: No achievements available, skipping`);
                    } else {
                        console.log(`⚠️ [STEAM] ${game.name}: Error - ${gameError.message}, skipping`);
                    }
                    continue; // ⭐ تخطي للعبة التالية
                }
            }

            // 5. النتائج النهائية
            const totalAchievements = eligibleGames.reduce((sum, game) => sum + game.achievements, 0);
            const hasPlaytime = totalPlaytimeHours >= 150;
            const hasAchievements = eligibleGames.length >= 5; // ⭐ 5 ألعاب مختلفة

            console.log(`📊 [VERIFY] Final: ${eligibleGames.length} games, ${totalAchievements} achievements`);

            return {
                totalPlaytime: totalPlaytimeHours,
                totalAchievements: totalAchievements,
                gamesCount: allGames.length,
                hasEnoughPlaytime: hasPlaytime,
                hasEnoughAchievements: hasAchievements,
                eligibleGames: eligibleGames,
                details: {
                    gamesChecked: gamesChecked,
                    gamesWithAchievements: eligibleGames.length,
                    totalGamesOwned: allGames.length,
                    gamesWithPlaytime: sortedGames.length,
                    method: 'smart_skip_no_achievements'
                }
            };

        } catch (error) {
            console.error('[STEAM] Error in smart system:', error.message);
            return {
                totalPlaytime: 0,
                totalAchievements: 0,
                gamesCount: 0,
                hasEnoughPlaytime: false,
                hasEnoughAchievements: false,
                eligibleGames: [],
                error: error.message
            };
        }
    }

    generateCaptcha() {
        const operations = [
            { symbol: '+', min: 5, max: 20 },
            { symbol: '-', min: 10, max: 30 },
            { symbol: '*', min: 2, max: 8 }
        ];

        const op = operations[Math.floor(Math.random() * operations.length)];
        let num1, num2, correctAnswer;

        switch(op.symbol) {
            case '+':
                num1 = Math.floor(Math.random() * (op.max - op.min + 1)) + op.min;
                num2 = Math.floor(Math.random() * (op.max - op.min + 1)) + op.min;
                correctAnswer = num1 + num2;
                break;
            case '-':
                num1 = Math.floor(Math.random() * (op.max - op.min + 1)) + op.min;
                num2 = Math.floor(Math.random() * (op.min - 2 + 1)) + 2;
                if (num1 < num2) [num1, num2] = [num2, num1];
                correctAnswer = num1 - num2;
                break;
            case '*':
                num1 = Math.floor(Math.random() * (op.max - 2 + 1)) + 2;
                num2 = Math.floor(Math.random() * (op.max - 2 + 1)) + 2;
                correctAnswer = num1 * num2;
                break;
        }

        const wrongAnswers = new Set();
        while (wrongAnswers.size < 3) {
            let offset;
            switch(op.symbol) {
                case '+':
                    offset = Math.floor(Math.random() * 6) + 1;
                    if (Math.random() > 0.5) offset = -offset;
                    break;
                case '-':
                    offset = Math.floor(Math.random() * 4) + 1;
                    if (Math.random() > 0.5) offset = -offset;
                    break;
                case '*':
                    offset = Math.floor(Math.random() * 5) + 1;
                    if (Math.random() > 0.5) offset = -offset;
                    break;
            }

            const wrongAnswer = correctAnswer + offset;
            if (wrongAnswer > 0 && wrongAnswer !== correctAnswer) {
                wrongAnswers.add(wrongAnswer);
            }
        }

        const allAnswers = [correctAnswer, ...Array.from(wrongAnswers)];
        const shuffledAnswers = [...allAnswers].sort(() => Math.random() - 0.5);

        const questionId = `${Date.now()}.${Math.random().toString(36).substr(2, 9)}`;

        return {
            question: `${num1} ${op.symbol} ${num2}`,
            correctAnswer: correctAnswer.toString(),
            answers: shuffledAnswers,
            questionId: questionId,
            timestamp: Date.now()
        };
    }

    generateVerificationCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        const prefix = 'GS-';
        const codeLength = 8;

        let code = '';
        for (let i = 0; i < codeLength; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }

        return prefix + code;
    }

    async sendAccountAgeEmbed(interaction, daysOld, daysNeeded, createdDate, accountType = 'Discord') {
        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`⏳ │ Account Age Requirement`)
            .setDescription(`**Your ${accountType} account is too new for verification.**\nDon't worry! Your account will be eligible soon.`)
            .addFields(
                {
                    name: '📈 │ Progress',
                    value: `\`\`\`css\n[${'█'.repeat(Math.min(daysOld, 10))}${'░'.repeat(10 - Math.min(daysOld, 10))}]\n${daysOld}/${accountType === 'Discord' ? '30' : '90'} days completed\n\`\`\``,
                    inline: false
                },
                {
                    name: '📅 │ Timeline',
                    value: [
                        `**Current Age:** ${daysOld} day(s)`,
                        `**Required Age:** ${accountType === 'Discord' ? '30' : '90'} day(s)`,
                        `**Days Remaining:** ${daysNeeded} day(s)`,
                        `**Ready On:** ${createdDate} → **${this.getFutureDate(daysNeeded)}**`
                    ].join('\n'),
                    inline: false
                }
            )
        await interaction.editReply({ embeds: [embed] });
    }

    async sendRateLimitEmbed(interaction, limitData, type = 'command') {
        const typeMessages = {
            'captcha': 'CAPTCHA attempts',
            'link': 'link submissions',
            'verification': 'verification attempts'
        };

        // ⭐ استخدم الدالة الجديدة
        const timeFormatted = this.formatTime(limitData.resetAfter);

        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('⏳ │ Rate Limit Exceeded')
            .setDescription([
                `**Too many ${typeMessages[type]} requests!**`,
                `Please wait before trying again.`
            ].join('\n'))
            .addFields(
                {
                    name: '🔄 │ Cooldown Period',
                    value: `\`\`\`fix\n⏰ ${timeFormatted}\n\`\`\``,
                    inline: false
                },
                /*{
                    name: '📊 │ Usage Status',
                    value: `\`\`\`diff\n- Used: ${limitData.total - limitData.remaining}/${limitData.total}\n+ Remaining: ${limitData.remaining}\n\`\`\``,
                    inline: false
                },*/
            )
            .setFooter({ 
                text: 'Rate limits reset automatically | Please try again later',
            })

        await interaction.editReply({ embeds: [embed] });
    }

        async sendPlaytimeAchievementEmbed(interaction, stats, daysOld, hasAge) {
        const hasPlaytime = stats.totalPlaytime >= 150;
        const hasAchievements = stats.totalAchievements >= 50;

        const embed = new EmbedBuilder()
            .setColor('#8B0000')
            .setTitle('❌ Insufficient Steam Activity')
            .setDescription('Your Steam account does not meet the minimum requirements.')
            .addFields(
                { 
                    name: 'Current Stats', 
                    value: 
                        `• Total Playtime: **${stats.totalPlaytime} hours** / 150 hours ${hasPlaytime ? '✅' : '❌'}\n` +
                        `• Achievements: **${stats.totalAchievements}** / 50 achievements ${hasAchievements ? '✅' : '❌'}\n` +
                        `• Account Age: **${daysOld} days** / 90+ days ${hasAge ? '✅' : '❌'}`,
                    inline: false
                }
            )

        await interaction.editReply({ embeds: [embed] });
    }

    async sendCaptchaEmbed(interaction, captcha) {
        const embed = new EmbedBuilder()
            .setColor(process.env.Bluecolor)
            .setTitle('🔢 │ CAPTCHA Verification')
            .setDescription('**Solve this simple math problem to continue:**')
            .addFields(
                { 
                    name: '🧮 │ Math Problem', 
                    value: `\`\`\`${captcha.question} = ?\`\`\``,
                    inline: false 
                }
            )

        const buttons = [];
        for (let i = 0; i < captcha.answers.length; i++) {
            const answer = captcha.answers[i];
            const isCorrect = answer.toString() === captcha.correctAnswer;

            const buttonId = `captcha_verify,${captcha.questionId},${i},${isCorrect ? '1' : '0'}`;

            buttons.push(
                new ButtonBuilder()
                    .setCustomId(buttonId)
                    .setLabel(answer.toString())
                    .setStyle(ButtonStyle.Secondary)
            );
        }

        const actionRow = new ActionRowBuilder()
            .addComponents(buttons);

        this.captchaData.set(captcha.questionId, {
            question: captcha.question,
            correctAnswer: captcha.correctAnswer,
            answers: captcha.answers,
            discordId: interaction.user.id,
            discordName: interaction.user.username,
            timestamp: Date.now()
        });

        this.updateSession(interaction.user.id);

        await interaction.editReply({ 
            embeds: [embed], 
            components: [actionRow] 
        });
    }

    // ⭐ MAIN EXECUTE
    async execute(interaction) {
        //console.log(`[VERIFY] Command executed by ${interaction.user.tag}`);

        const subcommand = interaction.options.getSubcommand();

        switch(subcommand) {
            case 'me': // تم التغيير من start إلى me
                await this.startVerification(interaction);
                break;

            case 'panel':
                await this.createPanel(interaction);
                break;

            default:
                await interaction.reply({ 
                    content: '❌ Unknown subcommand.', 
                    flags: 64 
                });
        }
    }

    // ⭐ START VERIFICATION (من الكوماند) - تم تحديث الرسالة لتشمل شرط 3 شهور
    async startVerification(interaction) {
        console.log(`[VERIFY] Verification started by ${interaction.user.tag} via COMMAND`);
        await interaction.deferReply({ flags: 64 });

        const discordId = interaction.user.id;
        const discordName = interaction.user.username;

        try {
            this.updateSession(discordId);

            // التحقق من تكرر Discord ID أولاً
            const alreadyVerified = await this.checkAlreadyVerified(discordId);
            if (alreadyVerified.isTaken) {
                const embed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('✅ │ Already Verified')
                    //.setImage(process.env.BlueLine)
                    //.setDescription('**This Discord account is already verified with a Steam account.**')
                    .addFields(
                        { 
                            name: '👤 │ Discord User', 
                            value: `<@${alreadyVerified.record.discord_id}>`,
                            inline: true 
                        },
                        { 
                            name: '🎮 │ Steam ID', 
                            value: `\`${alreadyVerified.record.steam_id || 'Unknown'}\``,
                            inline: true 
                        },
                        { 
                            name: '📅 │ Verification Date', 
                            value: alreadyVerified.record.verified_at ? 
                                `<t:${Math.floor(new Date(alreadyVerified.record.verified_at).getTime() / 1000)}:F>` : 
                                '`Unknown`', 
                            inline: false 
                        }
                    )
                    .setFooter({ text: 'This Discord account is already verified with a Steam account' });

                return await interaction.editReply({ embeds: [embed] });
            }

            // التحقق من عمر حساب Discord (30 يوم)
            const isDiscordOldEnough = await this.isDiscordAccountOldEnough(discordId, interaction.client, 30);

            if (!isDiscordOldEnough) {
                try {
                    const user = await interaction.client.users.fetch(discordId);
                    const accountAge = Date.now() - user.createdTimestamp;
                    const daysOld = Math.floor(accountAge / (24 * 60 * 60 * 1000));
                    const daysNeeded = 30 - daysOld;
                    const createdDate = `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`;

                    return await this.sendAccountAgeEmbed(interaction, daysOld, daysNeeded, createdDate, 'Discord');
                } catch (error) {
                    console.error('[VERIFY] Error fetching user age:', error);

                    const errorEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ Cannot Verify Account')
                        .setDescription('Could not verify your Discord account age.\nPlease contact moderators.')

                    return await interaction.editReply({ embeds: [errorEmbed] });
                }
            }

            const existingRecord = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE discord_id = $1 AND status = $2',
                [discordId, 'verified']
            );

            if (existingRecord) {
                const alreadyVerifiedEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('✅ │ Already Verified')
                    .setImage(process.env.BlueLine)
                    .setDescription('**This Steam account is already verified!**')
                    .addFields(
                        { 
                            name: '👤 │ Discord User', 
                            value: existingRecord.discord_id ? `<@${existingRecord.discord_id}>` : '`Not set`', 
                            inline: true 
                        },
                        { 
                            name: '🎮 │ Steam ID', 
                            value: existingRecord.steam_id ? `\`${existingRecord.steam_id}\`` : '`Not set`', 
                            inline: true 
                        },
                        { 
                            name: '📅 │ Verification Date', 
                            value: existingRecord.verified_at ? 
                                `<t:${Math.floor(new Date(existingRecord.verified_at).getTime() / 1000)}:F>` : 
                                '`Unknown`', 
                            inline: false 
                        }
                    );

                return await interaction.editReply({ embeds: [alreadyVerifiedEmbed] });
            }

            const pendingRecord = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE discord_id = $1 AND status = $2',
                [discordId, 'pending']
            );

            if (pendingRecord) {
                const pendingEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('🔄 | Verification Pending')
                    .setDescription(`You have a pending verification request!`)
                    .addFields(
                        { 
                            name: '🔑 │ Your Verification Code', 
                            value: `\`\`\`${pendingRecord.verification_code || 'ERROR'}\`\`\``,
                            inline: false 
                        },
                        { 
                            name: '📝 │ Next Steps', 
                            value: '```\n1) Add this code to Steam Real Name\n2) Click "Verify Account" button\n3) Paste your Steam profile link\n4) Wait for confirmation (10s - 30s)\n```',
                            inline: false 
                        }
                    )

                const enterLinkButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('verify_enter_link_cmd')
                            .setLabel('Submit Steam Link')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔗')
                    );

                return await interaction.editReply({ 
                    embeds: [pendingEmbed], 
                    components: [enterLinkButton] 
                });
            }

            const captchaLimit = this.limiters.captchaAttempts.checkLimit(discordId);
            if (!captchaLimit.allowed) {
                return await this.sendRateLimitEmbed(interaction, captchaLimit, 'captcha');
            }

            const captcha = this.generateCaptcha();
            await this.sendCaptchaEmbed(interaction, captcha);

        } catch (error) {
            console.error('❌ Error in /verify me command:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ | Verification Error')
                .setDescription('An unexpected error occurred.\nPlease try again later.')
                .addFields(
                    { 
                        name: '⚠️ | Note', 
                        value: 'If this persists, contact server moderators.', 
                        inline: false 
                    }
                )

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    // ⭐ START VERIFICATION FROM PANEL - تم تحديث الرسالة لتشمل شرط 3 شهور
    async startVerificationFromPanel(interaction) {
        console.log(`[VERIFY] Verification started by ${interaction.user.tag} via PANEL`);
        await interaction.deferReply({ flags: 64 });

        const discordId = interaction.user.id;
        const discordName = interaction.user.username;

        try {
            this.updateSession(discordId);

            // التحقق من عمر حساب Discord (30 يوم)
            const isDiscordOldEnough = await this.isDiscordAccountOldEnough(discordId, interaction.client, 30);

            if (!isDiscordOldEnough) {
                try {
                    const user = await interaction.client.users.fetch(discordId);
                    const accountAge = Date.now() - user.createdTimestamp;
                    const daysOld = Math.floor(accountAge / (24 * 60 * 60 * 1000));
                    const daysNeeded = 30 - daysOld;
                    const createdDate = `<t:${Math.floor(user.createdTimestamp / 1000)}:D>`;

                    return await this.sendAccountAgeEmbed(interaction, daysOld, daysNeeded, createdDate, 'Discord');
                } catch (error) {
                    console.error('[VERIFY] Error fetching user age:', error);

                    const errorEmbed = new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ | Cannot Verify Account')
                        .setDescription('Could not verify your Discord account age.\nPlease contact moderators.')

                    return await interaction.editReply({ embeds: [errorEmbed] });
                }
            }

            const existingRecord = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE discord_id = $1 AND status = $2',
                [discordId, 'verified']
            );

            if (existingRecord) {
                const alreadyVerifiedEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('✅ │ Already Verified')
                    .setDescription('**This Steam account is already verified!**')
                    .addFields(
                        { 
                            name: '👤 │ Discord User', 
                            value: existingRecord.discord_id ? `<@${existingRecord.discord_id}>` : '`Not set`', 
                            inline: true 
                        },
                        { 
                            name: '🎮 │ Steam ID', 
                            value: existingRecord.steam_id ? `\`${existingRecord.steam_id}\`` : '`Not set`', 
                            inline: true 
                        },
                        { 
                            name: '📅 │ Verified On', 
                            value: existingRecord.verified_at ? 
                                `<t:${Math.floor(new Date(existingRecord.verified_at).getTime() / 1000)}:F>` : 
                                '`Unknown`', 
                            inline: false 
                        }
                    );

                return await interaction.editReply({ embeds: [alreadyVerifiedEmbed] });
            }

            const pendingRecord = await dbManager.get(
                'SELECT * FROM discord_verify_steam WHERE discord_id = $1 AND status = $2',
                [discordId, 'pending']
            );

            if (pendingRecord) {
                const pendingEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('🔄 │ Verification Pending')
                    .setDescription('**You have a pending verification request!**')
                    .addFields(
                        { 
                            name: '🔑 │ Your Verification Code', 
                            value: `\`\`\`${pendingRecord.verification_code || 'ERROR'}\`\`\``,
                            inline: false 
                        },
                        { 
                            name: '📝 │ Next Steps', 
                            value: '```\n1. Add code to Steam Real Name\n2. Click "Verify Account" button\n3. Paste your Steam profile link\n```',
                            inline: false 
                        },
                        { 
                            name: '⚠️ │ Requirements', 
                            value: '```\nREQUIREMENTS:\n• 3+ months old\n• Public profile\n• Real Name visible\n• 150+ hours\n• 50+ achievements\n```',
                            inline: false 
                        }
                    )
                    .setFooter({ 
                        text: 'Make sure your Steam profile meets all requirements before proceeding' 
                    });

                const enterLinkButton = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('verify_enter_link_panel')
                            .setLabel('Submit Steam Link')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔗')
                    );

                return await interaction.editReply({ 
                    embeds: [pendingEmbed], 
                    components: [enterLinkButton] 
                });
            }

            const captchaLimit = this.limiters.captchaAttempts.checkLimit(discordId);
            if (!captchaLimit.allowed) {
                return await this.sendRateLimitEmbed(interaction, captchaLimit, 'captcha');
            }

            const captcha = this.generateCaptcha();
            await this.sendCaptchaEmbed(interaction, captcha);

        } catch (error) {
            console.error('❌ Error in panel verification start:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ | Verification Error')
                .setDescription('An unexpected error occurred.\nPlease try again later.')
                .addFields(
                    { 
                        name: '⚠️ | Note', 
                        value: 'If this persists, contact server moderators.', 
                        inline: false 
                    }
                )

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    // ⭐ CAPTCHA HANDLER (مشترك)
    async captchaHandler(interaction) {
        //console.log(`🔢 [VERIFY CAPTCHA] Handler called for: ${interaction.customId}`);

        if (!interaction.customId.startsWith('captcha_verify,')) {
            console.log(`❌ [VERIFY CAPTCHA] Not a captcha button`);
            return;
        }

        try {
            await interaction.deferUpdate();

            const parts = interaction.customId.split(',');
            //console.log(`🔢 [VERIFY CAPTCHA] Parts:`, parts);

            if (parts.length !== 4) {
                console.log(`❌ [VERIFY CAPTCHA] Invalid parts length: ${parts.length}`);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | Invalid CAPTCHA')
                    .setDescription('This CAPTCHA is corrupted.')
                    .setFooter({ text: 'Button format error' });

                return await interaction.editReply({ 
                    embeds: [errorEmbed], 
                    components: [] 
                });
            }

            const questionId = parts[1];
            const answerIndex = parseInt(parts[2]);
            const isCorrect = parts[3] === '1';

            //console.log(`🔢 [VERIFY CAPTCHA] Question ID: ${questionId}, Index: ${answerIndex}, Correct: ${isCorrect}`);

            const captchaData = this.captchaData.get(questionId);

            if (!captchaData) {
                console.log(`❌ [VERIFY CAPTCHA] No data found for ID: ${questionId}`);

                const expiredEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⏳ | CAPTCHA Expired')
                    .setDescription('This CAPTCHA has expired.')
                    .setFooter({ text: 'Session timeout | 2 minutes limit' });

                return await interaction.editReply({ 
                    embeds: [expiredEmbed], 
                    components: [] 
                });
            }

            //console.log(`✅ [VERIFY CAPTCHA] Found data for user: ${captchaData.discordName}`);

            if (interaction.user.id !== captchaData.discordId) {
                console.log(`❌ [VERIFY CAPTCHA] User mismatch: ${interaction.user.id} != ${captchaData.discordId}`);

                const wrongUserEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | Access Denied')
                    .setDescription('This CAPTCHA is not for you!')

                return await interaction.editReply({ 
                    embeds: [wrongUserEmbed], 
                    components: [] 
                });
            }

            this.captchaData.delete(questionId);

            if (!isCorrect) {
                console.log(`❌ [VERIFY CAPTCHA] Wrong answer from ${interaction.user.tag}`);

                this.limiters.captchaAttempts.checkLimit(interaction.user.id);

                const wrongEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | Wrong Answer')
                    .setDescription('Incorrect! Please try again.')
                    .addFields(
                        { 
                            name: '📝 | Problem', 
                            value: `\`${captchaData.question}\``, 
                            inline: false 
                        }
                    )

                return await interaction.editReply({ 
                    embeds: [wrongEmbed], 
                    components: [] 
                });
            }

            //console.log(`✅ [VERIFY CAPTCHA] Correct answer from ${interaction.user.tag}`);

            const verifyLimit = this.limiters.fullVerifications.checkLimit(interaction.user.id);
            if (!verifyLimit.allowed) {
                console.log(`⏳ [VERIFY CAPTCHA] Daily limit reached for ${interaction.user.tag}`);

                const limitEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⚠️ │ Daily Limit Reached')
                    .setDescription('**You can only complete verification once per day.**')
                    .addFields(
                        { 
                            name: '⏳ │ Try Again', 
                            value: `\`\`\`fix\nAfter ${this.formatTime(verifyLimit.resetAfter)}\n\`\`\``, // ⬅️ **استخدم الدالة الجديدة**
                            inline: false 
                        }
                    );

                return await interaction.editReply({ 
                    embeds: [limitEmbed], 
                    components: [] 
                });
            }

            const verificationCode = this.generateVerificationCode();
            const discordId = interaction.user.id;
            const discordName = interaction.user.username;

            //console.log(`🔑 [VERIFY CAPTCHA] Generating code for ${discordName}: ${verificationCode}`);

            try {
                await dbManager.run(
                    `INSERT INTO discord_verify_steam 
                    (discord_id, discord_username, verification_code, status, added_by, 
                     steam_profile_url, steam_id, steam_name) 
                    VALUES ($1, $2, $3, $4, $5, 
                            'pending_verification', NULL, NULL)`,
                    [discordId, discordName, verificationCode, 'pending', discordId]
                );

                //console.log(`💾 [VERIFY CAPTCHA] Saved to database for ${discordName}`);

                const verifyEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('✅ │ Verification Started')
                    .setDescription('**Follow these steps to complete your verification:**')
                    .addFields(
                        { 
                            name: '1️⃣ │ Your Verification Code', 
                            value: `\`\`\`${verificationCode}\`\`\``, 
                            inline: false 
                        },
                        { 
                            name: '2️⃣ │ Add Code to Steam', 
                            value: '\n1) Go to Steam profile\n2) Click "Edit Profile"\n3) Paste code in Real Name\n4) Save changes\n', 
                            inline: false 
                        },
                        { 
                            name: '3️⃣ │ Submit Profile Link', 
                            value: 'Click the button below and paste your Steam profile URL', 
                            inline: false 
                        },
                        { 
                            name: '⚠️ │ Requirements', 
                            value: '\n• Profile must be Public\n• Account: 3+ months old\n• Code in Real Name field\n• Case insensitive\n', 
                            inline: false 
                        }
                    )
                    .setFooter({ 
                        text: 'Verification takes 10-30 seconds after submission' 
                    });

                // تحديد أي زر بناءً على مصدر التفاعل
                const isFromPanel = interaction.customId.includes('panel');
                const buttonId = isFromPanel ? 'verify_enter_link_panel' : 'verify_enter_link_cmd';

                const actionRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(buttonId)
                            .setLabel('Submit Steam Link')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔗')
                    );

                return await interaction.editReply({ 
                    embeds: [verifyEmbed], 
                    components: [actionRow] 
                });

            } catch (dbError) {
                console.error('[VERIFY] Database error:', dbError);

                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Database Error')
                    .setDescription('Failed to save verification data.\n`Please try again.`')

                return await interaction.editReply({ 
                    embeds: [errorEmbed], 
                    components: [] 
                });
            }

        } catch (error) {
            console.error('[VERIFY] CAPTCHA handler error:', error);

            try {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ CAPTCHA Error')
                    .setDescription('An error occurred.\n`Please try again.`')

                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ 
                        embeds: [errorEmbed], 
                        components: [] 
                    });
                } else {
                    await interaction.reply({ 
                        embeds: [errorEmbed], 
                        flags: 64 
                    });
                }
            } catch (replyError) {
                console.error('[VERIFY] Could not send error message:', replyError);
            }
        }
    }

    // ⭐ BUTTON HANDLERS (مختلفة للمصدرين)
    async buttonHandler(interaction) {
        const buttonId = interaction.customId;

        if (buttonId === 'start_verification_panel') {
            // الزر من البانل
            await this.startVerificationFromPanel(interaction);
            return;
        }

        if (buttonId === 'verify_enter_link_cmd' || buttonId === 'verify_enter_link_panel') {
            // زر إدخال الرابط (من الكوماند أو البانل)
            await this.showLinkModal(interaction, buttonId);
            return;
        }
    }

    async showLinkModal(interaction, source) {
        try {
            const linkLimit = this.limiters.linkSubmissions.checkLimit(interaction.user.id);
            if (!linkLimit.allowed) {
                // ⭐ أضف deferReply أولاً
                await interaction.deferReply({ ephemeral: true, flags: 64 });

                const timeFormatted = this.formatTime(linkLimit.resetAfter);

                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⏳ │ Too Many Link Submissions')
                    .setDescription('**You have submitted too many Steam profile links.**')
                    .addFields(
                        {
                            name: '🔄 │ Cooldown Period',
                            value: `\`\`\`fix\n⏰ ${timeFormatted}\n\`\`\``,
                            inline: false
                        },
                        {
                            name: '📋 │ What Happened?',
                            value: `\`\`\`fix\nYou can only submit 2 Steam profile links every 30 minutes.\nPlease wait before trying again.\n\`\`\``,
                            inline: false
                        },
                    )
                    .setFooter({ 
                        text: 'This limit prevents spam and ensures fair verification for everyone' 
                    });

                await interaction.editReply({ embeds: [embed] });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId(`verify_modal_${source}`)
                .setTitle('Steam Profile Verification');

            const steamLinkInput = new TextInputBuilder()
                .setCustomId('verify_steam_link')
                .setLabel('Steam profile link')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://steamcommunity.com/profiles/12345678987654321')
                .setRequired(true)
                .setMinLength(40)
                .setMaxLength(120);

            const actionRow = new ActionRowBuilder().addComponents(steamLinkInput);
            modal.addComponents(actionRow);

            await interaction.showModal(modal);

        } catch (error) {
            console.error('[VERIFY] Modal error:', error);

            await interaction.reply({
                content: '❌ Cannot open verification form, try again.',
                flags: 64,
                ephemeral: true
            });
        }
    }

    async modalHandler(interaction) {
        if (!interaction.customId.startsWith('verify_modal_')) return;

        try {
            await interaction.deferReply({ flags: 64 });

            const steamLink = interaction.fields.getTextInputValue('verify_steam_link').trim();
            const discordId = interaction.user.id;

            //console.log(`[VERIFY] Link submitted by ${interaction.user.tag}: ${steamLink.substring(0, 50)}...`);

            if (!steamLink.includes('steamcommunity.com')) {
                const invalidEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | Invalid Link')
                    .setDescription('Please provide a valid Steam community link.')
                    .addFields(
                        { 
                            name: '✅ | Correct Formats:', 
                            value: '```\nhttps://steamcommunity.com/profiles/12345678987654321```', 
                            inline: false 
                        }
                    );

                return await interaction.editReply({ embeds: [invalidEmbed] });
            }

            const steamData = this.extractSteamData(steamLink);
            if (!steamData) {
                const invalidEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | Invalid Link Format')
                    .setDescription('Could not extract Steam ID from the link.')
                    .addFields(
                        { 
                            name: '🔍 | Check your link:', 
                            value: '```\nREQUIREMENTS:\n• Complete Steam profile URL\n• Profile must exist\n• No extra spaces or characters\n• Example: https://steamcommunity.com/profiles/12345678987654321\n```',
                            inline: false 
                        }
                    );

                return await interaction.editReply({ embeds: [invalidEmbed] });
            }

            const pendingRecord = await dbManager.get(
                'SELECT verification_code FROM discord_verify_steam WHERE discord_id = $1 AND status = $2',
                [discordId, 'pending']
            );

            if (!pendingRecord || !pendingRecord.verification_code) {
                const noPendingEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | No Active Verification')
                    .setDescription('Please start verification first.')
                    .addFields(
                        { 
                            name: '📋 │ Steps:', 
                            value: '```\n1) Use /verify me command\n2) Solve CAPTCHA\n3) Get your code\n4) Submit profile link\n```', 
                            inline: false 
                        }
                    );

                return await interaction.editReply({ embeds: [noPendingEmbed] });
            }

            const verificationCode = pendingRecord.verification_code;
            const apiKey = process.env.STEAM_API_KEY;

            if (!apiKey) {
                console.error('[VERIFY] Steam API key not configured');

                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | System Error')
                    .setDescription('Verification system is temporarily unavailable.')

                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            const processingEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('🔍 | Verification in Progress')
                .setDescription('Checking your Steam profile...')
                .addFields(
                    { 
                        name: '⏳ │ Status', 
                        value: '`Processing request`', 
                        inline: true 
                    },
                    { 
                        name: '⏱️ │ Estimated Time', 
                        value: '`2-8 seconds`', 
                        inline: true 
                    }
                )
                .setFooter({ text: 'Please wait...' });

            await interaction.editReply({ embeds: [processingEmbed] });

            await this.processVerification(interaction, discordId, steamLink, verificationCode, steamData, apiKey);

        } catch (error) {
            console.error('[VERIFY] Modal processing error:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ | Processing Error')
                .setDescription('Failed to process your verification request.')
                .addFields(
                    { 
                        name: '🔄 | Try Again', 
                        value: 'Please try submitting your link again.', 
                        inline: false 
                    }
                );

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    extractSteamData(steamLink) {
        try {
            const cleanLink = steamLink.trim().replace(/[<>]/g, '');

            if (!cleanLink.startsWith('https://steamcommunity.com/')) {
                return null;
            }

            if (cleanLink.includes('/profiles/')) {
                const match = cleanLink.match(/\/profiles\/(\d+)/);
                if (match && match[1]) {
                    const id = match[1];
                    if (/^\d{17}$/.test(id)) {
                        return { id, name: null, type: 'profile' };
                    }
                }
            } else if (cleanLink.includes('/id/')) {
                const match = cleanLink.match(/\/id\/([a-zA-Z0-9_-]+)/);
                if (match && match[1]) {
                    const name = match[1];
                    if (name.length >= 2 && name.length <= 32) {
                        return { id: null, name, type: 'vanity' };
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('[VERIFY] Error extracting steam data:', error);
            return null;
        }
    }

    async resolveVanityUrl(vanityName, apiKey) {
        await this.steamLimiter.wait();

        try {
            const response = await axios.get(
                'https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/',
                {
                    params: { 
                        key: apiKey, 
                        vanityurl: vanityName 
                    },
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Discord-Verification-Bot/1.0'
                    }
                }
            );

            if (response.data?.response?.success === 1) {
                return response.data.response.steamid;
            }

            return null;
        } catch (error) {
            console.error('[VERIFY] Vanity URL error:', error.message);
            return null;
        }
    }

    async getSteamProfile(steamId, apiKey) {
        await this.steamLimiter.wait();

        try {
            const response = await axios.get(
                'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/',
                {
                    params: { 
                        key: apiKey, 
                        steamids: steamId 
                    },
                    timeout: 10000,
                    headers: {
                        'User-Agent': 'Discord-Verification-Bot/1.0'
                    }
                }
            );

            const player = response.data?.response?.players?.[0];
            if (!player) return null;

            if (player.communityvisibilitystate !== 3) {
                throw new Error('Profile is not public');
            }

            return player;
        } catch (error) {
            console.error('[VERIFY] Get profile error:', error.message);

            if (error.response?.status === 403) {
                throw new Error('Steam API key invalid or expired');
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Steam API timeout');
            } else {
                throw new Error('Could not fetch Steam profile');
            }
        }
    }

    async checkExistingSteamId(steamId, discordId) {
        try {
            const existing = await dbManager.get(
                `SELECT * FROM discord_verify_steam 
                 WHERE steam_id = $1 
                 AND status = 'verified'
                 AND discord_id != $2`,
                [steamId, discordId]
            );

            return existing;
        } catch (error) {
            console.error('[VERIFY] Error checking existing Steam ID:', error);
            return null;
        }
    }

    async processVerification(interaction, discordId, steamLink, verificationCode, steamData, apiKey) {
        try {
            let steamId = steamData.id;

            if (!steamId && steamData.name) {
                steamId = await this.resolveVanityUrl(steamData.name, apiKey);
                if (!steamId) {
                    throw new Error('Could not resolve Steam profile name. Check your link.');
                }
            }

            // التحقق من عمر حساب Steam (3 شهور)
            //console.log(`[VERIFY] Checking Steam account age for ${steamId}`);
            const steamAgeCheck = await this.isSteamAccountOldEnough(steamId, apiKey);

            if (!steamAgeCheck.isOldEnough) {
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ | Steam Account Too New')
                    .setDescription('Your Steam account must be **3 months (90+ days)** old to verify.')
                    .addFields(
                        { 
                            name: '📅 │ Account Age', 
                            value: `**${steamAgeCheck.daysOld} day(s)**`, 
                            inline: true 
                        },
                        { 
                            name: '🎯 │ Required Age', 
                            value: '**90+ days (3+ months)**', 
                            inline: true 
                        },
                        { 
                            name: '⏳ │ Time Remaining', 
                            value: `**${steamAgeCheck.daysNeeded > 0 ? steamAgeCheck.daysNeeded : 0} day(s)**`, 
                            inline: true 
                        },
                        { 
                            name: '📅 │ Account Created', 
                            value: `\`${steamAgeCheck.createdDate}\``, 
                            inline: false 
                        },
                    );

                return await interaction.editReply({ embeds: [embed] });
            }

            //console.log(`[VERIFY] Steam account age passed: ${steamAgeCheck.daysOld} days old`);

            // التحقق من تكرار Steam ID
            const existingSteamAccount = await this.checkExistingSteamId(steamId, discordId);
            if (existingSteamAccount) {
                // ✅ 1. أولا، إرسال التنبيه للمشرفين في القناة
                await this.sendDuplicateAlert(interaction, existingSteamAccount, steamId);

                // ✅ 2. ثانيا، إخبار المستخدم المحتال بالرفض (كما في كودك السابق)
                const duplicateEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('⚠️ │ Steam Account Already Linked')
                    .setDescription('**This Steam account is already verified with another Discord account**')
                    .addFields(
                        { 
                            name: '📋 │ System Policy', 
                            value: '```\n• One Steam account per Discord account\n• Attempts are logged\n• Moderators are notified\n```', 
                            inline: false 
                        },
                        {
                            name: '🚫 │ Action Taken',
                            value: 'This attempt has been logged and reported to moderators',
                            inline: false
                        }
                    );

                await interaction.editReply({ embeds: [duplicateEmbed] });
                return;
            }

            // جلب بيانات البروفايل
            const profile = await this.getSteamProfile(steamId, apiKey);
            if (!profile) {
                throw new Error('Could not fetch Steam profile. Make sure:\n1. Profile is **Public**\n2. Real Name is set correctly\n3. Steam API is accessible');
            }

            // التحقق من ساعات اللعب والإنجازات
            //console.log(`[VERIFY] Checking playtime and achievements for ${steamId}`);

            const stats = await this.getSteamPlaytimeAndAchievements(steamId, apiKey);

            // ✅ إضافة ✅ و❌ كما طلبت
            const hasPlaytime = stats.totalPlaytime >= 150;
            const hasAchievements = stats.totalAchievements >= 50;

            if (!hasPlaytime || !hasAchievements) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ | Insufficient Steam Activity')
                    .setDescription('Your Steam account does not meet the minimum requirements.')
                    .addFields(
                        { 
                            name: 'Current Stats', 
                            value: 
                                `• Total Playtime: **${stats.totalPlaytime} hours** / 150 hours ${hasPlaytime ? '✅' : '❌'}\n` +
                                `• Achievements: **${stats.totalAchievements}** / 50 achievements ${hasAchievements ? '✅' : '❌'}`,
                            inline: false
                        }
                    )

                return await interaction.editReply({ embeds: [embed] });
            }

            console.log(`[VERIFY] Stats passed: ${stats.totalPlaytime}h playtime, ${stats.totalAchievements} achievements`);

            // التحقق من وجود كود التحقق في Real Name
            const realName = profile.realname || '';
            const normalizedRealName = realName.toLowerCase().replace(/\s+/g, ' ').trim();
            const normalizedCode = verificationCode.toLowerCase();

            //console.log(`[VERIFY] Real Name from Steam API: "${realName}"`);
            //console.log(`[VERIFY] Looking for code: "${verificationCode}" in Real Name`);
            console.log(`[VERIFY] Normalized comparison: "${normalizedRealName}" vs "${normalizedCode}"`);

            if (normalizedRealName !== normalizedCode) {
                throw new Error(
                    `Verification code not found in your Steam profile **Real Name**.\n\n` +
                    `**Code needed:** \`${verificationCode}\`\n\n` +
                    `Make sure:\n` +
                    `1. Code is **exactly** as shown (case insensitive)\n` +
                    `2. Profile is **Public**\n` +
                    `3. Code is in the **Real Name** field (not Nickname)\n` +
                    `4. You saved the changes\n\n` +
                    `Your current Real Name: "${realName || 'Empty'}"`
                );
            }

            // تحديث قاعدة البيانات
            await dbManager.run(
                `UPDATE discord_verify_steam 
                 SET status = 'verified', 
                     verified_at = CURRENT_TIMESTAMP,
                     steam_name = $1,
                     steam_id = $2,
                     steam_profile_url = $3,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE discord_id = $4 AND status = 'pending'`,
                [
                    profile.personaname, 
                    steamId, 
                    profile.profileurl,
                    discordId
                ]
            );

            // إرسال رسالة النجاح
            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('🎉 Verification Complete!')
                .setDescription(`**Congratulations <@${interaction.user.id}>!**`)
                .addFields(
                    { 
                        name: '🎮 Steam Account', 
                        value: `[${profile.personaname}](${profile.profileurl})`, 
                        inline: true 
                    },
                    { 
                        name: '📅 Account Age', 
                        value: `${steamAgeCheck.daysOld} days (${Math.floor(steamAgeCheck.daysOld / 30)} months)`, 
                        inline: true 
                    },
                    { 
                        name: ' ', 
                        value: ` `, 
                        inline: false 
                    },
                    { 
                        name: '⏱️ Total Playtime', 
                        value: `${stats.totalPlaytime} hours`, 
                        inline: true 
                    },
                    { 
                        name: '🏆 Achievements', 
                        value: `${stats.totalAchievements} unlocked`, 
                        inline: true 
                    },
                    { 
                        name: '🎮 Games Owned', 
                        value: `${stats.gamesCount} games`, 
                        inline: false 
                    },
                    { 
                        name: '📅 Verified At', 
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                        inline: true 
                    },
                )
                .setThumbnail(profile.avatarfull);

            await interaction.followUp({ embeds: [successEmbed], flags: 64 });

            // تحديث الرولات
            await this.updateUserRoles(interaction, discordId);

            // تسجيل التحقق
            await this.logVerification(interaction, profile, steamId, stats, steamAgeCheck);

            // تنظيف الجلسة
            this.activeSessions.delete(discordId);

        } catch (error) {
            console.error('[VERIFY] Verification process error:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Verification Failed')
                .setDescription(error.message)
                .addFields(
                    { 
                        name: '🔄 Try Again', 
                        value: '1) Make sure code is in Real Name\n2) Check profile is Public\n3) Ensure account is 3+ months old', 
                        inline: false 
                    }
                );

            await interaction.followUp({ embeds: [errorEmbed], flags: 64 });
        }
    }

    async updateUserRoles(interaction, discordId) {
        try {
            // مصفوفة تحتوي على IDs جميع الرتب المراد إضافتها
            const verifiedRolesToAdd = [
                '1385519950919106571', // الرتبة الأولى
                '1386710923594436639',           // الرتبة الثانية
            ];

            const member = await interaction.guild.members.fetch(discordId).catch(() => null);
            if (!member) return;

            // إزالة رتبة UNVERIFIED إذا كانت موجودة
            if (UNVERIFIED_ROLE_ID) {
                const unverifiedRole = await interaction.guild.roles.fetch(UNVERIFIED_ROLE_ID).catch(() => null);
                if (unverifiedRole && member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                    await member.roles.remove(unverifiedRole).catch(() => {});
                    console.log(`[VERIFY] Removed unverified role from ${member.user.tag}`);
                }
            }

            // إضافة جميع الرتب من المصفوفة
            let addedRolesCount = 0;

            for (const roleId of verifiedRolesToAdd) {
                try {
                    const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
                    if (role && !member.roles.cache.has(roleId)) {
                        await member.roles.add(role).catch(() => {});
                        addedRolesCount++;
                        console.log(`[VERIFY] Added role: ${role.name} to ${member.user.tag}`);
                    }
                } catch (roleError) {
                    console.error(`[VERIFY] Error adding role ${roleId}:`, roleError.message);
                }
            }

            console.log(`[VERIFY] Added ${addedRolesCount} verified roles to ${member.user.tag}`);

        } catch (error) {
            console.error('[VERIFY] Role assignment error:', error.message);
        }
    }

    // أضف هذه الدالة الجديدة
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours} Hours | ${minutes} Minutes`;
        } else if (minutes > 0) {
            return `${minutes} Minutes | ${secs} Seconds`;
        } else {
            return `${secs} Seconds`;
        }
    }

    async logVerification(interaction, profile, steamId, stats, steamAgeCheck) {
        try {
            if (!VERIFIED_LOG_CHANNEL_ID) return;

            const logChannel = await interaction.client.channels.fetch(VERIFIED_LOG_CHANNEL_ID).catch(() => null);
            if (!logChannel) return;

            const embed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('✅ │ Verification completed')
                //.setDescription(`**User:** ${interaction.user.tag} (\`${interaction.user.id}\`)`)
                .addFields(
                    { 
                        name: '👤 │ Discord User', 
                        value: `<@${interaction.user.id}>`, 
                        inline: true 
                    },
                    { 
                        name: '🆔 │ Discord ID', 
                        value: `\`${interaction.user.id}\``, 
                        inline: true 
                    },
                    { 
                        name: ' ', 
                        value: ` `, 
                        inline: false 
                    },
                    { 
                        name: '🎮 │ Steam Name', 
                        value: `\`${profile.personaname}\``, 
                        inline: true 
                    },
                    { 
                        name: '🆔 │ Steam ID', 
                        value: `\`${steamId}\``, 
                        inline: true 
                    },
                    { 
                        name: ' ', 
                        value: ` `, 
                        inline: false 
                    },
                    { 
                        name: '📅 │ Steam Age', 
                        value: `**${steamAgeCheck.daysOld} days**\n(~${Math.floor(steamAgeCheck.daysOld / 30)} months)`, 
                        inline: true 
                    },
                    { 
                        name: '⏱️ │ Playtime', 
                        value: `**${stats.totalPlaytime} hours**`, 
                        inline: true 
                    },
                    { 
                        name: ' ', 
                        value: ` `, 
                        inline: false 
                    },
                    { 
                        name: '🏆 │ Achievements', 
                        value: `**${stats.totalAchievements}**`, 
                        inline: true 
                    },
                    
                    { 
                        name: '🎮 │ Games Owned', 
                        value: `**${stats.gamesCount}**`, 
                        inline: true 
                    },
                    { 
                        name: '🔗 │ Profile URL', 
                        value: `[Steam Profile](${profile.profileurl})`, 
                        inline: false 
                    },
                    { 
                        name: '🕒 │ Verification Time', 
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`, 
                        inline: false 
                    }
                )
                .setThumbnail(profile.avatarfull)

            await logChannel.send({ embeds: [embed] }).catch(() => {});

        } catch (error) {
            console.error('[VERIFY] Logging error:', error.message);
        }
    }
}

// ⭐ Export
module.exports = new VerifyCommand();