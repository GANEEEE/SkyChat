const { Events } = require('discord.js');
const dbManager = require('../Data/database');
const buffSystem = require('../LevelSystem/globalbuffs');
const levelSystem = require('../LevelSystem/levelsystem');

// متغيرات النظام
const voiceUsers = new Map(); // {userId: {userData}}
let globalInterval = null;
let clientReference = null;
let cleanupInterval = null;

// ========== CONFIGURATION ==========
const CONFIG = {
    // التوقيتات
    REWARD_INTERVAL: 1140000, // 19 دقيقة
    CHECK_INTERVAL: 1200000,   // 20 دقيقة
    CLEANUP_INTERVAL: 2460000, // 41 دقيقة

    // قنوات VIP (عدل IDs حسب احتياجك)
    VIP_CHANNEL_IDS: ['1423430294563721306', '1423430261043101777'],

    // إعدادات الـ XP والكوينز
    REWARDS: {
        ACTIVE: {
            MIN_XP: 1,
            MAX_XP: 3,
            MIN_COINS: 1,
            MAX_COINS: 3,
            CRYSTAL_CHANCE: 0.01
        },
        MUTED: {
            MIN_XP: 1,
            MAX_XP: 2,
            MIN_COINS: 1,
            MAX_COINS: 2,
            CRYSTAL_CHANCE: 0
        },
        STREAM: {
            MIN_XP: 2,
            MAX_XP: 3,
            MIN_COINS: 2,
            MAX_COINS: 3,
            CRYSTAL_CHANCE: 0.05
        },
        VIP_BONUSES: {
            XP_MULTIPLIER: 1.1,
            COINS_MULTIPLIER: 1.5,
            CRYSTAL_CHANCE: 0.1,
            STREAM_BONUS_MULTIPLIER: 1.2 // مضاعفة إضافية للستريم في القنوات VIP
        }
    }
};

// أنواع المستخدمين
const UserType = {
    ACTIVE: 'active',
    MUTED: 'muted',
    STREAM: 'stream'
};

// متغير لتتبع المستخدمين الذين وصلوا للحد اليومي
const dailyLimitUsers = new Set();

// ========== VOICE REWARDS CALCULATION ==========

function calculateVoiceReward(userType, isVIP = false) {
    let baseXP, baseCoins, crystalChance;
    let rewardsRange;

    // تحديد نطاق المكافآت حسب نوع المستخدم
    switch(userType) {
        case UserType.ACTIVE:
            rewardsRange = CONFIG.REWARDS.ACTIVE;
            break;
        case UserType.MUTED:
            rewardsRange = CONFIG.REWARDS.MUTED;
            break;
        case UserType.STREAM:
            rewardsRange = CONFIG.REWARDS.STREAM;
            break;
        default:
            rewardsRange = CONFIG.REWARDS.ACTIVE;
    }

    // حساب المكافآت الأساسية
    baseXP = Math.floor(Math.random() * (rewardsRange.MAX_XP - rewardsRange.MIN_XP + 1)) + rewardsRange.MIN_XP;
    baseCoins = Math.floor(Math.random() * (rewardsRange.MAX_COINS - rewardsRange.MIN_COINS + 1)) + rewardsRange.MIN_COINS;
    crystalChance = rewardsRange.CRYSTAL_CHANCE;

    // تطبيق بونصات VIP
    if (isVIP) {
        baseXP = Math.floor(baseXP * CONFIG.REWARDS.VIP_BONUSES.XP_MULTIPLIER);
        baseCoins = Math.floor(baseCoins * CONFIG.REWARDS.VIP_BONUSES.COINS_MULTIPLIER);

        // بونس إضافي للمستخدمين اللي بيعملوا ستريم في قنوات VIP
        if (userType === UserType.STREAM) {
            baseXP = Math.floor(baseXP * CONFIG.REWARDS.VIP_BONUSES.STREAM_BONUS_MULTIPLIER);
            baseCoins = Math.floor(baseCoins * CONFIG.REWARDS.VIP_BONUSES.STREAM_BONUS_MULTIPLIER);
        }

        crystalChance = CONFIG.REWARDS.VIP_BONUSES.CRYSTAL_CHANCE;
    }

    // حساب البلورات
    let crystals = 0;
    if (Math.random() * 100 < crystalChance) {
        crystals = 1;
    }

    return { xp: baseXP, coins: baseCoins, crystals };
}

