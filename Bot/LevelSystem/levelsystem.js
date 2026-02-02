// simpleLevelSystem.js - الكود الكامل والمعدل
const dbManager = require('../Data/database');

class SimpleLevelSystem {
    constructor() {
        this.DAILY_LIMITS = {
            MAX_XP: 500,       // أقصى 500 XP في اليوم
            MAX_COINS: 750     // أقصى 750 عملة في اليوم
        };

        // ⭐ تعديل Level System لبدء من Level 0
        this.levels = [
            { level: 0, xp: 0, roleId: null },
            { level: 1, xp: 250, roleId: "1453692596785254480" },
            { level: 2, xp: 750, roleId: "1465705382658838724" },
            { level: 3, xp: 1500, roleId: "1465705413117739018" },
            { level: 4, xp: 2500, roleId: "1465705447666225383" },
            { level: 5, xp: 5000, roleId: "1465705479123636415" },
            { level: 6, xp: 10000, roleId: "1465705518210224168" },
            { level: 7, xp: 20000, roleId: "1465705556395163851" },
            { level: 8, xp: 35000, roleId: "1465705620689649841" },
            { level: 9, xp: 55000, roleId: "1465705698989179030" },
            { level: 10, xp: 80000, roleId: "1465705733659164915" },
            { level: 11, xp: 110000, roleId: "1465705763069493423" },
            { level: 12, xp: 145000, roleId: "1465705800755445938" },
            { level: 13, xp: 185000, roleId: "1465705829272518894" },
            { level: 14, xp: 230000, roleId: "1465705879004381382" },
            { level: 15, xp: 280000, roleId: "1465785463984886045" }
        ];

        // ⭐ Channel ID للإشعارات
        this.notificationChannelId = '1385514822132830299'; // ضع الـ Channel ID هنا
    }

    // ========== دالة Daily Reset الجديدة ==========
    async checkAndResetDailyLimits(userId = null) {
        try {
            console.log('🔄 Checking daily limits reset...');

            let query;
            let params = [];

            if (userId) {
                // Reset لمستخدم معين
                query = `
                    UPDATE levels 
                    SET xp_earned_today = 0,
                        coins_earned_today = 0,
                        last_daily_earned = CURRENT_TIMESTAMP
                    WHERE user_id = $1 
                    AND (
                        DATE(last_daily_earned) < DATE(CURRENT_TIMESTAMP)
                        OR last_daily_earned IS NULL
                    )
                `;
                params = [userId];
            } else {
                // Reset لكل المستخدمين
                query = `
                    UPDATE levels 
                    SET xp_earned_today = 0,
                        coins_earned_today = 0,
                        last_daily_earned = CURRENT_TIMESTAMP
                    WHERE DATE(last_daily_earned) < DATE(CURRENT_TIMESTAMP)
                    OR last_daily_earned IS NULL
                `;
            }

            const result = await dbManager.run(query, params);

            if (result.changes > 0) {
                console.log(`✅ Reset daily limits for ${result.changes} user(s)`);
                return { 
                    success: true, 
                    resetCount: result.changes,
                    message: `Reset ${result.changes} user(s) daily limits` 
                };
            } else {
                console.log('✅ All users are up to date');
                return { 
                    success: true, 
                    resetCount: 0,
                    message: 'No users needed reset' 
                };
            }

        } catch (error) {
            console.error('❌ Error in checkAndResetDailyLimits:', error);
            return { 
                success: false, 
                error: error.message,
                resetCount: 0 
            };
        }
    }

