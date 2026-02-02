const { ActivityType } = require('discord.js');
const { Events } = require('discord.js');
const dbManager = require('../Data/database');
const deployCommands = require('../Utlis/DeployCommands');
const chatXPSystem = require('../LevelSystem/chatsystem');
const voiceXPSystem = require('../LevelSystem/voicesystem');
const bumpHandler = require('../LevelSystem/bumpsystem');
const voteHandler = require('../LevelSystem/votesystem');

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    try {
        console.log('🤖 Bot is starting... Please wait for systems to initialize');

        // 1. الأساسيات فقط
        client.user.setPresence({
            activities: [{ name: 'Connected to the skywaves', type: ActivityType.Listening }],
            status: 'online'
        });

        console.log(`✅ Bot logged in as ${client.user.tag}`);

        // 2. الاتصال بقاعدة البيانات ونشر الأوامر
        try {
            const test = await dbManager.get('SELECT 1 as test');
            console.log('✅ Database: OK');

            // استدعاء Deploy Commands بعد الاتصال بقاعدة البيانات
            await deployCommands();
        } catch (error) {
            console.error('❌ Database check failed:', error.message);
        }

        // 3. تشغيل أنظمة LevelSystem
        if (chatXPSystem && typeof chatXPSystem.setupChatXPTracking === 'function') {
            chatXPSystem.setupChatXPTracking(client);
            console.log('✅ Chat XP System started');
        }

        if (voiceXPSystem && typeof voiceXPSystem.setupVoiceXPTracking === 'function') {
            voiceXPSystem.setupVoiceXPTracking(client);
            console.log('✅ Voice XP System started');
        }

        // 4. نظام الـ Bump
        client.on(Events.MessageCreate, async (message) => {
            if (message.author.id === '813077581749288990') {
                if (bumpHandler && typeof bumpHandler.execute === 'function') {
                    await bumpHandler.execute(message, client);
                }
            }
        });

        // 5. نظام التصويت
        client.on(Events.MessageCreate, async (message) => {
            try {
                if (message.author.id === '1180555656969863228') {
                    console.log('🗳️ === VOTE BOT DETECTED ===');

                    if (voteHandler && typeof voteHandler.execute === 'function') {
                        await voteHandler.execute(message, client);
                    }
                }
            } catch (error) {
                console.error('❌ Error in vote handler:', error);
            }
        });

        // 8. Shop Discount Lottery
        try {
            console.log('🎰 Starting shop discount lottery...');
            const lotteryResult = await dbManager.runDailyDiscountLottery();
            console.log('✅ First lottery result:', lotteryResult.success ? 'SUCCESS' : 'FAILED');

            if (lotteryResult.success) {
                console.log(`🛍️ SALE APPLIED! ${lotteryResult.discount}% off on ${lotteryResult.item.name}`);
            } else {
                console.log(`ℹ️ No sale: ${lotteryResult.message || lotteryResult.code}`);
            }
        } catch (lotteryError) {
            console.error('❌ Shop lottery error:', lotteryError.message);
        }

        // Shop Discount Lottery - كل 12 ساعة
        setInterval(async () => {
            try {
                console.log('🔄 Running scheduled shop lottery...');
                const result = await dbManager.runDailyDiscountLottery();

                if (result.success) {
                    console.log(`🎉 New sale: ${result.discount}% off on ${result.item.name}`);
                } else {
                    console.log(`📝 No sale this time: ${result.code || 'No eligible items'}`);
                }
            } catch (intervalError) {
                console.error('❌ Interval lottery error:', intervalError.message);
            }
        }, 12 * 60 * 60 * 1000); // 12 ساعة

        // 9. تنظيف التخفيضات القديمة
        try {
            const cleaned = await dbManager.cleanupOldDiscounts();
            if (cleaned > 0) {
                console.log(`🧹 Cleaned ${cleaned} old discounts`);
            }
        } catch (cleanupError) {
            console.error('❌ Cleanup error:', cleanupError.message);
        }

        // 10. تنظيف الـ Buffs المنتهية دورياً
        try {
            console.log('🧹 Starting expired buffs cleanup job...');

            // تنظيف فوري
            const initialResult = await dbManager.cleanupExpiredBuffs();
            if (initialResult.cleaned > 0) {
                console.log(`✅ Initial cleanup: ${initialResult.cleaned} expired buffs removed`);
            }

            // تشغيل التنظيف كل 30 دقيقة
            setInterval(async () => {
                try {
                    const result = await dbManager.cleanupExpiredBuffs();
                    if (result.cleaned > 0) {
                        console.log(`🔄 Auto-cleaned ${result.cleaned} expired buffs`);
                    }
                } catch (error) {
                    console.error('❌ Error in buff cleanup job:', error.message);
                }
            }, 30 * 60 * 1000); // كل 30 دقيقة

            console.log('✅ Buff cleanup job started (every 30 minutes)');
        } catch (error) {
            console.error('❌ Failed to start buff cleanup job:', error);
        }

        // 11. إعادة ضبط حدود الـ XP اليومية
        console.log('🔄 Setting up daily XP limits reset...');

        // إعادة ضبط أولية بعد 5 ثواني
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
        }, 5000); // 5 ثواني

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

        console.log('✅ Daily XP limits reset system started (every 24 hours)');
        console.log('🎉 All systems started successfully!');

    } catch (error) {
        console.error(`❌ [Ready Error] ${error.message}`);
        console.error(error.stack);
    }
  }
};