// ========== USER TRACKING FUNCTIONS ==========

function determineUserType(voiceState) {
    // التحقق من الستريم أولاً (الأولوية العليا)
    if (voiceState.streaming) {
        return UserType.STREAM;
    }

    // ثم التحقق من الميوت/دياف
    if (voiceState.mute || voiceState.selfMute || voiceState.deaf || voiceState.selfDeaf) {
        return UserType.MUTED;
    }

    // إذا لم يكن في حالة ستريم ولا ميوت
    return UserType.ACTIVE;
}

function isVIPChannel(channelId) {
    return CONFIG.VIP_CHANNEL_IDS.includes(channelId);
}

// ========== AUTO-SYNC ON RESTART ==========

async function autoSyncVoiceUsersOnRestart(client) {
    try {
        console.log('🔄 Auto-syncing voice users after restart...');

        let syncedCount = 0;
        let vipSynced = 0;
        let streamSynced = 0;
        const now = Date.now();

        for (const guild of client.guilds.cache.values()) {
            const voiceChannels = guild.channels.cache.filter(ch => ch.isVoiceBased());

            for (const channel of voiceChannels.values()) {
                if (!channel.members || channel.members.size === 0) continue;

                for (const member of channel.members.values()) {
                    if (member.user.bot || !member.voice.channel) continue;

                    const userId = member.id;
                    const username = member.user.username;
                    const channelId = channel.id;
                    const isVIP = isVIPChannel(channelId);
                    const userType = determineUserType(member.voice);

                    if (!voiceUsers.has(userId)) {
                        voiceUsers.set(userId, {
                            userId: userId,
                            username: username,
                            guildId: guild.id,
                            channelId: channelId,
                            userType: userType,
                            isVIP: isVIP,
                            joinTime: now,
                            nextRewardTime: now + CONFIG.REWARD_INTERVAL,
                            rewardsGiven: 0,
                            totalXP: 0,
                            totalCoins: 0,
                            totalCrystals: 0,
                            dailyLimitReached: false,
                            isStreaming: userType === UserType.STREAM
                        });

                        syncedCount++;
                        if (isVIP) vipSynced++;
                        if (userType === UserType.STREAM) streamSynced++;

                        console.log(`➕ Added ${username} from restart (${userType}${isVIP ? ' 🎖️' : ''}${userType === UserType.STREAM ? ' 📡' : ''})`);
                    }
                }
            }
        }

        console.log(`✅ Restart sync completed: ${syncedCount} users added (${vipSynced} VIP, ${streamSynced} Streaming)`);

        return {
            success: true,
            totalUsers: voiceUsers.size,
            newlySynced: syncedCount,
            vipSynced: vipSynced,
            streamSynced: streamSynced
        };

    } catch (error) {
        console.error('❌ Restart sync failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// ========== QUICK VOICE CHECK ==========

async function quickVoiceCheck(client) {
    try {
        console.log('🔍 Quick voice check...');
        let found = 0;
        let streaming = 0;

        for (const guild of client.guilds.cache.values()) {
            const voiceChannels = guild.channels.cache.filter(ch => ch.isVoiceBased());

            for (const channel of voiceChannels.values()) {
                if (channel.members && channel.members.size > 0) {
                    for (const member of channel.members.values()) {
                        if (!member.user.bot && member.voice.channel) {
                            found++;
                            if (member.voice.streaming) streaming++;
                        }
                    }
                }
            }
        }

        console.log(`✅ Quick check: ${found} users in voice channels (${streaming} streaming)`);
        return { found, streaming };

    } catch (error) {
        console.error('Quick check error:', error.message);
        return { found: 0, streaming: 0 };
    }
}

// ========== VOICE EVENT HANDLERS ==========

async function handleVoiceJoin(userId, username, guildId, channelId, voiceState) {
    try {
        const userType = determineUserType(voiceState);
        const isVIP = isVIPChannel(channelId);
        const isStreaming = userType === UserType.STREAM;

        // Console Log عند الدخول مع تفاصيل الحالة
        let statusEmoji = '🎤';
        if (isStreaming) statusEmoji = '📡';
        if (isVIP) statusEmoji = '🎖️';

        console.log(`${statusEmoji} ${username} joined voice (${userType})`);

        if (isVIP && isStreaming) {
            console.log(`🚀 ${username} joined VIP voice with STREAM!`);
        } else if (isVIP) {
            console.log(`🎖️ ${username} joined VIP voice`);
        } else if (isStreaming) {
            console.log(`📡 ${username} started streaming`);
        }

        voiceUsers.set(userId, {
            userId: userId,
            channelId: channelId,
            guildId: guildId,
            userType: userType,
            nextRewardTime: Date.now() + CONFIG.REWARD_INTERVAL,
            joinTime: Date.now(),
            isVIP: isVIP,
            username: username,
            rewardsGiven: 0,
            totalXP: 0,
            totalCoins: 0,
            totalCrystals: 0,
            dailyLimitReached: false,
            isStreaming: isStreaming
        });

        // إزالة المستخدم من قائمة الحد اليومي إذا كان فيها
        if (dailyLimitUsers.has(userId)) {
            dailyLimitUsers.delete(userId);
            console.log(`🔄 ${username} removed from daily limit list`);
        }

    } catch (error) {
        console.error('Error in handleVoiceJoin:', error.message);
    }
}

async function handleVoiceLeave(userId) {
    const userData = voiceUsers.get(userId);
    if (userData) {
        const minutesInVoice = Math.floor((Date.now() - userData.joinTime) / 60000);
        const statusEmoji = userData.isStreaming ? '📡' : '🎤';
        console.log(`${statusEmoji} ${userData.username} left after ${minutesInVoice} minutes`);
        voiceUsers.delete(userId);

        // إزالة المستخدم من قائمة الحد اليومي عند الخروج
        if (dailyLimitUsers.has(userId)) {
            dailyLimitUsers.delete(userId);
        }
    }
}

async function handleVoiceUpdate(userId, newVoiceState) {
    const userData = voiceUsers.get(userId);
    if (!userData) return;

    const newUserType = determineUserType(newVoiceState);
    const wasStreaming = userData.isStreaming;
    const isNowStreaming = newUserType === UserType.STREAM;

    // تحديث حالة المستخدم
    userData.userType = newUserType;
    userData.isStreaming = isNowStreaming;

    voiceUsers.set(userId, userData);

    // إظهار رسالة عند بدء/إيقاف الستريم
    if (wasStreaming !== isNowStreaming) {
        if (isNowStreaming) {
            console.log(`📡 ${userData.username} started streaming`);
        } else {
            console.log(`📡 ${userData.username} stopped streaming`);
        }
    }
}

// ========== REWARDS DISTRIBUTION ==========

async function distributeVoiceRewards() {
    if (voiceUsers.size === 0 || !clientReference) return;

    const now = Date.now();
    let rewardsGiven = 0;
    let dailyLimitReachedCount = 0;
    let streamRewards = 0;
    let vipStreamRewards = 0;

    for (const [userId, userData] of voiceUsers.entries()) {
        // تخطي المستخدمين الذين وصلوا للحد اليومي
        if (dailyLimitUsers.has(userId) || userData.dailyLimitReached) {
            continue;
        }

        if (now >= userData.nextRewardTime) {
            try {
                // حساب المكافآت الأساسية
                const baseReward = calculateVoiceReward(userData.userType, userData.isVIP);

                // جلب الجلدة
                const guild = clientReference.guilds.cache.get(userData.guildId);
                if (!guild) {
                    console.log(`❌ Guild not found for user ${userId}`);
                    continue;
                }

                // تطبيق البافات
                let userBuff = 0;
                let finalReward = { ...baseReward };

                if (buffSystem) {
                    try {
                        userBuff = await buffSystem.getBuff(userId, guild);
                        if (userBuff > 0) {
                            finalReward = buffSystem.applyBuff(finalReward, userBuff);
                        }
                    } catch (buffError) {
                        console.error('❌ Buff system error:', buffError.message);
                    }
                }

                // استخدام LevelSystem
                const levelResult = await levelSystem.processUserRewards(
                    userId,
                    userData.username,
                    finalReward.xp,
                    finalReward.coins,
                    finalReward.crystals,
                    clientReference,
                    guild,
                    'voice',
                    false
                );

                if (levelResult.success) {
                    // تحديث بيانات المستخدم
                    userData.nextRewardTime = now + CONFIG.REWARD_INTERVAL;
                    userData.rewardsGiven++;
                    userData.totalXP += finalReward.xp;
                    userData.totalCoins += finalReward.coins;
                    userData.totalCrystals += finalReward.crystals;
                    voiceUsers.set(userId, userData);

                    // تحديث المهام
                    await dbManager.updateGoalProgress(userId, 'voice_minutes', 5);

                    // تسجيل النتيجة مع إيموجي مناسب
                    let statusEmoji = '🎤';
                    if (userData.isStreaming) {
                        statusEmoji = '📡';
                        streamRewards++;
                        if (userData.isVIP) vipStreamRewards++;
                    } else if (userData.isVIP) {
                        statusEmoji = '🎖️';
                    }

                    const buffText = userBuff > 0 ? `(+${userBuff}%)` : '';
                    console.log(`${statusEmoji}${userData.username}: +${finalReward.xp} XP ${buffText}, +${finalReward.coins} coins`);

                    rewardsGiven++;
                } else if (levelResult.reason === 'Daily limit reached') {
                    // عندما يصل للحد اليومي، نضيفه للقائمة فقط
                    userData.dailyLimitReached = true;
                    dailyLimitUsers.add(userId);
                    voiceUsers.set(userId, userData);

                    // رسالة واحدة فقط
                    console.log(`⚠️ ${userData.username} reached daily limit (will not receive more rewards until reset)`);

                    dailyLimitReachedCount++;
                }

            } catch (error) {
                console.error(`❌ Error giving voice rewards to ${userData.username}:`, error.message);
            }
        }
    }

    if (rewardsGiven > 0) {
        let summary = `✅ Distributed ${rewardsGiven} voice rewards`;
        if (streamRewards > 0) {
            summary += ` (${streamRewards} streaming rewards`;
            if (vipStreamRewards > 0) {
                summary += `, ${vipStreamRewards} VIP streams`;
            }
            summary += `)`;
        }
        console.log(summary);
    }

    if (dailyLimitReachedCount > 0) {
        console.log(`⏸️  ${dailyLimitReachedCount} user(s) reached daily limit (paused until reset)`);
    }
}

// ========== دالة لتفعيل المستخدم بعد Reset اليومي ==========
async function resetUserDailyLimit(userId) {
    const userData = voiceUsers.get(userId);
    if (userData) {
        userData.dailyLimitReached = false;
        voiceUsers.set(userId, userData);
    }

    if (dailyLimitUsers.has(userId)) {
        dailyLimitUsers.delete(userId);
        console.log(`🔄 ${userData?.username || userId} daily limit reset`);
    }
}

// ========== دالة للتحقق من حالة المستخدم ==========
function getUserDailyLimitStatus(userId) {
    const userData = voiceUsers.get(userId);
    if (!userData) return null;

    return {
        username: userData.username,
        dailyLimitReached: userData.dailyLimitReached || dailyLimitUsers.has(userId),
        userType: userData.userType,
        isStreaming: userData.isStreaming,
        isVIP: userData.isVIP,
        rewardsGiven: userData.rewardsGiven,
        totalXP: userData.totalXP,
        totalCoins: userData.totalCoins,
        totalCrystals: userData.totalCrystals
    };
}

// ========== SYSTEM MAINTENANCE ==========

function setupVoiceCleanup(client) {
    if (cleanupInterval) clearInterval(cleanupInterval);

    cleanupInterval = setInterval(() => {
        cleanupDisconnectedUsers();
    }, CONFIG.CLEANUP_INTERVAL);

    console.log('🧹 Voice cleanup system initialized');
}

function cleanupDisconnectedUsers() {
    if (!clientReference) return;

    let cleaned = 0;
    let cleanedStreams = 0;

    for (const [userId, userData] of voiceUsers.entries()) {
        try {
            const guild = clientReference.guilds.cache.get(userData.guildId);
            if (!guild) {
                if (userData.isStreaming) cleanedStreams++;
                voiceUsers.delete(userId);
                if (dailyLimitUsers.has(userId)) dailyLimitUsers.delete(userId);
                cleaned++;
                continue;
            }

            const member = guild.members.cache.get(userId);
            if (!member || !member.voice.channel) {
                if (userData.isStreaming) cleanedStreams++;
                voiceUsers.delete(userId);
                if (dailyLimitUsers.has(userId)) dailyLimitUsers.delete(userId);
                cleaned++;
            }
        } catch (error) {
            if (userData.isStreaming) cleanedStreams++;
            voiceUsers.delete(userId);
            if (dailyLimitUsers.has(userId)) dailyLimitUsers.delete(userId);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        let cleanMsg = `🧹 Cleaned ${cleaned} disconnected voice users`;
        if (cleanedStreams > 0) {
            cleanMsg += ` (${cleanedStreams} streams)`;
        }
        console.log(cleanMsg);
    }
}

// ========== OPTIMIZED INTERVALS ==========

function setupOptimizedIntervals(client) {
    if (globalInterval) clearInterval(globalInterval);

    globalInterval = setInterval(distributeVoiceRewards, CONFIG.CHECK_INTERVAL);

    console.log(`⏱️ Optimized intervals set (${CONFIG.CHECK_INTERVAL/1000}s)`);
}

// ========== ENHANCED SETUP FUNCTION ==========

function setupVoiceSystem(client) {
    console.log('🚀 Starting Enhanced Voice XP System with STREAM support...');
    console.log('='.repeat(40));

    clientReference = client;
    voiceUsers.clear();
    dailyLimitUsers.clear();

    setTimeout(async () => {
        try {
            const quickResult = await quickVoiceCheck(client);

            setTimeout(async () => {
                try {
                    const fullResult = await autoSyncVoiceUsersOnRestart(client);

                    if (fullResult.success && fullResult.newlySynced > 0) {
                        console.log(`🎉 Found ${fullResult.newlySynced} users already in voice channels`);
                        if (fullResult.streamSynced > 0) {
                            console.log(`📡 ${fullResult.streamSynced} users are streaming`);
                        }
                    }
                } catch (fullSyncError) {
                    console.error('Full sync error:', fullSyncError.message);
                }
            }, 5000);

        } catch (quickError) {
            console.error('Quick sync error:', quickError.message);
        }
    }, 3000);

    setupVoiceCleanup(client);

    console.log('🎧 Setting up voice state tracking...');

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.member?.user?.bot) return;

        const userId = newState.id;

        if (!oldState.channelId && newState.channelId) {
            const username = newState.member?.user?.username || 'Unknown';
            const guildId = newState.guild.id;

            await handleVoiceJoin(userId, username, guildId, newState.channelId, newState);
        }
        else if (oldState.channelId && !newState.channelId) {
            await handleVoiceLeave(userId);
        }
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await handleVoiceLeave(userId);

            const username = newState.member?.user?.username || 'Unknown';
            const guildId = newState.guild.id;

            await handleVoiceJoin(userId, username, guildId, newState.channelId, newState);
        }
        else if (oldState.channelId && newState.channelId && oldState.channelId === newState.channelId) {
            await handleVoiceUpdate(userId, newState);
        }
    });

    setTimeout(() => {
        setupOptimizedIntervals(client);
        console.log('✅ System is now running!');

        setTimeout(async () => {
            try {
                const finalCheck = await autoSyncVoiceUsersOnRestart(client);
                if (finalCheck.newlySynced > 0) {
                    console.log(`🔄 Final check: ${finalCheck.newlySynced} new users found`);
                    if (finalCheck.streamSynced > 0) {
                        console.log(`📡 Final check: ${finalCheck.streamSynced} streaming users`);
                    }
                }
            } catch (error) {
                console.error('Final check error:', error.message);
            }
        }, 30000);

    }, 1500);

    console.log('✅ System initialization complete!');
    console.log('='.repeat(40));
}