    // ========== دالة محسنة لتأكد من Reset قبل إضافة المكافآت ==========
    async ensureDailyReset(userId) {
        try {
            const user = await this.getUserFromDB(userId);
            if (!user) return false;

            // إذا كانت last_daily_earned فارغة أو قبل اليوم
            if (!user.last_daily_earned) {
                await dbManager.run(
                    'UPDATE levels SET last_daily_earned = CURRENT_TIMESTAMP WHERE user_id = ?',
                    [userId]
                );
                return true;
            }

            // التحقق إذا مر أكثر من 24 ساعة
            const lastReset = new Date(user.last_daily_earned);
            const now = new Date();
            const diffHours = (now - lastReset) / (1000 * 60 * 60);

            if (diffHours >= 24) {
                await dbManager.run(
                    `UPDATE levels 
                     SET xp_earned_today = 0,
                         coins_earned_today = 0,
                         last_daily_earned = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [userId]
                );
                console.log(`🔄 Auto-reset daily limits for user ${userId}`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('❌ Error in ensureDailyReset:', error);
            return false;
        }
    }

    // ========== دالة مساعدة لجلب بيانات المستخدم ==========
    async getUserFromDB(userId) {
        try {
            const user = await dbManager.get(
                'SELECT * FROM levels WHERE user_id = ?',
                [userId]
            );
            return user;
        } catch (error) {
            console.error('❌ Error getting user from DB:', error);
            return null;
        }
    }

    // ========== دالة processUserRewards المعدلة مع Auto-Reset ==========
    async processUserRewards(userId, username, xpToAdd = 0, coinsToAdd = 0, crystalsToAdd = 0, client = null, guild = null, pointType = null, skipDailyLimits = false) {
        try {
            // 1. التأكد من Reset اليومي أولاً
            await this.ensureDailyReset(userId);

            // 2. التأكد من وجود المستخدم
            await this.ensureUserExists(userId, username);

            // 3. جلب بيانات المستخدم
            const user = await this.getUserFromDB(userId);

            // 4. حساب المكافآت الفعلية (مع الـ Limits)
            let actualXP = xpToAdd;
            let actualCoins = coinsToAdd;
            let xpMultiplier = 1.0;
            let coinsMultiplier = 1.0;

            if (!skipDailyLimits) {
                const xpEarnedToday = user?.xp_earned_today || 0;
                const coinsEarnedToday = user?.coins_earned_today || 0;

                // جلب البافات الفعالة
                const activeBuffs = await dbManager.getUserActiveBuffs(userId);

                for (const buff of activeBuffs) {
                    if (buff.buff_type === 'daily_limit_boost' && buff.multiplier) {
                        xpMultiplier = Math.max(xpMultiplier, buff.multiplier);
                    }
                    if (buff.buff_type === 'coins_limit_boost' && buff.multiplier) {
                        coinsMultiplier = Math.max(coinsMultiplier, buff.multiplier);
                    }
                }

                // تطبيق المضاعفات على الـ Limits
                const effectiveMaxXP = Math.floor(this.DAILY_LIMITS.MAX_XP * xpMultiplier);
                const effectiveMaxCoins = Math.floor(this.DAILY_LIMITS.MAX_COINS * coinsMultiplier);

                // التحقق من الـ Limit
                actualXP = Math.min(
                    xpToAdd,
                    Math.max(0, effectiveMaxXP - xpEarnedToday)
                );

                actualCoins = Math.min(
                    coinsToAdd,
                    Math.max(0, effectiveMaxCoins - coinsEarnedToday)
                );

                // إذا وصل للحد
                if (actualXP <= 0 && actualCoins <= 0) {
                    console.log(`⚠️ ${username} reached daily limit`);
                    return { 
                        success: false, 
                        reason: 'Daily limit reached',
                        limits: {
                            xpEarnedToday: xpEarnedToday,
                            coinsEarnedToday: coinsEarnedToday,
                            maxXP: effectiveMaxXP,
                            maxCoins: effectiveMaxCoins,
                            multipliers: { xp: xpMultiplier, coins: coinsMultiplier }
                        }
                    };
                }
            }

            // 5. حساب Points
            let chatPointsToAdd = 0;
            let voicePointsToAdd = 0;
            let reactionPointsToAdd = 0;

            if (pointType === 'chat') chatPointsToAdd = actualXP;
            if (pointType === 'voice') voicePointsToAdd = actualXP;
            if (pointType === 'reaction') reactionPointsToAdd = actualXP;

            // 6. حساب القيم الجديدة
            const newXP = (user?.xp || 0) + actualXP;
            const newCoins = (user?.sky_coins || 0) + actualCoins;
            const newCrystals = (user?.sky_crystals || 0) + crystalsToAdd;
            const newLevel = this.calculateLevel(newXP);
            const oldLevel = user?.level || 0;
            const levelUp = newLevel > oldLevel;

            // 7. تحديث الداتابيز
            if (!skipDailyLimits) {
                await dbManager.run(
                    `UPDATE levels 
                     SET xp = xp + ?,
                         sky_coins = sky_coins + ?,
                         sky_crystals = sky_crystals + ?,
                         xp_earned_today = xp_earned_today + ?,
                         coins_earned_today = coins_earned_today + ?,
                         chat_points = COALESCE(chat_points, 0) + ?,
                         voice_points = COALESCE(voice_points, 0) + ?,
                         reaction_points = COALESCE(reaction_points, 0) + ?,
                         level = ?,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [
                        actualXP, 
                        actualCoins, 
                        crystalsToAdd, 
                        actualXP, 
                        actualCoins,
                        chatPointsToAdd,
                        voicePointsToAdd,
                        reactionPointsToAdd,
                        newLevel, 
                        userId
                    ]
                );
            } else {
                await dbManager.run(
                    `UPDATE levels 
                     SET xp = xp + ?,
                         sky_coins = sky_coins + ?,
                         sky_crystals = sky_crystals + ?,
                         chat_points = COALESCE(chat_points, 0) + ?,
                         voice_points = COALESCE(voice_points, 0) + ?,
                         reaction_points = COALESCE(reaction_points, 0) + ?,
                         level = ?,
                         updated_at = CURRENT_TIMESTAMP
                     WHERE user_id = ?`,
                    [
                        actualXP, 
                        actualCoins, 
                        crystalsToAdd,
                        chatPointsToAdd,
                        voicePointsToAdd,
                        reactionPointsToAdd,
                        newLevel, 
                        userId
                    ]
                );
            }

            // 8. الرولات وإشعارات Level Up
            if (levelUp && guild) {
                await this.handleLevelUp(userId, username, oldLevel, newLevel, client, guild);
            }

            // 9. إرجاع النتيجة
            return {
                success: true,
                xp: actualXP,
                coins: actualCoins,
                crystals: crystalsToAdd,
                levelUp: levelUp,
                oldLevel: oldLevel,
                newLevel: newLevel,
                pointsAdded: {
                    chat: chatPointsToAdd,
                    voice: voicePointsToAdd,
                    reaction: reactionPointsToAdd
                },
                multipliers: {
                    xp: xpMultiplier,
                    coins: coinsMultiplier
                },
                dailyLimitsInfo: skipDailyLimits ? null : {
                    xpEarnedToday: (user?.xp_earned_today || 0) + actualXP,
                    coinsEarnedToday: (user?.coins_earned_today || 0) + actualCoins,
                    maxXP: this.DAILY_LIMITS.MAX_XP * xpMultiplier,
                    maxCoins: this.DAILY_LIMITS.MAX_COINS * coinsMultiplier
                }
            };

        } catch (error) {
            console.error(`❌ Level system error for ${username}:`, error);
            return { success: false, error: error.message };
        }
    }

