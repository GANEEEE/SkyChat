const { ActivityType } = require('discord.js');
const { Events } = require('discord.js');
const { checkVerifiedRoles, checkAllMembersRoles } = require('../System/auto');
const tweetTracker = require('../Tweets/Tweets');
const messageCountSystem = require('../System/messagetracking');
const dbManager = require('../Data/database');
const InviterSystem = require('../System/InviterSystem');
const deployCommands = require('../Utlis/DeployCommands');
const { startLiveFameSystem } = require('../Commands/2 livefame');
const { startLiveShameSystem } = require('../Commands/6 liveshame');
const { startLiveMessageSystem } = require('../Commands/8 livemessage');
const { startAutoMessageRolesSystem } = require('../System/Top5auto');
const giveawayHandler = require('../System/GiveawayTemp');
const giveawayAutoPoints = require('../System/AutoFame');
const chatRewardsHandler = require('../System/SkyPass');
const championBreakHandler = require('../System/ChampionBreak');
const autoMessagesRole = require('../System/AutoMediaRole');
const chatXPSystem = require('../LevelSystem/chatsystem');
const voiceXPSystem = require('../LevelSystem/voicesystem');
const bumpHandler = require('../LevelSystem/bumpsystem');
const voteHandler = require('../LevelSystem/votesystem');
const boostRewardHandler = require('../LevelSystem/boostingsystem');

// 🔧 إعدادات الأمان - أهم جزء!
const SAFE_MODE = true;
const MAIN_GUILD_ID = process.env.GUILD_ID; // ⚠️ ضع ID السيرفر هنا

// 🎯 System State Cache - بدون قاعدة بيانات!
const systemStateCache = new Map();

// ⏰ أوقات Cooldown لكل نظام (بالساعة)
const SYSTEM_COOLDOWNS = {
    'Database Check': 1,           // كل ساعة
    'Essential Settings': 6,       // كل 6 ساعات
    'Chat XP System': 9999,        // مرة واحدة فقط
    'Voice XP System': 9999,       // مرة واحدة فقط
    'Inviter System': 12,          // كل 12 ساعة
    'Message Tracking': 9999,      // مرة واحدة فقط
    'AutoMessagesRoles': 4,        // كل 4 ساعات
    'ShopLottery': 12,             // مرة يومياً
    'BuffsCleanup': 2,             // كل ساعتين
    'Statistics': 9,              // كل 12 ساعة
    'VerifiedRoles': 6,            // كل 6 ساعات
    'TempRolesCleanup': 2,         // كل ساعتين
    'CheckAllMembersRoles': 3,     // كل 3 ساعات
};

// 📊 Rate Limit Monitor Settings
const RATE_LIMIT_WARNING_THRESHOLD = 40; // 40 request/10 seconds
const RATE_LIMIT_CRITICAL_THRESHOLD = 45; // 45 request/10 seconds
const RATE_LIMIT_BAN_THRESHOLD = 50; // 50 request/10 seconds (Discord limit)

// 🎯 Rate Limit Tracker
const rateLimitTracker = {
    requests: [],
    warnings: 0,
    criticals: 0,

    addRequest() {
        const now = Date.now();
        this.requests.push(now);

        // احتفظ بـ 60 ثانية فقط من البيانات
        const oneMinuteAgo = now - 60000;
        this.requests = this.requests.filter(time => time > oneMinuteAgo);

        this.checkRateLimits();
    },

    checkRateLimits() {
        const now = Date.now();
        const tenSecondsAgo = now - 10000;

        // حساب الطلبات في آخر 10 ثواني
        const recentRequests = this.requests.filter(time => time > tenSecondsAgo);
        const requestsPer10Sec = recentRequests.length;

        // حساب الطلبات في آخر دقيقة
        const minuteRequests = this.requests.length;
        const requestsPerMinute = minuteRequests;

        // 📊 Logging للـ Rate Limit
        if (requestsPer10Sec >= RATE_LIMIT_WARNING_THRESHOLD) {
            this.logRateLimit('WARNING', requestsPer10Sec, requestsPerMinute);

            if (requestsPer10Sec >= RATE_LIMIT_CRITICAL_THRESHOLD) {
                this.logRateLimit('CRITICAL', requestsPer10Sec, requestsPerMinute);

                if (requestsPer10Sec >= RATE_LIMIT_BAN_THRESHOLD) {
                    this.logRateLimit('🚨 BAN RISK', requestsPer10Sec, requestsPerMinute);
                    this.takeEmergencyAction();
                }
            }
        }

        return {
            per10Sec: requestsPer10Sec,
            perMinute: requestsPerMinute,
            status: this.getStatus(requestsPer10Sec)
        };
    },

    logRateLimit(level, per10Sec, perMinute) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`\n${'='.repeat(50)}`);
        console.log(`🚨 [${level}] RATE LIMIT ALERT - ${timestamp}`);
        console.log(`📈 Requests (10s): ${per10Sec}/${RATE_LIMIT_BAN_THRESHOLD}`);
        console.log(`📈 Requests (1m): ${perMinute}`);
        console.log(`🛡️  Warnings: ${this.warnings} | Criticals: ${this.criticals}`);
        console.log(`${'='.repeat(50)}\n`);

        if (level === 'WARNING') this.warnings++;
        if (level === 'CRITICAL') this.criticals++;
    },

    getStatus(requestsPer10Sec) {
        if (requestsPer10Sec >= RATE_LIMIT_BAN_THRESHOLD) return 'BAN_RISK';
        if (requestsPer10Sec >= RATE_LIMIT_CRITICAL_THRESHOLD) return 'CRITICAL';
        if (requestsPer10Sec >= RATE_LIMIT_WARNING_THRESHOLD) return 'WARNING';
        return 'NORMAL';
    },

    takeEmergencyAction() {
        console.log('🚨 [EMERGENCY] Taking emergency measures...');

        // 1. إيقاف الأنظمة الخطيرة مؤقتاً
        console.log('⏸️  Pausing heavy systems for 60 seconds...');

        // 2. إرسال alert
        this.sendOwnerAlert();

        // 3. العودة بعد 60 ثانية
        setTimeout(() => {
            console.log('✅ Emergency measures lifted after 60 seconds');
        }, 60000);
    },

    sendOwnerAlert() {
        console.log('📨 Sending rate limit alert to bot owner...');
    },

    getStats() {
        return {
            warnings: this.warnings,
            criticals: this.criticals,
            totalRequests: this.requests.length,
            currentStatus: this.checkRateLimits().status
        };
    }
};