// ========== HELPER FUNCTIONS ==========

function getVoiceSystemStats() {
    const activeUsers = Array.from(voiceUsers.values());
    const activeCount = activeUsers.filter(u => u.userType === UserType.ACTIVE).length;
    const mutedCount = activeUsers.filter(u => u.userType === UserType.MUTED).length;
    const streamCount = activeUsers.filter(u => u.userType === UserType.STREAM).length;
    const vipCount = activeUsers.filter(u => u.isVIP).length;
    const limitReachedCount = activeUsers.filter(u => u.dailyLimitReached).length;

    let totalXP = 0;
    let totalCoins = 0;
    let totalCrystals = 0;

    for (const user of activeUsers) {
        totalXP += user.totalXP;
        totalCoins += user.totalCoins;
        totalCrystals += user.totalCrystals;
    }

    return {
        totalUsers: activeUsers.length,
        activeUsers: activeCount,
        mutedUsers: mutedCount,
        streamingUsers: streamCount,
        vipUsers: vipCount,
        dailyLimitReached: limitReachedCount,
        rewardsGiven: activeUsers.reduce((sum, u) => sum + u.rewardsGiven, 0),
        totalXP,
        totalCoins,
        totalCrystals,
        rewardRanges: {
            active: CONFIG.REWARDS.ACTIVE,
            muted: CONFIG.REWARDS.MUTED,
            stream: CONFIG.REWARDS.STREAM,
            vipBonuses: CONFIG.REWARDS.VIP_BONUSES
        }
    };
}