    // ========== دالة handleLevelUp المعدلة ==========
    async handleLevelUp(userId, username, oldLevel, newLevel, client, guild) {
        try {
            const newLevelData = this.levels.find(l => l.level === newLevel);

            // إضافة الرول
            if (newLevelData?.roleId) {
                await this.addRoleToUser(guild, userId, newLevelData.roleId);
                console.log(`🎖️ Added level ${newLevel} role to ${username}`);
            }

            // إرسال إشعار
            if (client) {
                await this.sendLevelUpNotification(client, userId, username, oldLevel, newLevel);
            }

            return true;
        } catch (error) {
            console.error(`❌ Error in handleLevelUp:`, error);
            return false;
        }
    }

    // ========== باقي الدوال كما هي (مع تعديلات بسيطة) ==========

    // ⭐ دالة تأكد وجود المستخدم
    async ensureUserExists(userId, username) {
        try {
            const user = await this.getUserFromDB(userId);

            if (!user) {
                await dbManager.run(
                    `INSERT INTO levels (user_id, username, level, xp, sky_coins, sky_crystals) 
                     VALUES (?, ?, 0, 0, 0, 0)`,
                    [userId, username]
                );
                console.log(`👤 Created new user: ${username} (${userId})`);
                return { created: true };
            }

            // تحديث الاسم إذا تغير
            if (user.username !== username) {
                await dbManager.run(
                    'UPDATE levels SET username = ? WHERE user_id = ?',
                    [username, userId]
                );
                console.log(`✏️ Updated username: ${user.username} → ${username}`);
            }

            return { created: false, user: user };
        } catch (error) {
            console.error('❌ Failed to ensure user exists:', error);
            return { created: false, error: error.message };
        }
    }