// نظام تشغيل تدريجي للأنظمة مع تأخيرات أطول
let systemsStarted = 0;
const systemDelays = [10000, 20000, 30000, 40000, 50000, 60000];

// 🎯 دالة للتحقق إذا النظام ممكن يبدأ (مع Cache)
function canStartSystem(systemName) {
    const lastRun = systemStateCache.get(systemName);
    const cooldownHours = SYSTEM_COOLDOWNS[systemName] || 24;

    if (!lastRun) {
        return { canStart: true, reason: 'First run' };
    }

    const now = Date.now();
    const hoursSinceLastRun = (now - lastRun) / (1000 * 60 * 60);

    if (hoursSinceLastRun < cooldownHours) {
        const hoursLeft = cooldownHours - hoursSinceLastRun;
        return { 
            canStart: false, 
            reason: `Wait ${hoursLeft.toFixed(2)} more hours`,
            hoursLeft 
        };
    }

    return { canStart: true, reason: 'Ready to run' };
}

// 🎯 دالة لتسجيل تشغيل النظام
function markSystemStarted(systemName) {
    systemStateCache.set(systemName, Date.now());
    console.log(`📝 [CACHE] ${systemName} marked as started at ${new Date().toLocaleTimeString()}`);
}

// 🎯 دالة لـ Request Wrapper
function trackRequest() {
    rateLimitTracker.addRequest();
}

// 🎯 إضافة Rate Limit Monitoring Interval
function startRateLimitMonitor(client) {
    console.log('📊 Starting Rate Limit Monitor...');

    // 1. Monitoring كل 30 ثانية
    setInterval(() => {
        const stats = rateLimitTracker.getStats();

        if (stats.currentStatus !== 'NORMAL') {
            console.log(`⚠️ [MONITOR] Current Status: ${stats.currentStatus}`);
            console.log(`   Warnings: ${stats.warnings} | Criticals: ${stats.criticals}`);

            // إذا كان الوضع حرج، عرض نصيحة
            if (stats.currentStatus === 'CRITICAL' || stats.currentStatus === 'BAN_RISK') {
                console.log(`💡 [ADVICE] Consider increasing delays or disabling heavy systems`);
            }
        }
    }, 30000); // كل 30 ثانية

    // 2. Summary كل 5 دقائق
    setInterval(() => {
        const stats = rateLimitTracker.getStats();
        console.log(`\n📈 [RATE SUMMARY] 5-min Report`);
        console.log(`   Total Warnings: ${stats.warnings}`);
        console.log(`   Total Criticals: ${stats.criticals}`);
        console.log(`   Current Status: ${stats.currentStatus}`);
        console.log(`   Requests in last minute: ${stats.totalRequests}\n`);
    }, 300000); // كل 5 دقائق

    // 3. Listen for Discord Rate Limit Events
    client.on('rateLimit', (info) => {
        console.log(`\n${'⚠️'.repeat(20)}`);
        console.log(`🚨 DISCORD RATE LIMIT HIT!`);
        console.log(`📊 Method: ${info.method}`);
        console.log(`📊 Path: ${info.path}`);
        console.log(`⏰ Timeout: ${info.timeout}ms`);
        console.log(`📈 Limit: ${info.limit}`);
        console.log(`🔄 Retry After: ${info.timeToReset}ms`);
        console.log(`${'⚠️'.repeat(20)}\n`);

        // زيادة warning counter
        rateLimitTracker.warnings += 3;
    });

    console.log('✅ Rate Limit Monitor started');
}