function getUserVoiceStats(userId) {
    const userData = voiceUsers.get(userId);
    if (!userData) return null;

    const minutesInVoice = Math.floor((Date.now() - userData.joinTime) / 60000);

    let rewardRange;
    switch(userData.userType) {
        case UserType.ACTIVE:
            rewardRange = CONFIG.REWARDS.ACTIVE;
            break;
        case UserType.MUTED:
            rewardRange = CONFIG.REWARDS.MUTED;
            break;
        case UserType.STREAM:
            rewardRange = CONFIG.REWARDS.STREAM;
            break;
        default:
            rewardRange = CONFIG.REWARDS.ACTIVE;
    }

    return {
        username: userData.username,
        channelId: userData.channelId,
        userType: userData.userType,
        isVIP: userData.isVIP,
        isStreaming: userData.isStreaming,
        dailyLimitReached: userData.dailyLimitReached,
        minutesInVoice,
        rewardsGiven: userData.rewardsGiven,
        totalXP: userData.totalXP,
        totalCoins: userData.totalCoins,
        totalCrystals: userData.totalCrystals,
        nextRewardIn: Math.max(0, userData.nextRewardTime - Date.now()),
        rewardRange: rewardRange
    };
}

// ========== ADMIN FUNCTIONS ==========

function addVIPChannel(channelId, channelName = 'VIP Channel') {
    if (!CONFIG.VIP_CHANNEL_IDS.includes(channelId)) {
        CONFIG.VIP_CHANNEL_IDS.push(channelId);
        console.log(`🎖️ Added VIP channel: ${channelName} (${channelId})`);

        for (const [userId, userData] of voiceUsers.entries()) {
            if (userData.channelId === channelId) {
                userData.isVIP = true;
                voiceUsers.set(userId, userData);
            }
        }

        return true;
    }
    return false;
}

