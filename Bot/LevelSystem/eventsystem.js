const { 
    ContainerBuilder, 
    TextDisplayBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    MessageFlags,
    ActionRowBuilder
} = require('discord.js');
const dbManager = require('../Data/database');
const levelSystem = require('../LevelSystem/levelsystem');
const buffSystem = require('../LevelSystem/globalbuffs');
const axios = require('axios');
const crypto = require('crypto');

class GlobalChallengeManager {
    constructor(client) {
        this.client = client;
        this.activeChallenges = new Map();
        this.activeChallengeMessages = new Map();
        this.userParticipations = new Map();

        // ========== CHALLENGE CONFIGURATION ==========
        this.challengeTypes = {
            // ⭐ STAR CHALLENGES (100-150 messages)
            'first_click': {
                name: 'FIRST CLICK',
                emoji: '⚡',
                category: 'star',
                duration: 45,
                generateData: this.generateFirstClickData.bind(this),
                createMessage: this.createClickMessageV2.bind(this),
                processWin: this.processClickWin.bind(this)
            },
            'first_mention': {
                name: 'FIRST MENTION',
                emoji: '📢',
                category: 'star',
                duration: 45,
                generateData: () => ({}),
                createMessage: this.createMentionMessageV2.bind(this),
                processWin: this.processMentionWin.bind(this)
            },
            'quick_math': {
                name: 'QUICK MATH',
                emoji: '➗',
                category: 'star',
                duration: 45,
                generateData: this.generateMathData.bind(this),
                createMessage: this.createMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'dice_roll': {
                name: 'DICE ROLL',
                emoji: '🎲',
                category: 'star',
                duration: 45,
                generateData: this.generateDiceData.bind(this),
                createMessage: this.createDiceMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'trivia': {
                name: 'TRIVIA',
                emoji: '🧠',
                category: 'star',
                duration: 45,
                generateData: this.generateTriviaData.bind(this),
                createMessage: this.createTriviaMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'find_word': {
                name: 'FIND WORD',
                emoji: '🔍',
                category: 'star',
                duration: 45,
                generateData: this.generateFindWordData.bind(this),
                createMessage: this.createFindWordMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },

            // 🎁 BETWEEN EVENTS CHALLENGES
            'hidden_text': {
                name: 'HIDDEN TEXT',
                emoji: '🕵️',
                category: 'between',
                duration: 30,
                generateData: this.generateHiddenTextData.bind(this),
                createMessage: this.createHiddenMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'lucky_number': {
                name: 'LUCKY NUMBER',
                emoji: '🎯',
                category: 'between',
                duration: 30,
                generateData: this.generateLuckyNumberData.bind(this),
                createMessage: this.createLuckyMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'random_keyword': {
                name: 'RANDOM KEYWORD',
                emoji: '🌀',
                category: 'between',
                duration: 30,
                generateData: this.generateKeywordData.bind(this),
                createMessage: this.createKeywordMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'fast_typing': {
                name: 'FAST TYPING',
                emoji: '⌨️',
                category: 'between',
                duration: 30,
                generateData: this.generateTypingData.bind(this),
                createMessage: this.createTypingMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },

            // ⭐⭐ VOICE JOIN CHALLENGE (MODIFIED) ⭐⭐
            'first_voice_join': {
                name: 'VOICE PARTY',
                emoji: '🎧',
                category: 'voice',
                duration: 600,
                generateData: this.generateVoiceJoinData.bind(this),
                createMessage: this.createVoiceJoinMessageV2.bind(this),
                processWin: this.processMultiVoiceJoinWin.bind(this),
                minStayRequired: 120,
                maxStayRequired: 180
            },

            // 🌌 NEBULA CHALLENGES (400-600 messages)
            'nebula_click': {
                name: 'NEBULA CLICK',
                emoji: '⚡',
                category: 'nebula',
                duration: 60,
                generateData: this.generateFirstClickData.bind(this),
                createMessage: this.createClickMessageV2.bind(this),
                processWin: this.processClickWin.bind(this)
            },
            'nebula_trivia': {
                name: 'TRIVIA MASTER',
                emoji: '🧠',
                category: 'nebula',
                duration: 60,
                generateData: this.generateTriviaData.bind(this),
                createMessage: this.createTriviaMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'nebula_advanced_math': {
                name: 'ADVANCED MATH',
                emoji: '🧮',
                category: 'nebula',
                duration: 60,
                generateData: this.generateAdvancedMathData.bind(this),
                createMessage: this.createAdvancedMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'nebula_quick_math': {
                name: 'QUICK MATH',
                emoji: '➗',
                category: 'nebula',
                duration: 60,
                generateData: this.generateMathData.bind(this),
                createMessage: this.createMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },

            // ☄️ METEOROID LEGENDARY CHALLENGE (800-1000 messages)
            'meteoroid_trivia': {
                name: 'LEGENDARY TRIVIA',
                emoji: '🧠',
                category: 'meteoroid',
                duration: 60,
                generateData: this.generateTriviaData.bind(this),
                createMessage: this.createTriviaMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'meteoroid_advanced_math': {
                name: 'LEGENDARY MATH',
                emoji: '🧮',
                category: 'meteoroid',
                duration: 60,
                generateData: this.generateAdvancedMathData.bind(this),
                createMessage: this.createAdvancedMathMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            },
            'legendary_mix': {
                name: 'LEGENDARY MIX',
                emoji: '🔥',
                category: 'meteoroid',
                duration: 60,
                generateData: this.generateLegendaryData.bind(this),
                createMessage: this.createLegendaryMessageV2.bind(this),
                processWin: this.processAnswerWin.bind(this)
            }
        };

        // ========== LEVEL TARGETS ==========
        this.levelTargets = {
            star: { min: 100, max: 150 },
            comet: { min: 250, max: 350 },
            nebula: { min: 400, max: 600 },
            meteoroid: { min: 800, max: 1000 }
        };

        // ========== BETWEEN EVENTS RANGES ==========
        this.betweenEventRanges = {
            'before_star': { min: 25, max: 90 },
            'star_comet': { min: 160, max: 240 },
            'comet_nebula': { min: 200, max: 300 },
            'nebula_meteoroid': { min: 300, max: 450 },
            'voice_challenge': { min: 10, max: 540 }
        };

        // ========== DROP TYPES ==========
        this.dropTypes = {
            'star': 'common',
            'comet': 'rare',
            'nebula': 'epic',
            'meteoroid': 'legendary'
        };

        // ========== LEVEL REWARDS ==========
        this.levelRewards = {
            'star': {
                drop: 'common',
                xp: { min: 25, max: 45 },
                coins: { min: 15, max: 35 },
                crystals: { min: 0, max: 1 },
                crystalChance: 0.15
            },
            'comet': {
                drop: 'rare',
                xp: { min: 40, max: 65 },
                coins: { min: 30, max: 55 },
                crystals: { min: 0, max: 1 },
                crystalChance: 0.25
            },
            'nebula': {
                drop: 'epic',
                xp: { min: 70, max: 100 },
                coins: { min: 60, max: 95 },
                crystals: { min: 0, max: 2 },
                crystalChance: 0.5
            },
            'meteoroid': {
                drop: 'legendary',
                xp: { min: 120, max: 180 },
                coins: { min: 100, max: 160 },
                crystals: { min: 1, max: 3 },
                crystalChance: 0.9
            }
        };

        // ========== BETWEEN EVENTS REWARDS ==========
        this.betweenRewards = {
            'before-star': { xp: { min: 10, max: 20 }, coins: { min: 10, max: 15 } },
            'star-comet': { xp: { min: 25, max: 40 }, coins: { min: 20, max: 30 } },
            'comet-nebula': { xp: { min: 50, max: 70 }, coins: { min: 35, max: 50 } },
            'nebula-meteoroid': { xp: { min: 80, max: 100 }, coins: { min: 60, max: 100 } },
            'voice-join': { 
                xp: { min: 100, max: 300 }, 
                coins: { min: 150, max: 350 },
                crystalChance: 0.1
            }
        };

        this.setupEventListeners();
    }

    // ========== INITIALIZATION ==========
    async setup() {
        console.log('🚀 Global Challenge System initializing...');

        // ⭐⭐ تنظيف الذاكرة ⭐⭐
        this.setupMemoryCleanup();

        await this.cleanupOnStartup();

        const mem = process.memoryUsage();
        console.log(`✅ EventSystem ready! Initial memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);

        return this;
    }

    // ========== CORE METHODS ==========
    async getGlobalChallenge(guildId) {
        try {
            return await dbManager.getGlobalChallenge(guildId);
        } catch (error) {
            console.error('Error getting global challenge:', error);
            return null;
        }
    }

    async processMessageForChallenge(guildId, userId, username, message) {
        try {
            // ⭐⭐ تحديث المشاركة ⭐⭐
            this.userParticipations.set(userId, Date.now());

            // ⭐⭐ تنظيف تلقائي ⭐⭐
            if (this.userParticipations.size > 500) {
                const now = Date.now();
                const THIRTY_MINUTES = 30 * 60 * 1000;

                for (const [uid, timestamp] of this.userParticipations.entries()) {
                    if (now - timestamp > THIRTY_MINUTES) {
                        this.userParticipations.delete(uid);
                    }
                }
            }

            // 1. جلب التحدي الحالي
            const challenge = await this.getGlobalChallenge(guildId);

            if (!challenge) {
                await this.initializeNewChallenge(guildId);
                return { 
                    success: true, 
                    initialized: true,
                    message: "New challenge initialized for guild"
                };
            }

            // 2. زيادة عدد الرسائل
            const incrementResult = await dbManager.incrementGlobalChallengeMessages(guildId, 1);

            if (!incrementResult.success) {
                return { 
                    success: false, 
                    error: 'Failed to increment messages' 
                };
            }

            const currentCycleCount = incrementResult.cycleCount || 0;
            const totalMessages = incrementResult.totalCount || 0;

            // 3. التحقق من الأحداث
            const eventResult = await this.checkAndTriggerEvents(
                guildId, 
                currentCycleCount,
                message
            );

            // 4. تسجيل النتيجة
            return {
                success: true,
                cycleCount: currentCycleCount,
                totalMessages: totalMessages,
                levelEvents: eventResult.levelEvents || [],
                betweenEvents: eventResult.betweenEvents || [],
                userParticipated: true
            };

        } catch (error) {
            console.error('❌ Error processing challenge message:', error);
            console.error('Error details:', {
                guildId,
                userId,
                username,
                errorMessage: error.message,
                stack: error.stack?.split('\n')[0]
            });

            return { 
                success: false, 
                error: error.message,
                code: 'PROCESSING_ERROR'
            };
        }
    }

    // ========== TARGET GENERATION ==========
    generateAllTargets() {
        const star = this.getRandomBetween(100, 150);
        const comet = this.getRandomBetween(250, 350);
        const nebula = this.getRandomBetween(400, 600);
        const meteoroid = this.getRandomBetween(800, 1000);

        const before_star = this.getRandomBetween(25, Math.min(90, star - 1));
        const star_comet = this.getRandomBetween(star + 160, Math.min(star + 240, comet - 1));
        const comet_nebula = this.getRandomBetween(comet + 200, Math.min(comet + 300, nebula - 1));
        const nebula_meteoroid = this.getRandomBetween(nebula + 300, Math.min(nebula + 450, meteoroid - 1));

        const voice_challenge = this.getRandomBetween(10, 540);

        return {
            star_target: star,
            comet_target: comet,
            nebula_target: nebula,
            meteoroid_target: meteoroid,

            before_star_target: before_star,
            star_comet_target: star_comet,
            comet_nebula_target: comet_nebula,
            nebula_meteoroid_target: nebula_meteoroid,

            voice_challenge_target: voice_challenge
        };
    }

    // ========== EVENT CHECKING ==========
    async checkAndTriggerEvents(guildId, currentMessages, originalMessage) {
        try {
            const challenge = await this.getGlobalChallenge(guildId);
            if (!challenge) return {};

            const levelEvents = [];
            const betweenEvents = [];

            // تحقق من Level Targets
            const levels = ['star', 'comet', 'nebula', 'meteoroid'];
            for (const level of levels) {
                const targetField = `${level}_target`;
                const reachedField = `${level}_reached`;

                const target = challenge[targetField];
                const reached = challenge[reachedField];

                if (target && currentMessages >= target && !reached) {
                    levelEvents.push(level);

                    await dbManager.markChallengeLevelReached(guildId, level);

                    if (originalMessage && originalMessage.channel) {
                        await this.startLevelChallenge(guildId, originalMessage.channel, level);
                    }

                    console.log(`🎮 ${level.toUpperCase()} challenge started - Winner takes all!`);

                    if (level === 'meteoroid') {
                        await this.resetAllTargets(guildId);
                    }
                }
            }

            // تحقق من Between Targets
            const betweenTypes = [
                'before_star_target', 
                'star_comet_target', 
                'comet_nebula_target', 
                'nebula_meteoroid_target',
                'voice_challenge_target'
            ];

            const completedTypes = [
                'before_star_completed',
                'star_comet_completed',
                'comet_nebula_completed',
                'nebula_meteoroid_completed',
                'voice_challenge_completed'
            ];

            for (let i = 0; i < betweenTypes.length; i++) {
                const target = challenge[betweenTypes[i]];
                const completed = challenge[completedTypes[i]];

                if (target && currentMessages >= target && !completed) {
                    const eventType = betweenTypes[i].replace('_target', '');
                    betweenEvents.push(eventType);

                    await dbManager.markBetweenTargetCompleted(guildId, eventType);

                    if (originalMessage && originalMessage.channel) {
                        await this.startBetweenChallenge(guildId, originalMessage.channel, {
                            type: eventType,
                            target: target
                        });
                    }
                }
            }

            return { levelEvents, betweenEvents };

        } catch (error) {
            console.error('Error checking and triggering events:', error);
            return {};
        }
    }

    async initializeNewChallenge(guildId) {
        try {
            const targets = this.generateAllTargets();
            await dbManager.saveGlobalChallengeTargets(guildId, targets);
            console.log(`✅ Initialized new challenge for guild ${guildId}`);
        } catch (error) {
            console.error('Error initializing new challenge:', error);
        }
    }

    // ========== CHALLENGE SELECTION ==========
    async startLevelChallenge(guildId, channel, level) {
        try {
            const challengeType = this.selectLevelChallenge(level);
            const challengeInfo = this.challengeTypes[challengeType];

            if (!challengeInfo) return null;

            const challengeData = await challengeInfo.generateData();
            const dropType = this.dropTypes[level];

            return await this.createChallenge(
                guildId, 
                channel, 
                challengeType, 
                challengeInfo, 
                challengeData, 
                dropType,
                level.toUpperCase(),
                'level'
            );

        } catch (error) {
            console.error(`Error starting ${level} challenge:`, error);
            return null;
        }
    }

    async startBetweenChallenge(guildId, channel, eventData) {
        try {
            const challengeType = this.selectBetweenChallenge(eventData.type);
            const challengeInfo = this.challengeTypes[challengeType];

            if (!challengeInfo) return null;

            const challengeData = await challengeInfo.generateData();

            return await this.createChallenge(
                guildId,
                channel,
                challengeType,
                challengeInfo,
                challengeData,
                null,
                'BONUS',
                'between'
            );

        } catch (error) {
            console.error('Error starting between challenge:', error);
            return null;
        }
    }

    getCorrectAnswer(challengeType, data) {
        switch(challengeType) {
            case 'quick_math':
            case 'nebula_quick_math':
            case 'advanced_math':
            case 'nebula_advanced_math':
            case 'meteoroid_advanced_math':
                return data.answer.toString().toLowerCase();

            case 'dice_roll':
                return data.correct.toString();

            case 'hidden_text':
            case 'find_word':
                return data.answer.toLowerCase();

            case 'lucky_number':
                return data.correct.toString();

            case 'random_keyword':
                return data.keyword.toLowerCase();

            case 'fast_typing':
                return data.phrase.toLowerCase();

            case 'trivia':
            case 'nebula_trivia':
            case 'meteoroid_trivia':
                return data.correctAnswer.toLowerCase();

            case 'first_voice_join':
                return null;

            default:
                return null;
        }
    }

    selectLevelChallenge(level) {
        const challenges = {
            'star': ['first_click', 'first_mention', 'quick_math', 'dice_roll', 'trivia', 'find_word'],
            'comet': ['first_click', 'first_mention', 'quick_math', 'dice_roll', 'trivia', 'find_word'],
            'nebula': ['nebula_click', 'nebula_trivia', 'nebula_advanced_math', 'nebula_quick_math'],
            'meteoroid': ['meteoroid_trivia', 'meteoroid_advanced_math', 'legendary_mix']
        };

        const available = challenges[level] || challenges.star;
        return available[Math.floor(Math.random() * available.length)];
    }

    selectBetweenChallenge(eventType = 'star') {
        const challenges = {
            'before_star': ['hidden_text', 'lucky_number', 'random_keyword', 'fast_typing'],
            'star_comet': ['hidden_text', 'lucky_number', 'random_keyword', 'fast_typing'],
            'comet_nebula': ['hidden_text', 'lucky_number', 'random_keyword', 'fast_typing'],
            'nebula_meteoroid': ['hidden_text', 'lucky_number', 'random_keyword', 'fast_typing'],
            'voice_challenge': ['first_voice_join']
        };

        const available = challenges[eventType] || challenges.before_star;
        return available[Math.floor(Math.random() * available.length)];
    }

    // ========== CHALLENGE CREATION ==========
    async createChallenge(guildId, channel, type, info, data, dropType, levelTag, challengeType) {
        try {
            const challengeId = `${guildId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

            const challenge = {
                id: challengeId,
                type: type,
                guildId: guildId,
                channelId: channel.id,
                data: this.compressChallengeData(data, type),
                dropType: dropType,
                info: { 
                    name: info.name, 
                    emoji: info.emoji, 
                    duration: info.duration
                },
                levelTag: levelTag,
                challengeType: challengeType,
                isActive: true,
                startedAt: Date.now(),
                expiresAt: Date.now() + (info.duration * 1000),
                participants: [],
                winner: null,
                correctAnswer: this.getCorrectAnswer(type, data)
            };

            if (type === 'first_voice_join') {
                challenge.voiceData = {
                    participants: new Map(),
                    winners: new Map()
                };
            }

            this.activeChallenges.set(challengeId, challenge);

            const messageOptions = info.createMessage(challenge, channel);
            const message = await channel.send(messageOptions);

            this.activeChallengeMessages.set(challengeId, message.id);
            challenge.messageId = message.id;

            // ⭐⭐ Auto-expire ⭐⭐
            setTimeout(() => {
                if (this.activeChallenges.has(challengeId) && this.activeChallenges.get(challengeId).isActive) {
                    console.log(`⏰ Challenge ${challengeId} expired!`);
                    this.sendChallengeEndedMessage(channel, challenge);
                    this.endChallenge(challengeId, 'timeout');
                }
            }, info.duration * 1000);

            console.log(`🎮 Started ${type} challenge (${challengeType}) in ${channel.guild.name}`);

            return challengeId;

        } catch (error) {
            console.error('Error creating challenge:', error);
            return null;
        }
    }

    // ⭐⭐ دالة ضغط البيانات ⭐⭐
    compressChallengeData(data, type) {
        switch(type) {
            case 'quick_math':
                return { 
                    question: data.question,
                    answer: data.answer 
                };

            case 'first_click':
                return {
                    correctIndex: data.correctIndex
                };

            case 'first_voice_join':
                return {
                    stayRequired: data.stayRequired,
                    rewardRange: data.rewardRange
                };

            default:
                return data;
        }
    }

    // ⭐⭐ دالة إرسال إشعار انتهاء الوقت ⭐⭐
    async sendChallengeEndedMessage(channel, challenge) {
        try {
            let content = '';

            if (challenge.type === 'first_voice_join') {
                const minutesRequired = Math.floor(challenge.data.stayRequired / 60);
                content = `### ⏰ TIME'S UP! 🎧\n-# **Voice Party Challenge has ended!**\n\n` +
                         `⏳ Required Time: **${minutesRequired} minute(s)**\n` +
                         `-# Final results will be announced shortly...`;
            } else {
                content = `### ⏰ TIME'S UP!\n-# **${challenge.info.name} challenge has ended!**\n\n` +
                         `😢 **No one answered correctly in time.**\n\n` +
                         `-# 🎯 Correct answer was: **${challenge.correctAnswer || 'Hidden'}**\n`;
            }

            const container = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(content)
                );

            const timeoutMsg = await channel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            // ⭐⭐ حذف الرسالة بعد 15 ثانية ⭐⭐
            setTimeout(() => {
                if (timeoutMsg && timeoutMsg.deletable) {
                    timeoutMsg.delete().catch(() => {});
                }
            }, 15000);

            // ⭐⭐ حذف رسالة التحدي الأصلية بعد 5 ثواني ⭐⭐
            setTimeout(() => {
                if (challenge.messageId) {
                    channel.messages.fetch(challenge.messageId)
                        .then(msg => {
                            if (msg && msg.deletable) {
                                msg.delete().catch(() => {});
                            }
                        })
                        .catch(() => {});
                }
            }, 5000);

        } catch (error) {
            console.error('Error sending challenge ended message:', error);
        }
    }

    // ========== VOICE JOIN CHALLENGE METHODS ==========
    generateVoiceJoinData() {
        const minStay = 120;
        const maxStay = 180;
        const stayRequired = this.getRandomBetween(minStay, maxStay);

        return {
            challengeId: `voice_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
            startedAt: Date.now(),
            duration: 600,
            stayRequired: stayRequired,
            participants: new Map(),
            winners: new Map(),
            timers: new Map(),
            rewardRange: { 
                xp: { min: 100, max: 500 },
                coins: { min: 100, max: 500 }
            }
        };
    }

    createVoiceJoinMessageV2(challenge, channel) {
        // ⭐⭐ **الإصلاح: كل مستخدم مع قناته الخاصة** ⭐⭐
        const voiceChannels = channel.guild.channels.cache
            .filter(ch => ch.isVoiceBased());

        let totalParticipants = 0;

        voiceChannels.forEach(targetChannel => {
            if (!targetChannel.members) return;

            // ⭐⭐ **الإصلاح: لا نعيين voiceChannelId هنا** ⭐⭐
            // challenge.data.voiceChannelId = targetChannel.id; // ❌ تم إزالة هذا السطر

            targetChannel.members.forEach(member => {
                if (!member.user.bot) {
                    const userId = member.id;
                    const username = member.user.username;

                    if (!challenge.voiceData.participants.has(userId)) {
                        const bonusTime = Math.floor(Math.random() * 60) * 1000;
                        const adjustedJoinTime = Date.now() - bonusTime;

                        challenge.voiceData.participants.set(userId, {
                            username: username,
                            joinTime: adjustedJoinTime,
                            channelId: targetChannel.id, // ⭐⭐ كل مستخدم مع قناته ⭐⭐
                            hasWon: false,
                            existingUser: true,
                            bonusTime: bonusTime
                        });

                        totalParticipants++;
                        console.log(`✅ Added existing user from ${targetChannel.name}: ${username} (${Math.floor(bonusTime/1000)}s bonus)`);
                    }
                }
            });
        });

        console.log(`🎯 Total existing users added: ${totalParticipants}`);

        const minutesRequired = Math.floor(challenge.data.stayRequired / 60);
        const endTime = Math.floor(challenge.expiresAt / 1000);

        const container = new ContainerBuilder()
            .setAccentColor(0x0073ff)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `### 🎧 VOICE PARTY CHALLENGE\n\n` +
                    `Join a voice channel and stay **${minutesRequired} min** to win 🎉\n\n` +
                    `⏰ **Time Left:** <t:${endTime}:R>\n\n` +
                    `👥 **Participants (${challenge.voiceData.participants.size}):**\n` +
                    `${this.getVoiceParticipantsList(challenge)}\n\n` +
                    `🏆 **Winners:**\n-# Everyone who stays required minutes wins\n` +
                    `### ⚠️ **Rules:**\n-# Join after start • Stay full time • No bots`
                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    async processMultiVoiceJoinWin(voiceState, challenge) {
        try {
            const userId = voiceState.id;
            const username = voiceState.member?.user?.username;

            if (voiceState.member?.user?.bot) return false;
            if (!voiceState.channelId) return false;
            if (!challenge.isActive) return false;

            // ⭐⭐ بيانات مخففة ⭐⭐
            if (!challenge.voiceData.participants.has(userId)) {
                challenge.voiceData.participants.set(userId, {
                    username: username,
                    joinTime: Date.now(),
                    channelId: voiceState.channelId,
                    hasWon: false
                    // ⭐⭐ إزالة existingUser و bonusTime ⭐⭐
                });

                console.log(`🎧 ${username} joined voice for challenge! (${challenge.voiceData.participants.size} total)`);
                this.updateVoiceChallengeMessage(challenge);
            }

            return true;

        } catch (error) {
            console.error('Error processing voice join:', error);
            return false;
        }
    }

    async checkVoiceWinnersAtEnd(challenge) {
        try {
            const now = Date.now();
            const stayRequired = challenge.data.stayRequired * 1000;

            console.log(`🔍 Checking voice winners for ${challenge.data.stayRequired} seconds requirement`);
            console.log(`📊 Total participants: ${challenge.voiceData.participants.size}`);

            for (const [userId, participant] of challenge.voiceData.participants) {
                if (participant.hasWon) {
                    console.log(`   ⏭️ ${participant.username} already won, skipping`);
                    continue;
                }

                const timeInVoice = now - participant.joinTime;
                const timeInfo = participant.existingUser ? 
                    `(existing user, had ${Math.floor(participant.bonusTime/1000)}s bonus)` : 
                    `(joined after challenge start)`;

                console.log(`   👤 ${participant.username}: ${Math.floor(timeInVoice/1000)}s in voice ${timeInfo}`);

                if (timeInVoice >= stayRequired) {
                    console.log(`   ✅ ${participant.username} completed requirement!`);

                    const baseXp = 100;
                    const baseCoins = 80;
                    const timeMultiplier = Math.min(2, timeInVoice / stayRequired);

                    const xpReward = Math.round(baseXp * timeMultiplier) + this.getRandomBetween(0, 200);
                    const coinsReward = Math.round(baseCoins * timeMultiplier) + this.getRandomBetween(0, 150);

                    const crystalChance = participant.existingUser ? 0.5 : 0.3;
                    const crystals = Math.random() < crystalChance ? this.getRandomBetween(1, 3) : 0;

                    const bonusXp = participant.existingUser ? this.getRandomBetween(50, 100) : 0;
                    const bonusCoins = participant.existingUser ? this.getRandomBetween(30, 70) : 0;

                    const totalXp = xpReward + bonusXp;
                    const totalCoins = coinsReward + bonusCoins;

                    console.log(`   🎁 Rewards: ${totalXp} XP, ${totalCoins} coins, ${crystals} crystals`);

                    await dbManager.run(
                        `UPDATE levels 
                         SET sky_coins = sky_coins + ?,
                             xp = xp + ?,
                             sky_crystals = sky_crystals + ?,
                             updated_at = CURRENT_TIMESTAMP
                         WHERE user_id = ?`,
                        [totalCoins, totalXp, crystals, userId]
                    );

                    participant.hasWon = true;
                    participant.winTime = now;
                    participant.xpReward = totalXp;
                    participant.coinsReward = totalCoins;
                    participant.crystalsReward = crystals;
                    participant.timeSpent = Math.floor(timeInVoice / 1000);

                    // ⭐⭐ بيانات مخففة للفائزين ⭐⭐
                    challenge.voiceData.winners.set(userId, {
                        username: participant.username,
                        xpReward: totalXp,
                        coinsReward: totalCoins,
                        crystalsReward: crystals
                        // ⭐⭐ إزالة timeSpent, winTime, wasExistingUser ⭐⭐
                    });

                    console.log(`✅ ${participant.username} won with ${Math.floor(timeInVoice/1000)} seconds!`);
                } else {
                    console.log(`   ❌ ${participant.username} needs ${Math.ceil((stayRequired - timeInVoice)/1000)}s more`);
                }
            }

            console.log(`🏆 Total winners found: ${challenge.voiceData.winners.size}`);
            return challenge.voiceData.winners;

        } catch (error) {
            console.error('Error checking voice winners:', error);
            return new Map();
        }
    }

    endChallenge(challengeId, reason) {
        const challenge = this.activeChallenges.get(challengeId);
        if (!challenge) {
            console.log(`⚠️ Challenge ${challengeId} not found for ending`);
            return;
        }

        console.log(`🔚 Ending challenge ${challengeId} (${reason}) - Type: ${challenge.type}`);

        if (challenge.type === 'first_voice_join') {
            console.log('🎧 Processing voice challenge cleanup...');

            if (challenge.voiceData) {
                // ⭐⭐ تنظيف timers مع التحقق ⭐⭐
                if (challenge.voiceData.timers && Array.isArray(challenge.voiceData.timers)) {
                    try {
                        let clearedCount = 0;
                        for (const timerId of challenge.voiceData.timers) {
                            if (timerId) {
                                clearTimeout(timerId);
                                clearedCount++;
                            }
                        }
                        console.log(`   Cleared ${clearedCount} timers`);
                    } catch (timerError) {
                        console.error('Error clearing timers:', timerError.message);
                    }
                } else {
                    console.log('   No timers array found or not an array');
                }

                // ⭐⭐ تأخير قبل التحقق من الفائزين ⭐⭐
                if (challenge.channelId) {
                    setTimeout(() => {
                        this.checkVoiceWinnersAtEnd(challenge).then(winners => {
                            console.log(`   Found ${winners?.size || 0} voice winners`);
                            this.sendVoiceChallengeEndReport(challenge, winners, reason);
                        }).catch(err => {
                            console.error('Error checking voice winners:', err.message);
                            this.sendVoiceChallengeEndReport(challenge, new Map(), reason);
                        });
                    }, 3000); // ⭐⭐ 3 ثواني بدل 1 ⭐⭐
                }
            } else {
                console.log('⚠️ No voiceData found for voice challenge');
            }
        }

        challenge.isActive = false;
        this.activeChallenges.delete(challengeId);

        const messageId = this.activeChallengeMessages.get(challengeId);
        if (messageId) {
            this.activeChallengeMessages.delete(challengeId);
            console.log(`   Cleared message ${messageId}`);
        }

        console.log(`✅ Challenge ${challengeId} ended successfully`);

        if (global.gc) {
            global.gc();
        }
    }

    async sendVoiceChallengeEndReport(challenge, winners, reason) {
        try {
            const channel = this.client.channels.cache.get(challenge.channelId);
            if (!channel) return;

            const participants = challenge.voiceData?.participants.size || 0;
            const winnersCount = winners.size || 0;
            const minutesRequired = Math.floor(challenge.data.stayRequired / 60);

            let reportContent = `## 🎧 VOICE PARTY ENDED\n\n` +
                `**Challenge ${reason === 'timeout' ? 'expired' : 'completed'}!**\n\n` +
                `📊 **Final Results:**\n` +
                `• **Participants:** ${participants}\n` +
                `• **Winners:** ${winnersCount}\n` +
                `• **Success Rate:** ${participants > 0 ? Math.round((winnersCount / participants) * 100) : 0}%\n\n` +
                `-# ⏳ **Required Stay Time:** ${minutesRequired} minute(s)\n`;

            if (winnersCount > 0) {
                reportContent += `🏆 **All Winners:**\n`;

                let winnerIndex = 1;
                for (const [userId, winner] of winners) {
                    const rewardText = `${winner.xpReward} XP, ${winner.coinsReward} coins` + 
                                     (winner.crystalsReward > 0 ? `, ${winner.crystalsReward} crystal(s)` : '');

                    reportContent += `**${winnerIndex}. ${winner.username}**\n`;
                    reportContent += `   ${rewardText}\n\n`;
                    winnerIndex++;
                }

                reportContent += `🎉 **Congratulations to all winners!**\n`;
                reportContent += `-# *Rewards have been sent to your accounts.*`;
            } else {
                reportContent += `\n😢 **No winners this time!**\n`;
                reportContent += `-# *No one stayed in voice for ${minutesRequired} minute(s).*\n\n`;

                if (challenge.voiceData?.participants.size > 0) {
                    reportContent += `📋 **Participants who didn't complete:**\n`;
                    for (const [userId, participant] of challenge.voiceData.participants) {
                        if (!participant.hasWon) {
                            const timeSpent = Math.floor((Date.now() - participant.joinTime) / 1000);
                            const timeNeeded = challenge.data.stayRequired - timeSpent;
                            if (timeNeeded > 0) {
                                reportContent += `• ${participant.username}: needed ${Math.ceil(timeNeeded/60)} more minute(s)\n`;
                            }
                        }
                    }
                }
            }

            const reportContainer = new ContainerBuilder()
                .setAccentColor(winnersCount > 0 ? 0x0073ff : 0xFFA500)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(reportContent)
                );

            const reportMsg = await channel.send({
                components: [reportContainer],
                flags: MessageFlags.IsComponentsV2
            });

            setTimeout(() => {
                if (reportMsg && reportMsg.deletable) {
                    reportMsg.delete().catch(() => {});
                }
            }, 30000);

        } catch (error) {
            console.error('Error sending voice challenge end report:', error);
        }
    }

    getVoiceParticipantsList(challenge) {
        if (!challenge.voiceData || challenge.voiceData.participants.size === 0) {
            return "No participants yet";
        }

        const participants = Array.from(challenge.voiceData.participants.values())
            .filter(p => !p.hasWon)
            .slice(0, 15);

        return participants
            .map((p, index) => `${index + 1}. ${p.username}`)
            .join('\n') + 
            (challenge.voiceData.participants.size > 15 ? 
             `\n... and ${challenge.voiceData.participants.size - 15} more` : '');
    }

    getVoiceWinnersList(challenge) {
        if (!challenge.voiceData || challenge.voiceData.winners.size === 0) {
            return "No winners yet";
        }

        const winners = Array.from(challenge.voiceData.winners.values());
        return winners.map(w => `• ${w.username}`).join('\n');
    }

    async updateVoiceChallengeMessage(challenge) {
        try {
            if (!challenge.messageId) return;

            const channel = this.client.channels.cache.get(challenge.channelId);
            if (!channel) return;

            const message = await channel.messages.fetch(challenge.messageId);
            if (!message) return;

            const minutesRequired = Math.floor(challenge.data.stayRequired / 60);
            const endTime = Math.floor(challenge.expiresAt / 1000);

            const updatedContainer = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(
                        `## 🎧 VOICE PARTY CHALLENGE\n\n` +
                        `Join a voice channel and stay **${minutesRequired} min** to win 🎉\n\n` +
                        `⏰ **Time Left:** <t:${endTime}:R>\n\n` +
                        `👥 **Participants:**\n` +
                        `${this.getVoiceParticipantsList(challenge)}\n\n` +
                        `🏆 **Winners:**\n-# Everyone who stays required minutes wins\n` +
                        `⚠️ **Rules:**\n-# Join after start • Stay full time • No bots`
                    )
                );

            await message.edit({
                components: [updatedContainer],
                flags: MessageFlags.IsComponentsV2
            });

        } catch (error) {
            console.error('Error updating voice challenge message:', error);
        }
    }

    // ========== OTHER V2 MESSAGE CREATORS ==========
    createClickMessageV2(challenge, channel) {
        const isLegendary = challenge.levelTag === 'METEOROID';
        const isNebula = challenge.levelTag === 'NEBULA';
        const color = isLegendary ? 0xFF4500 : 
                     isNebula ? 0x8A2BE2 : 
                     challenge.levelTag === 'COMET' ? 0x00BFFF : 0xFFD700;

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `\`\`\`🎯 **Objective:** Click the correct button to win\`\`\`\n` +
                    `⏰ **Duration:** ${challenge.info.duration}s\n`
                    `-# *Challenge: ${challenge.info.name}*\n`
                )
            );

        const actionRow = new ActionRowBuilder();
        for (let i = 0; i < 4; i++) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${challenge.id}_${i}`)
                    .setLabel(`${['Ace', 'Pro', 'Win', 'Try'][i]}`)
                    .setStyle(i === challenge.data.correctIndex ? ButtonStyle.Primary : ButtonStyle.Secondary)
            );
        }

        container.addActionRowComponents(actionRow);

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    createMentionMessageV2(challenge, channel) {
        const color = challenge.levelTag === 'COMET' ? 0x00BFFF : 0xFFD700;

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `💬 **Objective:** First to mention the bot!\n` +
                    `\`\`\`Mention --@${this.client.user.username}-- in chat.\`\`\`\n` +
                    `⏱️ **Duration:** ${challenge.info.duration}s`
                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    createMathMessageV2(challenge, channel) {
        const isNebula = challenge.levelTag === 'NEBULA';
        const isLegendary = challenge.levelTag === 'METEOROID';
        const color = isLegendary ? 0xFF4500 : 
                     isNebula ? 0x8A2BE2 : 
                     challenge.levelTag === 'COMET' ? 0x00BFFF : 0xFFD700;

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `💡 **Solve this equation:**\n` +
                    `\`\`\`${challenge.data.question} = ?\`\`\`\n` +
                    `⏱️ **Duration:** ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Answer in chat!**\n`

                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    createAdvancedMathMessageV2(challenge, channel) {
        const isLegendary = challenge.levelTag === 'METEOROID';
        const isNebula = challenge.levelTag === 'NEBULA';
        const color = isLegendary ? 0xFF4500 : 
                     isNebula ? 0x8A2BE2 : 
                     challenge.levelTag === 'COMET' ? 0x00BFFF : 0xFFD700;

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `💡 **Advanced Math Challenge:**\n` +
                    `\`\`\`${challenge.data.question} = ?\`\`\`\n` +
                    `⏱️ **Duration:** ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Answer in chat!**`
                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    createDiceMessageV2(challenge, channel) {
        const isLegendary = challenge.levelTag === 'METEOROID';
        const isNebula = challenge.levelTag === 'NEBULA';
        const color = isLegendary ? 0xFF4500 : 
                     isNebula ? 0x8A2BE2 : 
                     challenge.levelTag === 'COMET' ? 0x00BFFF : 0xFFD700;

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `**Roll the dice!**\n` +
                    `\`\`\`Guess the correct number (1 - 6)\`\`\`\n` +
                    `⏱️ **Duration:** ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Type your guess (1-6) in chat!**`

                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

createHiddenMessageV2(challenge, channel) {
    const color = 0x00BFFF;

    const hiddenDisplay = challenge.data.hidden || "▪️ ▪️ ▪️ ▪️ ▪️";

    const container = new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents((textDisplay) =>
            textDisplay.setContent(
                `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                `🔍 **Find the hidden word!**\n` +
                `\`\`\`${hiddenDisplay}\`\`\`\n\n` +
                `💡 **Hint:** ${challenge.data.hint || `Word has ${challenge.data.wordLength} letters`}\n` +
                `⏱️ **Duration:** ${challenge.info.duration}s\n\n` +
                `-# ✏️ **Type the hidden word lowercase only in chat!**`
            )
        );

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2
    };
}

    createFindWordMessageV2(challenge, channel) {
        const isLegendary = challenge.levelTag === 'METEOROID';
        const isNebula = challenge.levelTag === 'NEBULA';
        const color = isLegendary ? 0xFF4500 : 
                     isNebula ? 0x8A2BE2 : 
                     challenge.levelTag === 'COMET' ? 0x00BFFF : 0xFFD700;

        const data = challenge.data;
        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `🔍 **Find the Word!**\n\n` +
                    `\`\`\`${data.displayWord}\`\`\`\n\n` +
                    `💡 Hint: ${data.hint}\n` +
                    `🔤 Letters: ${data.letters.join(' , ')}\n\n` +
                    `⏱️ Duration: ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Type the complete word lowercase in chat!**`
                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    createLuckyMessageV2(challenge, channel) {
        const color = 0x00BFFF;

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `💡 **Guess the lucky number!**\n` +
                    `\`\`\`I'm thinking of a number between 1 and 100\`\`\`\n` +
                    `⏱️ Duration: ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Type your guess (1-100) in chat!**`

                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    // ========== KEYWORD CHALLENGE MESSAGE ==========
    async createKeywordMessageV2(challenge, channel) {
        const color = 0x00BFFF;

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `💡 **Remember and type the keyword lowercase!**\n` +
                    `The keyword will appear for **5 seconds**...\n\n` +
                    `⏱️ Duration: ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Get ready to memorize!**`
                )
            );

        const messageOptions = {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };

        try {
            const message = await channel.send(messageOptions);
            console.log(`📝 Sent keyword challenge message: ${message.id}`);

            setTimeout(async () => {
                try {
                    if (!this.activeChallenges.has(challenge.id)) {
                        console.log(`⚠️ Challenge ${challenge.id} ended before keyword reveal`);
                        return;
                    }

                    const updatedContainer = new ContainerBuilder()
                        .setAccentColor(0x0073ff)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `## 🌀 KEYWORD APPEARS!\n\n` +
                                `\`\`\`${challenge.data.keyword}\`\`\`\n` +
                                `**Type this word quickly!**\n` +
                                `-# *Disappears in 5 seconds...*`
                            )
                        );

                    await message.edit({
                        components: [updatedContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    console.log(`🔠 Keyword "${challenge.data.keyword}" revealed for 5 seconds`);

                    setTimeout(async () => {
                        try {
                            if (!this.activeChallenges.has(challenge.id)) {
                                console.log(`⚠️ Challenge ${challenge.id} ended before revert`);
                                return;
                            }

                            await message.edit(messageOptions);
                            console.log(`↩️ Reverted keyword message to original`);
                        } catch (error) {
                            console.error('Error reverting keyword message:', error.message);
                        }
                    }, 5000);

                } catch (error) {
                    console.error('Error showing keyword:', error.message);
                }
            }, 2000);

            // ⭐⭐ **التعديل: لا نحذف الرسالة تلقائياً** ⭐⭐
            challenge.messageId = message.id;

            return messageOptions;

        } catch (error) {
            console.error('❌ Error sending keyword message:', error.message);
            return messageOptions;
        }
    }

    createTypingMessageV2(challenge, channel) {
        const color = 0x00BFFF;

        const displayText = challenge.data.displayPhrase || challenge.data.phrase.toUpperCase();

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `💡 **Type this phrase exactly as shown:**\n` +
                    `\`\`\`${displayText}\`\`\`\n` +
                    `⏱️ Duration: ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Type the phrase lowercase only in chat!`
                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    createTriviaMessageV2(challenge, channel) {
        const isLegendary = challenge.levelTag === 'METEOROID';
        const isNebula = challenge.levelTag === 'NEBULA';
        const color = isLegendary ? 0xFF4500 : 
                     isNebula ? 0x8A2BE2 : 
                     challenge.levelTag === 'COMET' ? 0x00BFFF : 0xFFD700;

        const allOptions = [challenge.data.correctAnswer, ...challenge.data.wrongAnswers];
        const shuffledOptions = this.shuffleArray([...allOptions]);

        const container = new ContainerBuilder()
            .setAccentColor(color)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE\n\n\n` +
                    `💡 **Trivia Question:**\n` +
                    `\`\`\`${challenge.data.question}\`\`\`\n` +
                    `𝓐) ${shuffledOptions[0]}\n` +
                    `𝓑) ${shuffledOptions[1]}\n` +
                    `𝓒) ${shuffledOptions[2]}\n` +
                    `𝓓) ${shuffledOptions[3]}\n\n` +
                    `⏱️ Duration: ${challenge.info.duration}s\n\n` +
                    `-# ✏️ **Type the correct answer text in chat!**`

                )
            );

        challenge.data.correctIndex = shuffledOptions.indexOf(challenge.data.correctAnswer);

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    createLegendaryMessageV2(challenge, channel) {
        const container = new ContainerBuilder()
            .setAccentColor(0xFF4500)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent(
                    `## ${challenge.info.emoji} ${challenge.levelTag} CHALLENGE 🏆\n\n` +
                    `### 🔥 LEGENDARY CHALLENGE! 🔥\n\n` +
                    `💡 **Ultimate test of skill and luck!**\n\n` +
                    `🎁 Reward: LEGENDARY DROP + Massive Rewards!\n\n` +
                    `⏱️ Duration: ${challenge.info.duration}s | 🏆 Bonus: Guaranteed crystals for winner!\n\n` +
                    `-# ⚠️ **Warning:** Extremely difficult challenge ahead!`

                )
            );

        return {
            components: [container],
            flags: MessageFlags.IsComponentsV2
        };
    }

    // ========== WIN HANDLING ==========
    async handleChallengeWin(challengeId, userId, username) {
        try {
            const challenge = this.activeChallenges.get(challengeId);
            if (!challenge || !challenge.isActive || challenge.winner) {
                console.log(`⚠️ Challenge ${challengeId} not found or already has winner`);
                return false;
            }

            challenge.isActive = false;
            challenge.winner = { userId, username, time: Date.now() };

            let xp, coins, crystals = 0, dropType = null;

            if (challenge.challengeType === 'between') {
                const betweenType = this.getBetweenTypeFromLevel(challenge.levelTag);
                const rewards = this.betweenRewards[betweenType] || this.betweenRewards['star-comet'];
                xp = this.getRandomBetween(rewards.xp.min, rewards.xp.max);
                coins = this.getRandomBetween(rewards.coins.min, rewards.coins.max);

                if (challenge.type === 'first_voice_join') {
                    if (Math.random() < 0.3) {
                        crystals = this.getRandomBetween(1, 3);
                    }
                }
            } else {
                const level = challenge.levelTag.toLowerCase();
                const rewards = this.levelRewards[level] || this.levelRewards.star;
                xp = this.getRandomBetween(rewards.xp.min, rewards.xp.max);
                coins = this.getRandomBetween(rewards.coins.min, rewards.coins.max);
                dropType = challenge.dropType;

                if (Math.random() < rewards.crystalChance) {
                    crystals = this.getRandomBetween(rewards.crystals.min, rewards.crystals.max);
                }
            }

            console.log(`🏆 ${username} won ${challenge.type} challenge (${challenge.levelTag})`);
            console.log(`   Base Rewards: ${xp} XP, ${coins} coins, ${crystals} crystals, Drop: ${dropType || 'None'}`);

            let userBuff = 0;
            let finalReward = { xp, coins, crystals };

            try {
                const guild = this.client.guilds.cache.get(challenge.guildId);
                if (guild && buffSystem) {
                    userBuff = await buffSystem.getBuff(userId, guild);
                    if (userBuff > 0) {
                        console.log(`📈 Applying ${userBuff}% buff to ${username}'s challenge reward`);
                        finalReward = buffSystem.applyBuff(finalReward, userBuff);
                        console.log(`   Buff Applied: ${userBuff}% → Final: ${finalReward.xp} XP, ${finalReward.coins} coins`);
                    }
                }
            } catch (buffError) {
                console.error(`⚠️ Buff system error for ${username}:`, buffError.message);
            }


            const rewardResult = await levelSystem.processUserRewards(
                userId,
                username,
                finalReward.xp,
                finalReward.coins,
                finalReward.crystals,
                this.client,
                this.client.guilds.cache.get(challenge.guildId),
                'challenge',
                true
            );

            if (!rewardResult.success) {
                console.error(`❌ Failed to process challenge reward for ${username}:`, rewardResult.error);
                return false;
            }

            console.log(`✅ Challenge rewards processed for ${username}`);
            console.log(`   Actual Rewards: ${rewardResult.xp} XP, ${rewardResult.coins} coins, ${rewardResult.crystals} crystals`);
            console.log(`   Level Up: ${rewardResult.levelUp ? 'Yes → Level ' + rewardResult.newLevel : 'No'}`);

            if (dropType) {
                try {
                    const crateResult = await dbManager.createCrate(userId, username, dropType);
                    if (crateResult.success) {
                        console.log(`📦 ${dropType.toUpperCase()} crate added to ${username}'s inventory`);
                    } else {
                        console.error(`❌ Failed to create crate for ${username}:`, crateResult.error);
                    }
                } catch (crateError) {
                    console.error(`❌ Crate creation error for ${username}:`, crateError.message);
                }
            }

            const channel = this.client.channels.cache.get(challenge.channelId);
            if (channel) {
                const timeTaken = ((Date.now() - challenge.startedAt) / 1000).toFixed(1);

                try {
                    if (challenge.messageId) {
                        const originalMsg = await channel.messages.fetch(challenge.messageId);
                        if (originalMsg && originalMsg.deletable) {
                            await originalMsg.delete();
                            console.log(`🗑️ Deleted challenge message: ${challenge.messageId}`);
                        }
                    }
                } catch (deleteError) {
                    console.error('Error deleting original challenge message:', deleteError.message);
                }

                try {
                    const winContainer = new ContainerBuilder()
                        .setAccentColor(0x00FF00)
                        .addTextDisplayComponents((textDisplay) =>
                            textDisplay.setContent(
                                `### 🎉 **Congratulations <@${userId}>!**\n` +
                                `You won the **${challenge.info.name}** challenge!\n\n` +
                                `🎁 **Rewards:** ${rewardResult.xp} XP ||&|| ${rewardResult.coins} coins` +
                                `${rewardResult.crystals > 0 ? `, ${rewardResult.crystals} crystal(s)` : ''}\n` +
                                `📦 **Drop:** ${dropType ? `${dropType.toUpperCase()} Crate` : 'XP + Coins Only'}\n` +
                                `${rewardResult.levelUp ? `🎊 **Level Up!** (Now Level ${rewardResult.newLevel})` : ''}\n\n` +
                                `-# ⏱️ **Time Taken:** ${timeTaken}s`
                            )
                        );

                    const winMsg = await channel.send({
                        components: [winContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    // ⭐⭐ حذف رسالة الفوز بعد 25 ثانية ⭐⭐
                    setTimeout(() => {
                        if (winMsg && winMsg.deletable) {
                            winMsg.delete().catch(() => {});
                        }
                    }, 25000);

                } catch (msgError) {
                    console.error('Error sending win message:', msgError.message);
                }
            }

            this.endChallenge(challengeId, 'winner');

            console.log(`✅ ${username} successfully won ${challenge.type} challenge!`);

            return true;

        } catch (error) {
            console.error('❌ Error handling win:', error);
            console.error('Error details:', {
                challengeId,
                userId,
                username,
                errorMessage: error.message,
                stack: error.stack?.split('\n')[0]
            });
            return false;
        }
    }

    // ========== WIN PROCESSORS ==========
    async processClickWin(interaction, challenge) {
        const buttonIndex = parseInt(interaction.customId.split('_').pop());

        if (challenge.data.correctIndex === buttonIndex) {
            await this.handleChallengeWin(challenge.id, interaction.user.id, interaction.user.username);
            await interaction.reply({ 
                content: '🎉 Correct! You won the challenge and take all rewards!', 
                flags: MessageFlags.Ephemeral 
            });
            return true;
        } else {
            await interaction.reply({ 
                content: '❌ Wrong button! Try another.', 
                flags: MessageFlags.Ephemeral 
            });
            return false;
        }
    }

    async processMentionWin(message, challenge) {
        if (message.mentions.has(this.client.user.id)) {
            await this.handleChallengeWin(challenge.id, message.author.id, message.author.username);

            setTimeout(() => {
                if (message.deletable) {
                    message.delete().catch(() => {});
                }
            }, 5000);
            return true;
        }
        return false;
    }

    async processAnswerWin(challenge, userId, username, answer) {
        const normalizedAnswer = answer.trim().toLowerCase();
        let isCorrect = false;

        switch(challenge.type) {
            case 'quick_math':
            case 'nebula_quick_math':
            case 'advanced_math':
            case 'nebula_advanced_math':
            case 'meteoroid_advanced_math':
                const correctAnswer = challenge.data.answer.toString().toLowerCase();
                isCorrect = normalizedAnswer === correctAnswer;
                break;

            case 'dice_roll':
                const diceAnswer = challenge.data.correct.toString();
                isCorrect = normalizedAnswer === diceAnswer;
                break;

            case 'hidden_text':
                const correctHiddenWord = challenge.data.answer.toLowerCase();
                isCorrect = normalizedAnswer === correctHiddenWord;
                break;

            case 'find_word':
                    isCorrect = normalizedAnswer === challenge.data.answer.toLowerCase();
                    break;

            case 'lucky_number':
                const guess = parseInt(normalizedAnswer);
                isCorrect = !isNaN(guess) && guess === challenge.data.correct;
                break;

            case 'random_keyword':
                isCorrect = normalizedAnswer === challenge.data.keyword.toLowerCase();
                break;

            case 'fast_typing':
                isCorrect = normalizedAnswer === challenge.data.phrase.toLowerCase();
                break;

            case 'trivia':
            case 'nebula_trivia':
            case 'meteoroid_trivia':
                const correctTriviaAnswer = challenge.data.correctAnswer.toLowerCase();
                isCorrect = normalizedAnswer === correctTriviaAnswer;
                break;

            case 'legendary_mix':
                isCorrect = this.checkLegendaryAnswer(challenge.data, normalizedAnswer);
                break;

            default:
                return false;
        }

        if (isCorrect) {
            await this.handleChallengeWin(challenge.id, userId, username);
            return true;
        }

        return false;
    }

    checkLegendaryAnswer(data, answer) {
        if (data.isLegendary && data.answer) {
            return answer === data.answer.toString().toLowerCase();
        }
        if (data.correctAnswer) {
            return answer === data.correctAnswer.toLowerCase();
        }
        if (data.correct) {
            return answer === data.correct.toString();
        }
        return false;
    }

    // ========== EVENT LISTENERS ==========

    // ⭐⭐ دالة تنظيف الذاكرة المحسنة ⭐⭐
    setupMemoryCleanup() {
        setInterval(() => {
            const now = Date.now();
            let cleaned = 0;
            
            // ⭐⭐ فحص التحديات المنتهية فقط ⭐⭐
            for (const [challengeId, challenge] of this.activeChallenges.entries()) {
                if (challenge.expiresAt < now) {
                    this.endChallenge(challengeId, 'auto-cleanup');
                    cleaned++;
                }
            }
            
            // ⭐⭐ تنظيف المشاركات القديمة ⭐⭐
            for (const [userId, timestamp] of this.userParticipations.entries()) {
                if (now - timestamp > 30 * 60 * 1000) {
                    this.userParticipations.delete(userId);
                }
            }
            
            if (cleaned > 0) {
                console.log(`🧹 Cleaned ${cleaned} expired challenges`);
            }
        }, 60000); // ⭐⭐ كل دقيقة ⭐⭐
    }

    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;

            for (const [challengeId, challenge] of this.activeChallenges) {
                if (!challenge.isActive || challenge.winner) continue;

                if (interaction.customId.startsWith(`${challengeId}_`)) {
                    if (challenge.type === 'first_click' || challenge.type === 'nebula_click') {
                        await this.processClickWin(interaction, challenge);
                    }
                    break;
                }
            }
        });

        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;

            for (const [challengeId, challenge] of this.activeChallenges) {
                if (!challenge.isActive || challenge.winner) continue;

                const content = message.content.trim();

                if (challenge.type === 'first_mention' && message.mentions.has(this.client.user.id)) {
                    await this.processMentionWin(message, challenge);
                    break;
                }

                if (challenge.type !== 'first_click' && 
                    challenge.type !== 'nebula_click' && 
                    challenge.type !== 'first_mention' &&
                    challenge.type !== 'first_voice_join') {

                    const result = await this.processAnswerWin(challenge, message.author.id, message.author.username, content);
                    if (result) break;
                }
            }
        });

        this.client.on('voiceStateUpdate', async (oldState, newState) => {
            if (newState.member?.user?.bot) return;

            for (const [challengeId, challenge] of this.activeChallenges) {
                if (!challenge.isActive || challenge.type !== 'first_voice_join') continue;

                const userId = newState.id;
                const username = newState.member?.user?.username;

                if (!oldState.channelId && newState.channelId) {
                    await this.processMultiVoiceJoinWin(newState, challenge);
                }

                else if (oldState.channelId && !newState.channelId) {
                    const participant = challenge.voiceData?.participants.get(userId);
                    if (participant && !participant.hasWon) {
                        console.log(`❌ ${participant.username} left voice before completing challenge`);

                        challenge.voiceData.participants.delete(userId);

                        this.updateVoiceChallengeMessage(challenge);
                    }
                }

                else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                    console.log(`🔄 ${username} switched voice channels`);
                }

                break;
            }
        });
    }

    // ========== HELPER METHODS ==========
    getRewardText(challenge) {
        if (challenge.type === 'first_voice_join') {
            return '100-800 XP + 80-600 Coins + Crystals (Multiple winners!)';
        }

        if (challenge.challengeType === 'between') {
            return 'XP + Coins (Winner takes all!)';
        }

        switch(challenge.levelTag) {
            case 'STAR': return 'Common Drop + Rewards (Winner takes all!)';
            case 'COMET': return 'Rare Drop + Rewards (Winner takes all!)';
            case 'NEBULA': return 'Epic Drop + Rewards (Winner takes all!)';
            case 'METEOROID': return 'Legendary Drop + Rewards (Winner takes all!)';
            default: return 'Drop + Rewards (Winner takes all!)';
        }
    }

    getBetweenTypeFromLevel(levelTag) {
        switch(levelTag) {
            case 'BONUS': return 'star-comet';
            default: return 'star-comet';
        }
    }

    getRandomBetween(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // ========== DATA GENERATORS ==========
    async generateTriviaData() {
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                console.log(`🔄 Attempting to fetch trivia (attempt ${attempts + 1}/${maxAttempts})`);

                const apiUrl = 'https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986';
                const response = await axios.get(apiUrl);

                if (!response.data.results || response.data.results.length === 0) {
                    throw new Error('No trivia results found');
                }

                const questionData = response.data.results[0];

                const decodeHtml = (html) => html
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, "'");

                const question = decodeHtml(decodeURIComponent(questionData.question));
                const correctAnswer = decodeHtml(decodeURIComponent(questionData.correct_answer));
                const incorrectAnswers = questionData.incorrect_answers.map(ans => 
                    decodeHtml(decodeURIComponent(ans))
                );

                return {
                    question: question,
                    correctAnswer: correctAnswer,
                    wrongAnswers: incorrectAnswers,
                    category: decodeHtml(decodeURIComponent(questionData.category)),
                    difficulty: questionData.difficulty,
                    source: 'trivia_api'
                };
            } catch (error) {
                attempts++;
                console.error(`❌ Trivia fetch failed (attempt ${attempts}):`, error.message);

                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                } else {
                    throw new Error('All trivia attempts failed');
                }
            }
        }
    }

    async generateFindWordData() {
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                console.log(`🔄 Attempting to generate find word (attempt ${attempts + 1}/${maxAttempts})`);

                const apiUrl = 'https://opentdb.com/api.php?amount=3&type=multiple&encode=url3986';
                const response = await axios.get(apiUrl);

                if (!response.data.results || response.data.results.length === 0) {
                    throw new Error('No trivia results found');
                }

                const decodeHtml = (html) => html
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&quot;/g, '"')
                    .replace(/&#039;/g, "'");

                let selectedAnswer = null;
                let questionData = null;

                for (const result of response.data.results) {
                    const allAnswers = [
                        result.correct_answer,
                        ...result.incorrect_answers
                    ].map(ans => decodeHtml(decodeURIComponent(ans)));

                    for (const answer of allAnswers) {
                        if (answer && 
                            answer.split(' ').length === 1 && 
                            answer.length >= 3 && 
                            answer.length <= 12 &&
                            /^[a-zA-Z]+$/.test(answer)) {
                            selectedAnswer = answer;
                            questionData = result;
                            break;
                        }
                    }

                    if (selectedAnswer) break;
                }

                if (!selectedAnswer || !questionData) {
                    throw new Error('No suitable word found in trivia results');
                }

                const word = selectedAnswer.toUpperCase();
                const letters = Array.from(new Set(word.split('')));

                const difficultyMap = {
                    'easy': 0.6,
                    'medium': 0.4,
                    'hard': 0.3
                };

                const difficulty = questionData.difficulty || 'easy';
                const revealPercentage = difficultyMap[difficulty] || 0.5;
                const revealedCount = Math.max(1, Math.floor(word.length * revealPercentage));
                const revealedIndices = [];

                while (revealedIndices.length < revealedCount) {
                    const idx = Math.floor(Math.random() * word.length);
                    if (!revealedIndices.includes(idx)) {
                        revealedIndices.push(idx);
                    }
                }

                revealedIndices.sort((a, b) => a - b);

                let displayWord = '';
                for (let i = 0; i < word.length; i++) {
                    if (revealedIndices.includes(i)) {
                        displayWord += word[i] + ' ';
                    } else {
                        displayWord += '_ ';
                    }
                }

                const category = decodeHtml(decodeURIComponent(questionData.category));
                const hint = `Category: ${category}`;

                return {
                    word: word,
                    answer: selectedAnswer.toLowerCase(),
                    displayWord: displayWord.trim(),
                    letters: letters,
                    hint: hint,
                    revealedLetters: revealedIndices.length,
                    totalLetters: word.length,
                    difficulty: difficulty,
                    category: category,
                    source: 'trivia_api',
                    timestamp: Date.now()
                };

            } catch (error) {
                attempts++;
                console.error(`❌ Find word generation failed (attempt ${attempts}):`, error.message);

                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                } else {
                    throw new Error('Find word generation completely failed');
                }
            }
        }
    }

    generateFirstClickData() {
        return { 
            buttonId: `click_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
            correctIndex: Math.floor(Math.random() * 4)
        };
    }

    generateMathData() {
        const operations = ['+', '-', '*'];
        const op = operations[Math.floor(Math.random() * operations.length)];
        const num1 = this.getRandomBetween(1, 50);
        const num2 = this.getRandomBetween(1, 50);

        let answer;
        switch(op) {
            case '+': answer = num1 + num2; break;
            case '-': answer = num1 - num2; break;
            case '*': answer = num1 * num2; break;
        }

        const wrongAnswers = [];
        while (wrongAnswers.length < 3) {
            let wrong = answer + this.getRandomBetween(-20, 20);
            if (wrong !== answer && !wrongAnswers.includes(wrong)) {
                wrongAnswers.push(wrong);
            }
        }

        return {
            question: `${num1} ${op} ${num2}`,
            answer: answer,
            wrongAnswers: wrongAnswers
        };
    }

    generateAdvancedMathData() {
        const operations = ['+', '-', '*', '/'];
        const op = operations[Math.floor(Math.random() * operations.length)];

        let num1, num2, answer;

        if (op === '/') {
            num2 = this.getRandomBetween(2, 10);
            answer = this.getRandomBetween(2, 10);
            num1 = num2 * answer;
        } else {
            num1 = this.getRandomBetween(10, 100);
            num2 = this.getRandomBetween(10, 100);

            switch(op) {
                case '+': answer = num1 + num2; break;
                case '-': answer = num1 - num2; break;
                case '*': answer = num1 * num2; break;
            }
        }

        const wrongAnswers = [];
        while (wrongAnswers.length < 3) {
            let wrong = answer + this.getRandomBetween(-50, 50);
            if (wrong !== answer && !wrongAnswers.includes(wrong)) {
                wrongAnswers.push(wrong);
            }
        }

        return {
            question: `${num1} ${op} ${num2}`,
            answer: answer,
            wrongAnswers: wrongAnswers
        };
    }

    generateDiceData() {
        const correct = this.getRandomBetween(1, 6);
        const wrongAnswers = [];

        while (wrongAnswers.length < 3) {
            let wrong = this.getRandomBetween(1, 6);
            if (wrong !== correct && !wrongAnswers.includes(wrong)) {
                wrongAnswers.push(wrong);
            }
        }

        return {
            correct: correct,
            wrongAnswers: wrongAnswers
        };
    }

    async generateHiddenTextData() {
        try {
            const apiUrl = 'https://opentdb.com/api.php?amount=5&type=multiple&encode=url3986';
            const response = await axios.get(apiUrl);

            if (!response.data.results || response.data.results.length === 0) {
                throw new Error('No trivia results found');
            }

            const decodeHtml = (html) => html
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'");

            let selectedWord = null;
            let hint = '';

            for (const result of response.data.results) {
                const allAnswers = [
                    result.correct_answer,
                    ...result.incorrect_answers
                ].map(ans => decodeHtml(decodeURIComponent(ans)));

                for (const answer of allAnswers) {
                    if (answer && 
                        answer.split(' ').length === 1 && 
                        /^[a-zA-Z]+$/.test(answer) &&
                        answer.length >= 3 && 
                        answer.length <= 12) {

                        selectedWord = answer.toLowerCase();
                        hint = decodeHtml(decodeURIComponent(result.category));
                        break;
                    }
                }

                if (selectedWord) break;
            }

            if (!selectedWord) {
                const fallbackWords = ["science", "history", "sports", "music", "movies", "games", "nature", "space"];
                selectedWord = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
                hint = "General Knowledge";
            }

            console.log(`✅ Hidden text word selected: "${selectedWord}" (${selectedWord.length} letters)`);

            const letters = selectedWord.split('');

            const revealPercentage = 0.3;
            const revealCount = Math.max(1, Math.floor(letters.length * revealPercentage));
            const revealedIndices = [];

            while (revealedIndices.length < revealCount) {
                const randomIndex = Math.floor(Math.random() * letters.length);
                if (!revealedIndices.includes(randomIndex)) {
                    revealedIndices.push(randomIndex);
                }
            }

            revealedIndices.sort((a, b) => a - b);

            let hiddenDisplay = '';
            for (let i = 0; i < letters.length; i++) {
                if (revealedIndices.includes(i)) {
                    hiddenDisplay += `**${letters[i].toUpperCase()}** `;
                } else {
                    hiddenDisplay += '▪️ ';
                }
            }

            return {
                hidden: hiddenDisplay.trim(),
                answer: selectedWord,
                hint: `${hint} | ${selectedWord.length} letters`,
                wordLength: selectedWord.length,
                revealedLetters: revealCount,
                totalLetters: selectedWord.length,
                source: 'trivia_api'
            };

        } catch (error) {
            console.error('❌ Error generating hidden text data:', error.message);

            const fallbackWords = ["quiz", "test", "game", "play", "fun", "win", "prize", "skill"];
            const fallbackWord = fallbackWords[Math.floor(Math.random() * fallbackWords.length)];
            const letters = fallbackWord.split('');

            let fallbackDisplay = '';
            for (let i = 0; i < letters.length; i++) {
                if (i === 0 || i === letters.length - 1) {
                    fallbackDisplay += `**${letters[i].toUpperCase()}** `;
                } else {
                    fallbackDisplay += '▪️ ';
                }
            }

            return {
                hidden: fallbackDisplay.trim(),
                answer: fallbackWord,
                hint: `General word | ${fallbackWord.length} letters`,
                wordLength: fallbackWord.length,
                revealedLetters: 2,
                totalLetters: fallbackWord.length,
                source: 'fallback'
            };
        }
    }

    generateLuckyNumberData() {
        const correct = this.getRandomBetween(1, 100);

        return {
            correct: correct,
            range: "1-100"
        };
    }

    generateKeywordData() {
        const keywords = ["QUICK", "FAST", "WINNER", "PRIZE", "LUCKY", "SPEED", "CHAMP", "HERO"];
        const keyword = keywords[Math.floor(Math.random() * keywords.length)];

        return {
            keyword: keyword,
            displayDuration: 5000
        };
    }

    async generateTypingFromTrivia() {
        try {
            console.log('🔄 Attempting to fetch typing phrase from trivia...');

            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Timeout fetching trivia')), 5000);
            });

            const apiUrl = 'https://opentdb.com/api.php?amount=5&type=multiple';

            const response = await Promise.race([
                axios.get(apiUrl),
                timeoutPromise
            ]);

            if (!response.data?.results) {
                throw new Error('No trivia results found');
            }

            const decodeHtml = (html) => html
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&eacute;/g, 'é')
                .replace(/&ouml;/g, 'ö')
                .replace(/&uuml;/g, 'ü')
                .replace(/&shy;/g, '-')
                .replace(/&ndash;/g, '-')
                .replace(/&mdash;/g, '-')
                .replace(/&hellip;/g, '...');

            let selectedPhrase = null;

            for (const result of response.data.results) {
                try {
                    const question = decodeHtml(decodeURIComponent(result.question));

                    console.log(`📝 Checking phrase: "${question.substring(0, 50)}..."`);

                    const conditions = [
                        question.length >= 15 && question.length <= 80,
                        !question.includes('Which of these'),
                        !question.includes('What is the'),
                        !question.includes('?'),
                        !/[<>{}[\]\\]/.test(question),
                        /^[A-Za-z0-9\s.,!'-]+$/.test(question)
                    ];

                    if (conditions.every(c => c === true)) {
                        selectedPhrase = question;
                        break;
                    }
                } catch (err) {
                    console.log(`⚠️ Skipping invalid question: ${err.message}`);
                    continue;
                }
            }

            if (!selectedPhrase) {
                throw new Error('No suitable phrase found in trivia results');
            }

            console.log(`✅ Selected typing phrase: "${selectedPhrase}"`);

            return {
                phrase: selectedPhrase.toLowerCase(),
                displayPhrase: selectedPhrase.toUpperCase(),
                source: 'trivia_api',
                length: selectedPhrase.length
            };

        } catch (error) {
            console.error('❌ Error in generateTypingFromTrivia:', error.message);
            throw error;
        }
    }

    async generateTypingData() {
        let attempts = 0;
        const maxAttempts = 3;

        const fallbackPhrases = [
            "The quick brown fox jumps over the lazy dog",
            "Programming is fun and challenging at the same time",
            "Discord bots make communities more interactive",
            "JavaScript is a versatile programming language",
            "Coding requires patience and persistence to master",
            "OpenAI creates amazing artificial intelligence models",
            "Machine learning is transforming the tech industry",
            "Web development combines creativity with technical skills",
            "Artificial intelligence will shape our future world",
            "Software engineers solve complex problems every day"
        ];

        while (attempts < maxAttempts) {
            try {
                console.log(`🔄 Typing data attempt ${attempts + 1}/${maxAttempts}`);

                if (attempts === 0) {
                    return await this.generateTypingFromTrivia();
                } else {
                    const randomIndex = Math.floor(Math.random() * fallbackPhrases.length);
                    const phrase = fallbackPhrases[randomIndex];

                    fallbackPhrases.splice(randomIndex, 1);

                    console.log(`📝 Using fallback phrase: "${phrase}"`);

                    return {
                        phrase: phrase.toLowerCase(),
                        displayPhrase: phrase.toUpperCase(),
                        source: 'fallback',
                        attempt: attempts
                    };
                }

            } catch (error) {
                attempts++;
                console.error(`❌ Typing generation failed (attempt ${attempts}):`, error.message);

                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
                }
            }
        }

        const finalFallbacks = [
            "Challenge your typing speed and accuracy now",
            "Fast typing requires practice and concentration",
            "Every keystroke brings you closer to victory",
            "Precision typing separates winners from others",
            "Demonstrate your keyboard mastery right here"
        ];

        const finalPhrase = finalFallbacks[Math.floor(Math.random() * finalFallbacks.length)];

        console.log(`⚠️ Using final fallback phrase: "${finalPhrase}"`);

        return {
            phrase: finalPhrase.toLowerCase(),
            displayPhrase: finalPhrase.toUpperCase(),
            source: 'emergency_fallback',
            timestamp: Date.now()
        };
    }

    generateLegendaryData() {
        const random = Math.random();

        if (random < 0.3) {
            const math = this.generateAdvancedMathData();
            return { ...math, isLegendary: true };
        } else if (random < 0.6) {
            try {
                const math = this.generateAdvancedMathData();
                return { ...math, isLegendary: true };
            } catch (error) {
                const math = this.generateAdvancedMathData();
                return { ...math, isLegendary: true };
            }
        } else {
            const dice = this.generateDiceData();
            return { ...dice, isLegendary: true };
        }
    }

    // ========== CLEANUP ==========
    async resetAllTargets(guildId) {
        try {
            const newTargets = this.generateAllTargets();
            await dbManager.saveGlobalChallengeTargets(guildId, newTargets);

            await dbManager.run(
                `UPDATE global_challenges 
                 SET total_messages = 0,
                     messages_in_current_cycle = 0,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE guild_id = ?`,
                [guildId]
            );

            console.log(`🔄 Reset all targets for guild ${guildId}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error resetting all targets:', error);
            return { success: false, error: error.message };
        }
    }

    getAllVoiceWinners(challenge) {
        if (!challenge.voiceData || challenge.voiceData.winners.size === 0) {
            return "No winners";
        }

        const winners = Array.from(challenge.voiceData.winners.values());
        return winners.map(winner => `• ${winner.username}`).join('\n');
    }

    cleanupOnStartup() {
        try {
            this.activeChallenges.clear();
            this.activeChallengeMessages.clear();
            this.userParticipations.clear();
            console.log('✅ Challenge System cleanup completed');
        } catch (error) {
            console.error('Error during startup cleanup:', error);
        }
    }

    // ========== PUBLIC API ==========
    async getChallengeStatus(guildId) {
        try {
            const challenge = await this.getGlobalChallenge(guildId);
            if (!challenge) return null;

            const activeChallenges = Array.from(this.activeChallenges.values())
                .filter(c => c.guildId === guildId && c.isActive);

            return {
                guildId: guildId,
                totalMessages: challenge.total_messages || 0,
                levelTargets: challenge.current_targets || {},
                betweenTargets: challenge.between_targets || {},
                activeChallenges: activeChallenges.map(c => ({
                    type: c.type,
                    levelTag: c.levelTag,
                    challengeType: c.challengeType,
                    timeLeft: Math.max(0, Math.floor((c.expiresAt - Date.now()) / 1000))
                })),
                reachedLevels: {
                    star: challenge.star_reached || false,
                    comet: challenge.comet_reached || false,
                    nebula: challenge.nebula_reached || false,
                    meteoroid: challenge.meteoroid_reached || false
                }
            };

        } catch (error) {
            console.error('Error getting challenge status:', error);
            return null;
        }
    }

    getSystemStats() {
        return {
            activeChallenges: this.activeChallenges.size,
            activeMessages: this.activeChallengeMessages.size
        };
    }
}


// ========== SETUP FUNCTION ==========
let globalChallengeManager = null;

async function setupGlobalChallengeSystem(client) {
    console.log('🚀 Setting up Global Challenge System...');
    globalChallengeManager = new GlobalChallengeManager(client);
    await globalChallengeManager.setup();
    console.log('✅ Global Challenge System setup complete!');
    return globalChallengeManager;
}

// ========== EXPORTS ==========
module.exports = {
    GlobalChallengeManager,
    setupGlobalChallengeSystem,
    getGlobalChallengeManager: () => globalChallengeManager,

    processMessageForGlobalChallenge: async function(guildId, userId, username, message) {
        try {
            if (!globalChallengeManager) {
                globalChallengeManager = new GlobalChallengeManager(message.client);
                await globalChallengeManager.setup();
            }

            return await globalChallengeManager.processMessageForChallenge(
                guildId, 
                userId, 
                username, 
                message
            );
        } catch (error) {
            console.error('Error processing global challenge:', error);
            return { success: false, error: error.message };
        }
    },

    getChallengeStatus: async (guildId) => {
        if (!globalChallengeManager) return null;
        return await globalChallengeManager.getChallengeStatus(guildId);
    },

    getSystemStats: () => {
        if (!globalChallengeManager) return null;
        return globalChallengeManager.getSystemStats();
    }
};