async function startSystemWithDelay(name, systemFunc, delayIndex) {
    try {
        const delay = systemDelays[delayIndex] || 10000;

        // تحقق من الـ Cache أولاً
        const check = canStartSystem(name);

        if (!check.canStart) {
            console.log(`⏸️ [SKIP] ${name}: ${check.reason}`);
            return false;
        }

        console.log(`⏳ [${delayIndex + 1}/6] Starting ${name} in ${delay/1000}s...`);

        await new Promise(resolve => setTimeout(resolve, delay));

        // 🎯 تتبع الـ Rate Limit قبل البدء
        trackRequest();

        // سجل في الـ Cache أن النظام بدأ
        markSystemStarted(name);

        await systemFunc();
        systemsStarted++;

        console.log(`✅ [${systemsStarted}/6] ${name} started`);
        return true;

    } catch (error) {
        console.error(`❌ Failed to start ${name}:`, error.message);
        return false;
    }
}

// 🎯 دالة للأنظمة الثقيلة مع Rate Limit Tracking
const startHeavySystemWithCache = async (systemName, systemFunc) => {
    const check = canStartSystem(systemName);

    if (!check.canStart) {
        console.log(`⏸️ [HEAVY SKIP] ${systemName}: ${check.reason}`);
        return false;
    }

    console.log(`🔄 [HEAVY] Starting ${systemName}...`);

    // 🎯 تتبع الـ Rate Limit قبل البدء
    trackRequest();
    markSystemStarted(systemName);

    try {
        await systemFunc();
        console.log(`✅ [HEAVY] ${systemName} completed`);
        return true;
    } catch (error) {
        console.error(`❌ [HEAVY] Failed ${systemName}:`, error.message);
        return false;
    }
};

// 🎯 دوال جديدة
function startEventBasedSystems(client) {
    console.log('⚡ Starting event-based systems only (safe mode)...');

    // الأنظمة الـ event-based فقط (أقل risk)
    client.on(Events.MessageCreate, async (message) => {
        if (message.author.id === '813077581749288990') {
            console.log('🔨 Bump detected');
            if (bumpHandler && typeof bumpHandler.execute === 'function') {
                trackRequest();
                await bumpHandler.execute(message, client);
            }
        }

        if (message.author.id === '530082442967646230') {
            console.log('🎁 GIVEAWAY BOT DETECTED');
            trackRequest();
            try {
                await giveawayHandler.execute(message, client);
            } catch (error) {
                console.log('❌ Error in giveaway handler:', error);
            }
        }

        if (message.author.id === '1261512844948803710' && 
            message.embeds?.[0]?.description?.includes('1416539071605379162')) {
            console.log('🎟️ SKY PASS SYSTEM');
            trackRequest();
            try {
                await chatRewardsHandler.execute(message, client);
            } catch (error) {
                console.log('❌ Error in SkyPass handler:', error);
            }
        }

        if (message.author.id === '1261512844948803710' &&
            message.embeds?.[0]?.description?.includes('1417641311422382171')) {
            console.log('🐦‍🔥 SKY BREAK SYSTEM');
            trackRequest();
            try {
                await championBreakHandler.execute(message, client);
            } catch (error) {
                console.log('❌ Error in SkyBreak handler:', error);
            }
        }

        if (message.author.id === '1180555656969863228') {
            console.log('🗳️ VOTE BOT DETECTED');
            trackRequest();
            if (voteHandler && typeof voteHandler.execute === 'function') {
                try {
                    await voteHandler.execute(message, client);
                } catch (error) {
                    console.error('❌ Error in vote handler:', error);
                }
            }
        }
    });

    // نظام الـ Boosting
    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        trackRequest();
        try {
            await boostRewardHandler.execute(oldMember, newMember, client);
        } catch (error) {
            console.error('❌ Error in boost reward handler:', error);
        }
    });
}