function removeVIPChannel(channelId) {
    const index = CONFIG.VIP_CHANNEL_IDS.indexOf(channelId);
    if (index > -1) {
        CONFIG.VIP_CHANNEL_IDS.splice(index, 1);
        console.log(`🗑️ Removed VIP channel: ${channelId}`);

        for (const [userId, userData] of voiceUsers.entries()) {
            if (userData.channelId === channelId) {
                userData.isVIP = false;
                voiceUsers.set(userId, userData);
            }
        }

        return true;
    }
    return false;
}

function stopVoiceSystem() {
    if (globalInterval) {
        clearInterval(globalInterval);
        globalInterval = null;
    }

    if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
    }

    voiceUsers.clear();
    dailyLimitUsers.clear();
    clientReference = null;

    console.log('⏹️ Voice System stopped');
}

// ========== COMPATIBILITY FUNCTION ==========

function setupVoiceXPTracking(client) {
    console.log('🎧 [Compatibility] Starting Voice XP System (legacy function)...');
    return setupVoiceSystem(client);
}

// ========== EXPORTS ==========
module.exports = {
    setupVoiceSystem,
    setupVoiceXPTracking,
    stopVoiceSystem,

    getVoiceSystemStats,
    getUserVoiceStats,

    voiceUsers: voiceUsers,

    addVIPChannel,
    removeVIPChannel,
    getVIPChannels: () => CONFIG.VIP_CHANNEL_IDS,

    distributeVoiceRewards,
    cleanupDisconnectedUsers,
    autoSyncVoiceUsersOnRestart,

    handleVoiceJoin,
    handleVoiceLeave,
    handleVoiceUpdate,
    quickVoiceCheck,
    setupVoiceCleanup,
    setupOptimizedIntervals,

    // الدوال الجديدة لإدارة الحد اليومي
    resetUserDailyLimit,
    getUserDailyLimitStatus,
    getDailyLimitUsers: () => Array.from(dailyLimitUsers),

    CONFIG,
    UserType,

    getRewardRanges: () => CONFIG.REWARDS
};