    // ⭐ دالة لإضافة الـ Role
    async addRoleToUser(guild, userId, roleId) {
        try {
            if (!roleId) return true;

            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) return false;

            const role = await guild.roles.fetch(roleId).catch(() => null);
            if (!role) return false;

            await member.roles.add(role);
            console.log(`✅ Added role ${role.name} to ${member.user.tag}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to add role to ${userId}:`, error.message);
            return false;
        }
    }

    // ⭐ دالة إرسال إشعار Level Up
    async sendLevelUpNotification(client, userId, username, oldLevel, newLevel) {
        try {
            const channel = await client.channels.fetch(this.notificationChannelId).catch(() => null);
            if (!channel) {
                console.log(`⚠️ Notification channel not found: ${this.notificationChannelId}`);
                return false;
            }

            const isFirstLevelUp = oldLevel === 0 && newLevel === 1;
            const levelData = this.levels.find(l => l.level === newLevel);
            const nextLevelData = this.levels.find(l => l.level === newLevel + 1);

            let messageContent;
            if (isFirstLevelUp) {
                messageContent = `## 🎊 **FIRST LEVEL UP!** 🎊\n\n` +
                    `**${username}** has reached their first level!\n` +
                    `**Level ${oldLevel} → Level ${newLevel}**\n\n` +
                    (levelData?.roleId ? `🎖️ **First Role Unlocked!**\n` : '') +
                    (nextLevelData ? `🎯 **Next Level:** ${nextLevelData.xp} XP needed\n` : '') +
                    `\n-# *Welcome to the leveling journey!*`;
            } else {
                messageContent = `## 🎉 **LEVEL UP!** 🎉\n\n` +
                    `**${username}** just leveled up!\n` +
                    `**${oldLevel} → ${newLevel}**\n\n` +
                    (levelData?.roleId ? `🎖️ **New Role Unlocked!**\n` : '') +
                    (nextLevelData ? `🎯 **Next Level:** ${nextLevelData.xp} XP needed\n` : '🎉 **Max Level Reached!**\n') +
                    `\n-# *Keep chatting to level up more!*`;
            }

            await channel.send({
                content: `<@${userId}>`,
                embeds: [{
                    color: isFirstLevelUp ? 0x0073ff : 0x0073ff,
                    title: isFirstLevelUp ? '🎊 First Level Achieved!' : '🎉 Level Up Achievement!',
                    description: messageContent
                }]
            });

            console.log(`📢 Sent level up notification for ${username} (Lv${oldLevel}→Lv${newLevel})`);
            return true;
        } catch (error) {
            console.error('❌ Failed to send level up notification:', error.message);
            return false;
        }
    }

    // ⭐ دالة حساب الـ Level
    calculateLevel(xp) {
        for (let i = this.levels.length - 1; i >= 0; i--) {
            if (xp >= this.levels[i].xp) {
                return this.levels[i].level;
            }
        }
        return 0;
    }

    // ⭐ دالة لتعيين الـ Channel ID
    setNotificationChannel(channelId) {
        this.notificationChannelId = channelId;
        console.log(`📢 Set notification channel to: ${channelId}`);
        return true;
    }

    // ⭐ دالة لتعيين الـ Role IDs
    setLevelRole(level, roleId) {
        if (level === 0) {
            console.log(`⚠️ Level 0 cannot have a role`);
            return false;
        }

        const levelData = this.levels.find(l => l.level === level);
        if (levelData) {
            levelData.roleId = roleId;
            console.log(`🎖️ Set role for level ${level} to: ${roleId}`);
            return true;
        }
        return false;
    }

    // ⭐ دالة لجلب معلومات المستخدم
    async getUserInfo(userId, guild = null) {
        const user = await this.getUserFromDB(userId);
        if (!user) return null;

        const currentLevel = user.level || 0;
        const currentXP = user.xp || 0;
        const nextLevel = this.getNextLevelInfo(currentLevel, currentXP);

        // جلب معلومات الرول
        let currentRole = null;
        if (guild && currentLevel > 0) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                const levelData = this.levels.find(l => l.level === currentLevel);
                if (levelData?.roleId && member.roles.cache.has(levelData.roleId)) {
                    const role = await guild.roles.fetch(levelData.roleId);
                    currentRole = role ? { id: role.id, name: role.name } : null;
                }
            }
        }

        // جلب الـ daily limits المتبقية
        const remainingXP = Math.max(0, this.DAILY_LIMITS.MAX_XP - (user.xp_earned_today || 0));
        const remainingCoins = Math.max(0, this.DAILY_LIMITS.MAX_COINS - (user.coins_earned_today || 0));

        return {
            level: currentLevel,
            xp: currentXP,
            coins: user.sky_coins || 0,
            crystals: user.sky_crystals || 0,
            currentRole: currentRole,
            nextLevel: nextLevel,
            dailyLimits: {
                earnedToday: {
                    xp: user.xp_earned_today || 0,
                    coins: user.coins_earned_today || 0
                },
                remaining: {
                    xp: remainingXP,
                    coins: remainingCoins
                },
                max: {
                    xp: this.DAILY_LIMITS.MAX_XP,
                    coins: this.DAILY_LIMITS.MAX_COINS
                },
                lastReset: user.last_daily_earned || null
            }
        };
    }

    // ⭐ معلومات الـ Level القادم
    getNextLevelInfo(currentLevel, currentXP) {
        if (currentLevel >= 15) {
            return { level: 15, xpNeeded: 0, xpProgress: 100 };
        }

        const currentLevelData = this.levels.find(l => l.level === currentLevel);
        const nextLevelData = this.levels.find(l => l.level === currentLevel + 1);

        if (!currentLevelData || !nextLevelData) {
            return { level: currentLevel, xpNeeded: 0, xpProgress: 100 };
        }

        const xpForCurrent = currentLevelData.xp;
        const xpForNext = nextLevelData.xp;
        const xpNeeded = xpForNext - currentXP;
        const xpProgress = ((currentXP - xpForCurrent) / (xpForNext - xpForCurrent)) * 100;

        return {
            level: nextLevelData.level,
            xpNeeded: xpNeeded,
            xpProgress: Math.min(100, Math.max(0, xpProgress)),
            roleId: nextLevelData.roleId
        };
    }

    // ⭐ دالة للحصول على جميع الـ Levels
    getAllLevelsInfo() {
        return this.levels.map(level => ({
            level: level.level,
            xpRequired: level.xp,
            roleId: level.roleId,
            roleName: level.roleId ? `Role for Level ${level.level}` : 
                     level.level === 0 ? 'New Member - No Role' : 'No Role'
        }));
    }

    // ⭐⭐ دالة جديدة: جلب الليمتس الفعالة مع البافات
    async getEffectiveDailyLimits(userId) {
        try {
            const baseLimits = this.DAILY_LIMITS;
            const activeBuffs = await dbManager.getUserActiveBuffs(userId);

            let xpMultiplier = 1.0;
            let coinsMultiplier = 1.0;

            for (const buff of activeBuffs) {
                if (buff.buff_type === 'daily_limit_boost' && buff.multiplier) {
                    xpMultiplier = Math.max(xpMultiplier, buff.multiplier);
                }
                if (buff.buff_type === 'coins_limit_boost' && buff.multiplier) {
                    coinsMultiplier = Math.max(coinsMultiplier, buff.multiplier);
                }
            }

            return {
                MAX_XP: Math.floor(baseLimits.MAX_XP * xpMultiplier),
                MAX_COINS: Math.floor(baseLimits.MAX_COINS * coinsMultiplier),
                multipliers: {
                    xp: xpMultiplier,
                    coins: coinsMultiplier
                },
                baseLimits: baseLimits,
                hasBoosts: xpMultiplier > 1.0 || coinsMultiplier > 1.0
            };
        } catch (error) {
            console.error('❌ Error getting effective limits:', error);
            return this.DAILY_LIMITS;
        }
    }

    // ⭐⭐ دالة جديدة: جلب الليمتس الحالية
    getCurrentDailyLimits() {
        return { ...this.DAILY_LIMITS };
    }
}

// Export instance
const levelSystem = new SimpleLevelSystem();
module.exports = levelSystem;