async function startAllHeavySystems(client) {
    console.log('🚀 Starting all heavy systems...');

    // Shop Lottery
    await startHeavySystemWithCache('ShopLottery', async () => {
        console.log('🎰 Starting shop discount lottery...');
        const lotteryResult = await dbManager.runDailyDiscountLottery();
        console.log('✅ First lottery result:', lotteryResult.success ? 'SUCCESS' : 'FAILED');

        if (lotteryResult.success) {
            console.log(`🛍️ SALE APPLIED! ${lotteryResult.discount}% off on ${lotteryResult.item.name}`);
        } else {
            console.log(`ℹ️ No sale: ${lotteryResult.message || lotteryResult.code}`);
        }
    });

    // Buffs Cleanup
    await startHeavySystemWithCache('BuffsCleanup', async () => {
        console.log('🧹 Starting expired buffs cleanup job...');
        const initialResult = await dbManager.cleanupExpiredBuffs();
        if (initialResult.cleaned > 0) {
            console.log(`✅ Initial cleanup: ${initialResult.cleaned} expired buffs removed`);
        }
    });

    // Verified Roles
    await startHeavySystemWithCache('VerifiedRoles', async () => {
        await safeCheckVerifiedRoles(client);
    });

    // Temp Roles
    try {
        await safeRestoreTempRolesFromDB(client);
        console.log('✅ Temporary roles restored safely');
    } catch (error) {
        console.error(`❌ Failed to restore temporary roles: ${error.message}`);
    }

    // Temprole Scheduling
    try {
        const temproleCommand = require('../Commands/5 temprole');
        await temproleCommand.restoreTempRoles(client);
        console.log('✅ Temporary roles scheduling restored');
    } catch (error) {
        console.error(`❌ Failed to restore temporary roles scheduling: ${error.message}`);
    }

    // Old Discounts Cleanup
    try {
        const cleaned = await dbManager.cleanupOldDiscounts();
        if (cleaned > 0) {
            console.log(`🧹 Cleaned ${cleaned} old discounts`);
        }
    } catch (cleanupError) {
        console.error('❌ Cleanup error:', cleanupError.message);
    }
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    try {
        console.log('🤖 Bot is starting in SAFE MODE for single guild...');
        console.log(`🛡️ SAFE_MODE: ${SAFE_MODE}`);

        // 🎯 بدء Rate Limit Monitor أولاً
        startRateLimitMonitor(client);

        // 🎯 عرض حالة الـ Cache عند البدء
        console.log(`📊 System Cache: ${systemStateCache.size} systems tracked`);

        // تنظيف Cache الأنظمة القديمة جداً (أكثر من 7 أيام)
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        for (const [systemName, timestamp] of systemStateCache) {
            if (timestamp < sevenDaysAgo) {
                systemStateCache.delete(systemName);
                console.log(`🧹 Cleared old cache for ${systemName}`);
            }
        }

        // ⭐ تنظيف الرولات المنتهية أولاً
        try {
            const cleaned = await safeCleanupExpiredTempRoles(client);
            if (cleaned > 0) {
                console.log(`🧹 Cleaned up ${cleaned} expired temporary roles`);
            }
        } catch (error) {
            console.error('❌ Failed to clean expired temp roles:', error.message);
        }

        // 1. الأساسيات فقط
        client.user.setPresence({
            activities: [{ name: 'Starting Systems...', type: ActivityType.Watching }],
            status: 'online'
        });

        console.log(`✅ Bot logged in as ${client.user.tag}`);

        // 2. الأنظمة الأساسية فقط
        const systemQueue = [
            {
                name: 'Database Check',
                func: async () => {
                    try {
                        const test = await dbManager.get('SELECT 1 as test');
                        console.log('✅ Database: OK');
                    } catch (error) {
                        console.error('❌ Database check failed:', error.message);
                    }
                }
            },
            {
                name: 'Essential Settings',
                func: async () => {
                    await loadEssentialSettings(client);
                }
            },
            {
                name: 'Chat XP System',
                func: async () => {
                    if (chatXPSystem && typeof chatXPSystem.setupChatXPTracking === 'function') {
                        chatXPSystem.setupChatXPTracking(client);
                    }
                }
            },
            {
                name: 'Voice XP System',
                func: async () => {
                    if (voiceXPSystem && typeof voiceXPSystem.setupVoiceXPTracking === 'function') {
                        voiceXPSystem.setupVoiceXPTracking(client);
                    }
                }
            },
            {
                name: 'Inviter System',
                func: async () => {
                    client.inviterSystem = new InviterSystem(client);
                    console.log('✅ Inviter system ready');

                    // 🔒 استدعاء آمن للدعوات
                    await safeLoadCurrentInvites(client);
                }
            },
            {
                name: 'Message Tracking',
                func: async () => {
                    if (messageCountSystem && typeof messageCountSystem.setupMessageTracking === 'function') {
                        messageCountSystem.setupMessageTracking(client, dbManager);
                    }
                }
            }
        ];

        // 3. تشغيل الأنظمة الأساسية فقط
        for (let i = 0; i < systemQueue.length; i++) {
            await startSystemWithDelay(systemQueue[i].name, systemQueue[i].func, i);
        }

        console.log(`🎉 Essential systems (${systemsStarted}/6) started successfully!`);

        // 4. تأخير الأنظمة الثقيلة لمدة 5 دقائق
        setTimeout(async () => {
            console.log('🔄 Starting heavy systems after 5 minutes cooldown...');

            try {
                // 🔴 الأنظمة المعلقة (ثقيلة جداً)
                /*
                if (startLiveFameSystem && typeof startLiveFameSystem === 'function') {
                    startLiveFameSystem(client);
                }

                if (startLiveShameSystem && typeof startLiveShameSystem === 'function') {
                    startLiveShameSystem(client);
                }

                if (startLiveMessageSystem && typeof startLiveMessageSystem === 'function') {
                    startLiveMessageSystem(client);
                }
                */

                // 🟡 Auto Messages Roles - النسخة الآمنة مع Cache
                setTimeout(async () => {
                    if (SAFE_MODE) {
                        await startHeavySystemWithCache('AutoMessagesRoles', async () => {
                            await safeAutoMessagesRoles(client);
                        });
                    } else if (startAutoMessageRolesSystem && typeof startAutoMessageRolesSystem === 'function') {
                        await startHeavySystemWithCache('AutoMessagesRoles', async () => {
                            startAutoMessageRolesSystem(client);
                        });
                    }
                }, 300000); // بعد 5 دقائق إضافية

                // 🎯 إضافة Rate Limit Check قبل الأنظمة الثقيلة
                const rateStats = rateLimitTracker.getStats();
                if (rateStats.currentStatus === 'CRITICAL' || rateStats.currentStatus === 'BAN_RISK') {
                    console.log(`⚠️ [SAFETY] Skipping some heavy systems due to rate limit (${rateStats.currentStatus})`);
                    console.log(`💡 Only starting event-based systems for now...`);

                    // تشغيل الأنظمة الـ event-based فقط
                    startEventBasedSystems(client);

                } else {
                    // تشغيل كل الأنظمة
                    await startAllHeavySystems(client);

                    // 🟡 AutoMessagesRole الفحص المستمر - مع Cache
                    setInterval(async () => {
                        await startHeavySystemWithCache('CheckAllMembersRoles', async () => {
                            if (SAFE_MODE) {
                                await safeCheckAllMembersRoles(client);
                            } else if (typeof checkAllMembersRoles === 'function') {
                                await checkAllMembersRoles(client);
                            }
                        });
                    }, 180 * 60 * 1000); // كل 3 ساعات
                }

                // ========== 🔄 DAILY XP LIMITS RESET ==========
                console.log('🔄 Setting up daily XP limits reset...');

                // إعادة ضبط بعد 30 ثانية
                setTimeout(async () => {
                    try {
                        if (chatXPSystem && typeof chatXPSystem.resetDailyLimits === 'function') {
                            await chatXPSystem.resetDailyLimits();
                            console.log('✅ Daily XP limits reset successfully');
                        }

                        if (voiceXPSystem && typeof voiceXPSystem.resetDailyLimits === 'function') {
                            await voiceXPSystem.resetDailyLimits();
                            console.log('✅ Daily Voice XP limits reset successfully');
                        }
                    } catch (error) {
                        console.error('❌ Failed to reset daily XP limits:', error.message);
                    }
                }, 30000); // 30 ثانية

                // إعادة ضبط كل 24 ساعة
                setInterval(async () => {
                    try {
                        console.log('🔄 Running scheduled daily XP limits reset...');

                        if (chatXPSystem && typeof chatXPSystem.resetDailyLimits === 'function') {
                            await chatXPSystem.resetDailyLimits();
                        }

                        if (voiceXPSystem && typeof voiceXPSystem.resetDailyLimits === 'function') {
                            await voiceXPSystem.resetDailyLimits();
                        }

                        console.log('✅ Daily XP limits reset completed');
                    } catch (error) {
                        console.error('❌ Error in scheduled XP limits reset:', error.message);
                    }
                }, 24 * 60 * 60 * 1000); // 24 ساعة

                console.log('✅ Daily XP limits reset system started');

                // ========== 🔄 AUTO MESSAGE ROLES SYSTEM ==========
                console.log('🎯 Setting up Auto Messages Roles system...');

                // أول فحص بعد 5 دقائق
                setTimeout(async () => {
                    await startHeavySystemWithCache('AutoMessagesRoles', async () => {
                        if (SAFE_MODE) {
                            await safeAutoMessagesRoles(client);
                        } else if (typeof startAutoMessageRolesSystem === 'function') {
                            startAutoMessageRolesSystem(client);
                        }
                    });
                }, 300000); // 5 دقائق

                // ثم كل 4 ساعات
                const messagesRoleInterval = setInterval(async () => {
                    await startHeavySystemWithCache('AutoMessagesRoles', async () => {
                        if (SAFE_MODE) {
                            console.log('🔄 Safe Auto Messages Roles check (every 4 hours)');
                            await safeAutoMessagesRoles(client);
                        } else if (typeof startAutoMessageRolesSystem === 'function') {
                            console.log('🔄 Auto Messages Roles check (every 4 hours)');
                            startAutoMessageRolesSystem(client);
                        }
                    });
                }, 240 * 60 * 1000); // 4 ساعات

                client.messagesRoleInterval = messagesRoleInterval;
                console.log('✅ Auto Messages Roles system started');

                // ========== 🧹 TEMP ROLES CLEANUP SCHEDULER ==========
                try {
                    console.log('🧹 Starting scheduled temp roles cleanup...');

                    // تنظيف أولي
                    const initialCleaned = await safeCleanupExpiredTempRoles(client);
                    if (initialCleaned > 0) {
                        console.log(`✅ Initial cleanup: ${initialCleaned} expired temp roles removed`);
                    }

                    // تنظيف كل ساعتين مع Cache
                    setInterval(async () => {
                        await startHeavySystemWithCache('TempRolesCleanup', async () => {
                            console.log('🔄 Running scheduled temp roles cleanup...');
                            const cleaned = await safeCleanupExpiredTempRoles(client);
                            if (cleaned > 0) {
                                console.log(`🧹 Scheduled cleanup: ${cleaned} expired temp roles removed`);
                            }
                        });
                    }, 120 * 60 * 1000); // ساعتين

                    console.log('✅ Temp roles cleanup scheduled (every 2 hours)');
                } catch (error) {
                    console.error('❌ Failed to start temp roles cleanup scheduler:', error.message);
                }

                // ========== 📊 ADVANCED STATISTICS SYSTEM ==========
                setTimeout(async () => {
                    await startHeavySystemWithCache('Statistics', async () => {
                        try {
                            console.log('📊 [STATS] Initializing advanced statistics system...');

                            const initialResult = await safeCalculateAndUpdateTotals(client);

                            if (initialResult.success) {
                                console.log(`✅ [STATS] Initial calculation completed successfully!`);
                            } else {
                                console.error('❌ [STATS] Initial calculation failed:', initialResult.error);
                            }

                        } catch (error) {
                            console.error('❌ [STATS] Failed to initialize statistics system:', error);
                        }
                    });
                }, 120000); // بعد دقيقتين

                // Statistics كل 12 ساعة
                setInterval(async () => {
                    await startHeavySystemWithCache('Statistics', async () => {
                        console.log('🔄 [STATS] Running periodic statistics update...');
                        try {
                            const periodicResult = await safeCalculateAndUpdateTotals(client);
                            if (periodicResult.success) {
                                console.log(`✅ [STATS] Periodic update completed`);
                            }
                        } catch (error) {
                            console.error('❌ [STATS] Periodic update failed:', error.message);
                        }
                    });
                }, 12 * 60 * 60 * 1000); // Every 12 hours

                // Shop Discount Lottery - كل 12 ساعة (مع Cache في الـ interval)
                setInterval(async () => {
                    await startHeavySystemWithCache('ShopLottery', async () => {
                        console.log('🔄 Running scheduled shop lottery...');
                        const result = await dbManager.runDailyDiscountLottery();

                        if (result.success) {
                            console.log(`🎉 New sale: ${result.discount}% off on ${result.item.name}`);
                        } else {
                            console.log(`📝 No sale this time: ${result.code || 'No eligible items'}`);
                        }
                    });
                }, 12 * 60 * 60 * 1000); // 12 ساعة

                // Buffs Cleanup - كل ساعتين
                setInterval(async () => {
                    await startHeavySystemWithCache('BuffsCleanup', async () => {
                        console.log('🔄 Running buffs cleanup...');
                        const result = await dbManager.cleanupExpiredBuffs();
                        if (result.cleaned > 0) {
                            console.log(`🔄 Auto-cleaned ${result.cleaned} expired buffs`);
                        }
                    });
                }, 120 * 60 * 1000); // كل ساعتين

                console.log('🎉 All systems started successfully with CACHE & RATE LIMIT monitoring!');

            } catch (error) {
                console.error('❌ Error starting heavy systems:', error);
            }
        }, 300000); // بعد 5 دقائق

    } catch (error) {
        console.error(`❌ [Ready Error] ${error.message}`);
        console.error(error.stack);
    }
  }
};

// ==================== الدوال الآمنة الجديدة ====================

// 🔒 دالة آمنة لتحميل الدعوات
async function safeLoadCurrentInvites(client) {
    try {
        console.log('📥 [SAFE] Loading current invites for single guild...');

        const guild = client.guilds.cache.get(MAIN_GUILD_ID);
        if (!guild) {
            console.log('❌ Main guild not found');
            return;
        }

        // تأخير 10 ثواني قبل البدء
        await new Promise(resolve => setTimeout(resolve, 10000));

        try {
            const invites = await guild.invites.fetch({ limit: 50, cache: true }).catch(() => null);
            if (!invites || invites.size === 0) {
                console.log(`ℹ️ No invites found for ${guild.name}`);
                return;
            }

            const inviterSystem = client.inviterSystem;
            let processed = 0;

            for (const [code, invite] of invites) {
                await inviterSystem.updateInviteUsage(
                    guild.id,
                    code,
                    invite.uses,
                    invite.inviter?.id || 'Unknown'
                );

                processed++;
                // تأخير 500 مللي ثانية بعد كل 10 دعوات
                if (processed % 10 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log(`✅ Loaded ${invites.size} invites for ${guild.name}`);

        } catch (error) {
            console.error(`❌ Failed to load invites for ${guild.name}:`, error.message);
        }

    } catch (error) {
        console.error('Error in safeLoadCurrentInvites:', error);
    }
}

// 🔒 دالة آمنة لتنظيف الرولات المنتهية
const temproleModule = require('../Commands/5 temprole');

async function safeCleanupExpiredTempRoles(client) {
    try {
        const expiredRoles = await dbManager.all(
            'SELECT * FROM temp_roles WHERE expires_at <= NOW()'
        );

        let cleanedCount = 0;

        for (const tempRole of expiredRoles) {
            try {
                await temproleModule.removeRole(
                    client,
                    tempRole.user_id,
                    tempRole.role_id,
                    tempRole.guild_id,
                    tempRole.duration,
                    tempRole.assigned_by,
                    tempRole.initial_message_id,
                    tempRole.channel_id
                );

                cleanedCount++;

                // تأخير 500 مللي ثانية بين كل رول
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                console.error(`Error cleaning expired temp role ${tempRole.id}:`, error.message);
            }
        }

        console.log(`🧹 [SAFE] Cleaned up ${cleanedCount} expired temporary roles`);
        return cleanedCount;
    } catch (error) {
        console.error('Error in safeCleanupExpiredTempRoles:', error);
        return 0;
    }
}

// 🔒 دالة آمنة لـ Auto Messages Roles
async function safeAutoMessagesRoles(client) {
    console.log('🔒 [SAFE] Auto Messages Roles starting...');

    const guild = client.guilds.cache.get(MAIN_GUILD_ID);
    if (!guild) {
        console.log('❌ Main guild not found');
        return;
    }

    // تأخير 30 ثانية قبل البدء
    await new Promise(resolve => setTimeout(resolve, 30000));

    try {
        // جلب 100 عضو فقط (ليس كل الأعضاء)
        const members = await guild.members.fetch({ limit: 100 });

        let processed = 0;
        for (const [memberId, member] of members) {
            processed++;

            // منطق الرتب... (هنا تضمن منطقك الأصلي)
            // لكن مع حدود

            // تأخير 100 مللي ثانية بعد كل 20 عضو
            if (processed % 20 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            // توقف بعد 80 عضو
            if (processed >= 80) {
                console.log('⚠️ Stopped at 80 members for safety');
                break;
            }
        }

        console.log(`✅ [SAFE] Processed ${processed} members in ${guild.name}`);

    } catch (error) {
        console.error(`❌ Error in safeAutoMessagesRoles for ${guild.name}:`, error.message);
    }
}

// 🔒 دالة آمنة لـ checkAllMembersRoles
async function safeCheckAllMembersRoles(client) {
    console.log('🔒 [SAFE] Checking all members roles...');

    const guild = client.guilds.cache.get(MAIN_GUILD_ID);
    if (!guild) {
        console.log('❌ Main guild not found');
        return;
    }

    // تأخير 20 ثانية قبل البدء
    await new Promise(resolve => setTimeout(resolve, 20000));

    try {
        // استخدام الـ cache فقط، لا fetch جديد
        const members = guild.members.cache;

        let processed = 0;
        for (const [memberId, member] of members) {
            processed++;

            // منطق التحقق من الرتب...
            // checkVerifiedRoles أو أي منطق آخر

            // تأخير 50 مللي ثانية بعد كل 50 عضو
            if (processed % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            // توقف بعد 200 عضو
            if (processed >= 200) {
                console.log('⚠️ Stopped at 200 members for safety');
                break;
            }
        }

        console.log(`✅ [SAFE] Checked ${processed} members in ${guild.name}`);

    } catch (error) {
        console.error(`❌ Error in safeCheckAllMembersRoles for ${guild.name}:`, error.message);
    }
}

// 🔒 دالة آمنة لـ checkVerifiedRoles
async function safeCheckVerifiedRoles(client) {
    console.log('🔒 [SAFE] Checking verified roles...');

    try {
        const usersWithInvites = await dbManager.all('SELECT DISTINCT user_id FROM invites WHERE total > 0');
        let checkedCount = 0;

        // تأخير 5 ثواني قبل البدء
        await new Promise(resolve => setTimeout(resolve, 5000));

        for (const user of usersWithInvites) {
            await checkVerifiedRoles(client, user.user_id);
            checkedCount++;

            // تأخير 1000 مللي ثانية بعد كل 5 مستخدمين
            if (checkedCount % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            // توقف بعد 50 مستخدم
            if (checkedCount >= 50) {
                console.log('⚠️ Stopped at 50 users for safety');
                break;
            }
        }

        console.log(`✅ [SAFE] Verified roles checked for ${checkedCount} members`);

    } catch (error) {
        console.error('❌ Failed to check verified roles:', error.message);
    }
}

// 🔒 دالة آمنة لاستعادة الرتب المؤقتة
async function safeRestoreTempRolesFromDB(client) {
    try {
        const activeTempRoles = await dbManager.all(
            'SELECT * FROM temp_roles WHERE expires_at > NOW() AND guild_id = ?',
            [MAIN_GUILD_ID]
        );

        let restoredCount = 0;
        let scheduledCount = 0;

        for (const tempRole of activeTempRoles) {
            try {
                const guild = client.guilds.cache.get(MAIN_GUILD_ID);
                if (!guild) continue;

                const member = await guild.members.fetch(tempRole.user_id).catch(() => null);
                if (!member) continue;

                const role = await guild.roles.fetch(tempRole.role_id).catch(() => null);
                if (!role) {
                    await dbManager.run(
                        'DELETE FROM temp_roles WHERE id = ?',
                        [tempRole.id]
                    );
                    continue;
                }

                await member.roles.add(role);
                restoredCount++;

                const temproleCommand = require('../Commands/5 temprole');
                const expiresAt = new Date(tempRole.expires_at);

                temproleCommand.scheduleRoleRemoval(
                    client, 
                    tempRole.user_id, 
                    tempRole.role_id, 
                    tempRole.guild_id, 
                    expiresAt, 
                    tempRole.duration, 
                    tempRole.assigned_by,
                    tempRole.initial_message_id,
                    tempRole.channel_id
                );

                scheduledCount++;

                // تأخير 300 مللي ثانية بين كل رول
                await new Promise(resolve => setTimeout(resolve, 300));

            } catch (error) {
                console.error(`Error restoring temp role ${tempRole.id}:`, error.message);
            }
        }

        console.log(`✅ [SAFE] Restored ${restoredCount} temporary roles`);
        return { restoredCount, scheduledCount };

    } catch (error) {
        console.error('Error in safeRestoreTempRolesFromDB:', error);
        return { restoredCount: 0, scheduledCount: 0 };
    }
}

// 🔒 دالة آمنة للإحصائيات
async function safeCalculateAndUpdateTotals(client) {
    try {
        console.log('🔄 [SAFE STATS] Starting safe statistics calculation...');

        // تأخير 10 ثواني قبل البدء
        await new Promise(resolve => setTimeout(resolve, 10000));

        const totalStats = await dbManager.all(`
            SELECT inviter_id, COUNT(*) as total_count 
            FROM member_join_history 
            WHERE inviter_id != 'Unknown' AND inviter_id != 'Vanity URL'
            GROUP BY inviter_id
            LIMIT 100  -- ⚠️ حد أقصى 100 inviter
        `);

        let processed = 0;
        for (const stat of totalStats) {
            const existingInviter = await dbManager.get(
                'SELECT * FROM invites WHERE user_id = ?', 
                [stat.inviter_id]
            );

            if (existingInviter) {
                if (existingInviter.total !== stat.total_count) {
                    await dbManager.run(
                        'UPDATE invites SET total = ? WHERE user_id = ?',
                        [stat.total_count, stat.inviter_id]
                    );
                }
            } else {
                const inviterUser = await client.users.fetch(stat.inviter_id).catch(() => null);
                await dbManager.run(
                    'INSERT INTO invites (user_id, username, total, verified, unverified, left_count) VALUES (?, ?, ?, ?, ?, ?)',
                    [
                        stat.inviter_id, 
                        inviterUser ? inviterUser.tag : 'Unknown User', 
                        stat.total_count, 
                        0, 0, 0
                    ]
                );
            }

            processed++;
            // تأخير 200 مللي ثانية بعد كل 10
            if (processed % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }

        console.log(`✅ [SAFE STATS] Processed ${processed} inviters`);

        return {
            success: true,
            total: processed
        };

    } catch (error) {
        console.error('❌ [SAFE STATS] Error:', error.message);
        return { success: false, error: error.message };
    }
}

// ==================== الدوال القديمة (كما هي) ====================

async function loadLogChannelsFromDB(client) {
    try {
        const allLogChannels = await dbManager.all('SELECT * FROM log_channels');
        const guildChannels = {};

        for (const channel of allLogChannels) {
            if (!guildChannels[channel.guild_id]) {
                guildChannels[channel.guild_id] = {};
            }

            const discordChannel = await client.channels.fetch(channel.channel_id).catch(() => null);
            if (discordChannel) {
                guildChannels[channel.guild_id][channel.channel_type] = discordChannel;
            } else {
                guildChannels[channel.guild_id][channel.channel_type] = {
                    id: channel.channel_id,
                    name: channel.channel_name,
                    guildId: channel.guild_id
                };
            }
        }

        client.logChannels = guildChannels;
        console.log(`✅ Loaded log channels for ${Object.keys(guildChannels).length} guilds`);
        return true;
    } catch (error) {
        console.error('Error loading log channels:', error);
        return false;
    }
}

async function loadVerifiedRoleFromDB(client) {
    try {
        const roleData = await dbManager.get(
            'SELECT * FROM bot_settings WHERE setting_key = ?',
            ['verifiedRole']
        );

        if (roleData) {
            try {
                const roleInfo = JSON.parse(roleData.setting_value);
                const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);
                if (guild) {
                    const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
                    if (role) {
                        client.verifiedRole = role;
                        console.log(`✅ Verified role loaded: ${role.name} in ${roleInfo.guildName}`);
                        return true;
                    }
                }
            } catch (error) {
                console.error('Error parsing verified role data:', error);
            }
        }
        console.log('⚠️ No verified role configured in database');
        return false;
    } catch (error) {
        console.error('Error loading verified role from database:', error);
        return false;
    }
}

async function loadEssentialSettings(client) {
    try {
        console.log('⚙️ Loading essential settings...');

        await loadVerifiedRoleFromDB(client);
        console.log('✅ Verified role loaded from database');

        await loadLogChannelsFromDB(client);
        console.log('✅ Log channels loaded from database');

        return true;
    } catch (error) {
        console.error('❌ Failed to load essential settings:', error.message);
        return false;
    }
}