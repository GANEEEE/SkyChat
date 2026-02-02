const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const dbManager = require("../Data/database");
const mainLevelSystem  = require("../LevelSystem/levelsystem");

// نظام المستويات المعدل
class SimpleLevelSystem {
    constructor() {
        // ⭐⭐ إضافة Level 0 كأول level بدون role ⭐⭐
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

        // Channel ID للإشعارات
        this.notificationChannelId = "123456789012345693";
    }

    // تحويل رقم عادي لرقم روماني مع دعم Level 0
    toRoman(num) {
        // ⭐⭐ إذا كان المستوى 0، ارجع "-" ⭐⭐
        if (num === 0) return "-";

        const romanNumerals = {
            1: "I",
            2: "II",
            3: "III",
            4: "IV",
            5: "V",
            6: "VI",
            7: "VII",
            8: "VIII",
            9: "IX",
            10: "X",
            11: "XI",
            12: "XII",
            13: "XIII",
            14: "XIV",
            15: "XV",
        };
        return romanNumerals[num] || num.toString();
    }

    // الحصول على المستوى بناءً على الـ XP (معدل لدعم Level 0)
    getLevelFromXP(xp) {
        for (let i = this.levels.length - 1; i >= 0; i--) {
            if (xp >= this.levels[i].xp) {
                return this.levels[i];
            }
        }
        return this.levels[0]; // مستوى 0 افتراضي
    }

    // الحصول على المستوى التالي
    getNextLevel(currentLevel) {
        // ⭐⭐ إذا كان الحالي هو 0، التالي هو 1 ⭐⭐
        if (currentLevel.level === 0) {
            return this.levels[1] || null;
        }

        const nextIndex =
            this.levels.findIndex((lvl) => lvl.level === currentLevel.level) +
            1;
        return this.levels[nextIndex] || null;
    }
}

// دالة مساعدة لرسم مستطيل مستدير
function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}

// دالة لرسم قوس بروجرس بار حول الدائرة
function drawProgressArc(
    ctx,
    centerX,
    centerY,
    radius,
    startAngle,
    endAngle,
    color,
    lineWidth,
) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, endAngle, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("rank")
        .setDescription("Show user statistics in an image")
        .addUserOption((option) =>
            option
                .setName("user")
                .setDescription("User to show statistics for")
                .setRequired(false),
        ),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser("user") || interaction.user;
            const member = interaction.guild.members.cache.get(targetUser.id) ||
                (await interaction.guild.members.fetch(targetUser.id).catch(() => null));

            if (!member) {
                return interaction.editReply({
                    content: "❌ User not found in this server",
                    ephemeral: true,
                });
            }

            // ========== ⭐⭐ الكود الجديد لتحميل الخلفية ⭐⭐ ==========

            // 1. جلب wallpaper_url من الداتابيز
            let userWallpaperUrl = null;
            try {
                const userData = await dbManager.get(
                    `SELECT wallpaper_url FROM levels WHERE user_id = ?`,
                    [targetUser.id]
                );

                if (userData && userData.wallpaper_url && 
                    userData.wallpaper_url !== 'null' && 
                    userData.wallpaper_url.trim() !== '') {
                    userWallpaperUrl = userData.wallpaper_url;
                    console.log(`🎨 Custom wallpaper found for ${targetUser.username}: ${userWallpaperUrl}`);
                } else {
                    console.log(`🎨 No custom wallpaper for ${targetUser.username}, using default`);
                }
            } catch (dbError) {
                console.error('❌ Error fetching wallpaper from DB:', dbError);
            }

            // ⭐⭐ جلب الليمتس الفعالة بدل الثابت ⭐⭐
            const effectiveLimits = await mainLevelSystem.getEffectiveDailyLimits(targetUser.id);
            const maxXP = effectiveLimits.MAX_XP || 500;
            const maxCoins = effectiveLimits.MAX_COINS || 750;

            console.log(`📊 Rank Limits for ${targetUser.username}: XP=${maxXP}, Coins=${maxCoins}`);

            // جلب بيانات المستخدم من الداتابيز
            let userData = {
                xpEarnedToday: 0,
                coinsEarnedToday: 0,
                level: 0,
                totalXP: 0,
                sky_coins: 0,
                sky_crystals: 0,
                chatPoints: 0,
                voicePoints: 0,
                last_daily: null,
                last_weekly: null,
            };

            // محاولة جلب البيانات الفعلية من الداتابيز
            try {
                // 1. جلب بيانات المستوى الأساسية
                const userProfile = await dbManager.getUserProfile(targetUser.id);

                if (userProfile) {
                    userData.xpEarnedToday = userProfile.xp_earned_today ?? 0;
                    userData.coinsEarnedToday = userProfile.coins_earned_today ?? 0;
                    userData.level = userProfile.level ?? 0;
                    userData.totalXP = userProfile.xp ?? 0;
                    userData.sky_coins = userProfile.sky_coins ?? 0;
                    userData.sky_crystals = userProfile.sky_crystals ?? 0;
                    userData.chatPoints = userProfile.chat_points ?? 0;
                    userData.voicePoints = userProfile.voice_points ?? 0;
                    userData.last_daily = userProfile.last_daily;
                    userData.last_weekly = userProfile.last_weekly;
                }

                // 2. جلب بيانات Skywell
                const skywellData = await dbManager.get(
                    'SELECT total_coins_thrown, total_converted_coins, current_level FROM skywell_users WHERE user_id = ?',
                    [targetUser.id]
                );

                if (skywellData) {
                    userData.total_coins_thrown = skywellData.total_coins_thrown ?? 0;
                    userData.total_converted_coins = skywellData.total_converted_coins ?? 0;
                    userData.current_level = skywellData.current_level ?? 0;

                    console.log(`✅ Skywell Data Loaded: 
                    - Coins Thrown: ${userData.total_coins_thrown}
                    - Converted Coins: ${userData.total_converted_coins}
                    - Current Level: ${userData.current_level}`);
                }

                console.log(`📊 All Data Loaded for ${targetUser.username}`);

            } catch (dbError) {
                console.log("Error loading data:", dbError.message);
            }

            // ⭐⭐ جلب عدد الرسائل الإجمالي ⭐⭐
            let totalSentMessages = 0;
            try {
                const messageStats = await dbManager.get(
                    'SELECT sent FROM message_stats WHERE user_id = ?',
                    [targetUser.id]
                );
                totalSentMessages = messageStats?.sent || 0;
            } catch (error) {
                console.error('⚠️ Error fetching message stats:', error.message);
            }

            // ⭐⭐ إعداد نظام المستويات المعدل ⭐⭐
            const levelSystem = new SimpleLevelSystem();
            const currentLevelData = levelSystem.getLevelFromXP(
                userData.totalXP,
            );
            const nextLevelData = levelSystem.getNextLevel(currentLevelData);

            // الأرقام الرومانية للمستوى الحالي والمستوى التالي
            const currentRoman = levelSystem.toRoman(currentLevelData.level);
            const nextRoman = nextLevelData
                ? levelSystem.toRoman(nextLevelData.level)
                : "MAX";

            // ⭐⭐ حساب الرتبة حسب الـ XP ⭐⭐
            let userRank = 1;
            try {
                const rankResult = await dbManager.get(
                    'SELECT COUNT(*) + 1 as rank FROM levels WHERE xp > ?',
                    [userData.totalXP]
                );

                if (rankResult && rankResult.rank) {
                    userRank = rankResult.rank;
                }

                console.log(`📊 Calculated Rank for ${targetUser.username}: #${userRank} (XP: ${userData.totalXP})`);
            } catch (error) {
                console.log("Error calculating rank:", error.message);
            }

            // أبعاد الصورة
            const width = 940;
            const height = 296;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext("2d");

            // 2. محاولة تحميل الخلفية
            let mainBackground;
            let backgroundSource = 'default';

            try {
                // محاولة تحميل الخلفية المخصصة أولاً
                if (userWallpaperUrl) {
                    try {
                        mainBackground = await loadImage(userWallpaperUrl);
                        backgroundSource = 'custom';
                        console.log(`✅ Loaded custom wallpaper from: ${userWallpaperUrl}`);
                    } catch (customError) {
                        console.warn(`⚠️ Failed to load custom wallpaper (${userWallpaperUrl}):`, customError.message);
                        // إذا فشلت، جرب الـ default
                        mainBackground = await loadImage("https://i.ibb.co/201993LH/Main-Wallpaper.png");
                        console.log(`✅ Loaded default wallpaper (custom failed)`);
                    }
                } else {
                    // إذا مفيش خلفية مخصصة، استخدم الـ default
                    mainBackground = await loadImage("https://i.ibb.co/201993LH/Main-Wallpaper.png");
                    console.log(`✅ Loaded default wallpaper (no custom)`);
                }
            } catch (bgError) {
                console.error('❌ Failed to load any wallpaper:', bgError);
                // بديل إذا فشل كل شيء
                ctx.fillStyle = "#1a1a2e";
                ctx.fillRect(0, 0, width, height);
                console.log("⚠️ Using fallback solid background");
            }

            // 3. رسم الخلفية إذا تم تحميلها
            if (mainBackground) {
                ctx.drawImage(mainBackground, 0, 0, width, height);
                console.log(`🎨 Background drawn (source: ${backgroundSource})`);
            }

            // 4. تحميل خلفية الكومبوننتات
            try {
                const componentsBackground = await loadImage("https://i.ibb.co/BVYPsqbX/Compenets.png");
                const compX = 45;
                const compY = 25;
                const compWidth = 876;
                const compHeight = 289;

                ctx.drawImage(componentsBackground, compX, compY, compWidth, compHeight);
                console.log(`✅ Components background drawn`);

            } catch (componentsError) {
                console.error('❌ Failed to load components background:', componentsError);
            }

            // الإحداثيات الأساسية
            const circleX = 137 - 7;
            const circleY = 125 - 10;
            const circleRadius = 85;
            const progressBarWidth = 5;

            // أولاً: صورة المستخدم في الدائرة
            try {
                const avatarUrl = targetUser.displayAvatarURL({
                    extension: "png",
                    size: 512,
                });
                const avatar = await loadImage(avatarUrl);

                ctx.save();
                ctx.beginPath();
                ctx.arc(circleX, circleY, circleRadius, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();

                ctx.drawImage(
                    avatar,
                    circleX - circleRadius,
                    circleY - circleRadius,
                    circleRadius * 2,
                    circleRadius * 2,
                );

                ctx.restore();

                // ⭐⭐ إضافة dropshadow لصورة المستخدم ⭐⭐
                ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                ctx.shadowBlur = 15;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                ctx.beginPath();
                ctx.arc(circleX, circleY, circleRadius + 2, 0, Math.PI * 2);
                ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log("✅ Avatar added successfully with dropshadow");
            } catch (error) {
                console.error("❌ Failed to load avatar:", error);
            }

            // ثانياً: رسم البروجرس بار حول الدائرة - XP (النصف الأيسر)
            try {
                const xpProgress = Math.min(
                    1,
                    Math.max(0, userData.xpEarnedToday / maxXP),
                );
                const startAngleXP = Math.PI / 2;
                const endAngleXP = startAngleXP + xpProgress * Math.PI;
                const xpColor = "#0073ff";

                // ⭐⭐ إضافة dropshadow لبروجرس بار الـ XP ⭐⭐
                ctx.shadowColor = "rgba(0, 115, 255, 0.5)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                drawProgressArc(
                    ctx,
                    circleX,
                    circleY,
                    circleRadius + progressBarWidth / 2,
                    startAngleXP,
                    endAngleXP,
                    xpColor,
                    progressBarWidth,
                );

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(
                    `✅ XP Progress Arc: ${userData.xpEarnedToday}/${maxXP} (${Math.round(xpProgress * 100)}%) - Right side with dropshadow`,
                );
            } catch (error) {
                console.error("❌ Failed to draw XP progress arc:", error);
            }

            // ثالثاً: رسم البروجرس بار حول الدائرة - Coins (النصف الأيمن)
            try {
                const coinsProgress = Math.min(
                    1,
                    Math.max(0, userData.coinsEarnedToday / maxCoins),
                );
                const startAngleCoins = Math.PI / 2;
                const endAngleCoins = startAngleCoins - coinsProgress * Math.PI;
                const coinsColor = "#FFD700";

                // ⭐⭐ إضافة dropshadow لبروجرس بار الـ Coins ⭐⭐
                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                drawProgressArc(
                    ctx,
                    circleX,
                    circleY,
                    circleRadius + progressBarWidth / 2,
                    endAngleCoins,
                    startAngleCoins,
                    coinsColor,
                    progressBarWidth,
                );

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(
                    `✅ Coins Progress Arc: ${userData.coinsEarnedToday}/${maxCoins} (${Math.round(coinsProgress * 100)}%) - Left side with dropshadow`,
                );
            } catch (error) {
                console.error("❌ Failed to draw Coins progress arc:", error);
            }

            // رابعاً: الاسم المستخدم مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 40px Arial";
                const usernameGradient = ctx.createLinearGradient(245, 50, 500, 50);
                usernameGradient.addColorStop(0, "#0073ff");
                usernameGradient.addColorStop(1, "#FFFFFF");
                ctx.fillStyle = usernameGradient;
                ctx.textAlign = "left";

                const textX = 240;
                const textY = 52;

                const username = targetUser.username;
                const maxLength = 18;
                const displayText = username.length > maxLength
                    ? username.substring(0, maxLength - 3) + "..."
                    : username;

                // ⭐⭐ إضافة dropshadow للاسم ⭐⭐
                ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                ctx.fillText(displayText, textX, textY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Username added: ${username} (CENTER with dropshadow)`);
            } catch (error) {
                console.error("❌ Failed to add username:", error);
            }

            // خامساً: Progress Bar مع gradient و dropshadow
            try {
                const barX = 250;
                const barY = 210;
                const barWidth = 650;
                const barHeight = 35;
                const barRadius = barHeight / 2;

                // حساب التقدم
                const currentXP = userData.totalXP;
                const currentLevelXP = currentLevelData.xp;
                const nextLevelXP = nextLevelData ? nextLevelData.xp : currentLevelData.xp;

                let progress = 0;
                if (nextLevelData) {
                    if (currentLevelData.level === 0) {
                        progress = currentXP / nextLevelXP;
                    } else {
                        progress = (currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP);
                    }
                    progress = Math.max(0, Math.min(1, progress));
                }

                // ⭐⭐ إضافة dropshadow للبروجرس بار كامل ⭐⭐
                ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                // 1. ارسم الخلفية السوداء
                ctx.fillStyle = "#0B0B0B";
                drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barRadius);
                ctx.fill();

                // 2. لو فيه تقدم، ارسم الجزء مع gradient
                if (progress > 0) {
                    const filledWidth = Math.floor(barWidth * progress);

                    if (filledWidth >= 1) {
                        // gradient للبروجرس بار
                        const gradient = ctx.createLinearGradient(
                            barX, barY,
                            barX + filledWidth, barY
                        );
                        gradient.addColorStop(0, "#004599");
                        gradient.addColorStop(0.5, "#0073ff");
                        gradient.addColorStop(1, "#2D8CFF");

                        ctx.fillStyle = gradient;

                        // ⭐⭐ dropshadow للجزء المملوء فقط ⭐⭐
                        ctx.shadowColor = "rgba(0, 115, 255, 0.5)";
                        ctx.shadowBlur = 8;
                        ctx.shadowOffsetX = 2;
                        ctx.shadowOffsetY = 2;

                        ctx.save();
                        ctx.beginPath();
                        drawRoundedRect(ctx, barX, barY, barWidth, barHeight, barRadius);
                        ctx.clip();
                        ctx.fillRect(barX, barY, filledWidth, barHeight);
                        ctx.restore();

                        console.log(`✅ Progress Bar: ${Math.round(progress * 100)}% (width: ${filledWidth}px) with dropshadow`);
                    }
                }

                // إعادة تعيين الـ shadow للنص
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                // 3. نص التقدم في المنتصف (CENTER)
                const displayText = nextLevelData ? `${currentXP} / ${nextLevelXP}` : `${currentXP} / MAX`;
                ctx.font = "bold 16px Arial";

                // gradient للنص
                const textGradient = ctx.createLinearGradient(
                    barX + barWidth/2 - 50, barY + barHeight/2,
                    barX + barWidth/2 + 50, barY + barHeight/2
                );
                textGradient.addColorStop(0, "#FFFFFF");
                textGradient.addColorStop(1, "#CCCCCC");
                ctx.fillStyle = textGradient;

                // ⭐⭐ إضافة dropshadow للنص ⭐⭐
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 5;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(displayText, barX + barWidth / 2, barY + barHeight / 2);

                // 4. Current Level Number on Left مع gradient و dropshadow
                ctx.font = "bold 28px Arial";
                const leftGradient = ctx.createLinearGradient(barX + 20, barY - 20, barX + 40, barY - 5);
                leftGradient.addColorStop(0, "#1D83FF");
                leftGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = leftGradient;
                ctx.textAlign = "center";

                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(currentRoman, barX + 30, barY - 15);

                // 5. Next Level Number on Right مع gradient و dropshadow
                const rightGradient = ctx.createLinearGradient(barX + barWidth - 45, barY - 20, barX + barWidth - 25, barY - 5);
                rightGradient.addColorStop(0, "#FFD700");
                rightGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = rightGradient;
                const nextRomanText = nextLevelData ? nextRoman : "MAX";

                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(nextRomanText, barX + barWidth - 35, barY - 15);

                // إعادة تعيين الـ shadow
                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

            } catch (error) {
                console.error("❌ Progress Bar Error:", error);
            }

            // سادساً: XP مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 24px Arial";
                const xpGradient = ctx.createLinearGradient(75, 240, 105, 240);
                xpGradient.addColorStop(0, "#ffffff");
                xpGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = xpGradient;
                ctx.textAlign = "center";

                const xpTextX = 80;
                const xpTextY = 247;

                // ⭐⭐ إضافة dropshadow للأرقام ⭐⭐
                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(
                    userData.xpEarnedToday.toString(),
                    xpTextX,
                    xpTextY,
                );

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(
                    `✅ XP Today (${userData.xpEarnedToday}) added successfully (CENTER with dropshadow)`,
                );
            } catch (error) {
                console.error("❌ Failed to add XP:", error);
            }

            // سابعاً: COINS مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 24px Arial";
                const coinsGradient = ctx.createLinearGradient(165, 240, 195, 240);
                coinsGradient.addColorStop(0, "#FFD700");
                coinsGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = coinsGradient;
                ctx.textAlign = "center";

                const coinsTextX = 178;
                const coinsTextY = 247;

                // ⭐⭐ إضافة dropshadow للأرقام ⭐⭐
                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(
                    userData.coinsEarnedToday.toString(),
                    coinsTextX,
                    coinsTextY,
                );

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(
                    `✅ Coins Today (${userData.coinsEarnedToday}) added successfully (CENTER with dropshadow)`,
                );
            } catch (error) {
                console.error("❌ Failed to add Coins:", error);
            }

            // 1. chat_points مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 28px Arial";
                const chatGradient = ctx.createLinearGradient(320, 105, 360, 115);
                chatGradient.addColorStop(0, "#FFFFFF");
                chatGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = chatGradient;
                ctx.textAlign = "center";

                const chatPointsX = 327;
                const chatPointsY = 95;

                // ⭐⭐ إضافة dropshadow ⭐⭐
                ctx.shadowColor = "rgba(0, 170, 255, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(`${userData.chatPoints}`, chatPointsX, chatPointsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Chat Points (${userData.chatPoints}) centered with gradient and dropshadow`);

            } catch (error) {
                console.error("❌ Failed to add Chat Points:", error);
            }

            // 2. voice_points مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 28px Arial";
                const voiceGradient = ctx.createLinearGradient(810, 105, 850, 115);
                voiceGradient.addColorStop(0, "#FFFFFF");
                voiceGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = voiceGradient;
                ctx.textAlign = "center";

                const voicePointsX = 805;
                const voicePointsY = 95;

                // ⭐⭐ إضافة dropshadow ⭐⭐
                ctx.shadowColor = "rgba(0, 255, 136, 0.5)";
                ctx.shadowBlur = 8;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                ctx.fillText(`${userData.voicePoints}`, voicePointsX, voicePointsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Voice Points (${userData.voicePoints}) centered with gradient and dropshadow`);

            } catch (error) {
                console.error("❌ Failed to add Voice Points:", error);
            }

            // ⭐⭐ sky_coins مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 17px Arial";
                const coinsGradient = ctx.createLinearGradient(405, 272, 435, 282);
                coinsGradient.addColorStop(0, "#FFD700");
                coinsGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = coinsGradient;
                ctx.textAlign = "center";

                const skyCoinsX = 328;
                const skyCoinsY = 278;

                // ⭐⭐ إضافة dropshadow ⭐⭐
                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${userData.sky_coins}`, skyCoinsX, skyCoinsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Sky Coins: ${userData.sky_coins} (CENTER with gradient and dropshadow)`);
            } catch (error) {
                console.error("❌ Failed to add Sky Coins:", error);
            }

            // ⭐⭐ sky_crystals مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 17px Arial";
                const crystalsGradient = ctx.createLinearGradient(535, 272, 565, 282);
                crystalsGradient.addColorStop(0, "#55E8FF");
                crystalsGradient.addColorStop(1, "#FFFFFF");
                ctx.fillStyle = crystalsGradient;
                ctx.textAlign = "center";

                const skyCrystalsX = 428;
                const skyCrystalsY = 278;

                // ⭐⭐ إضافة dropshadow ⭐⭐
                ctx.shadowColor = "rgba(0, 255, 255, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${userData.sky_crystals}`, skyCrystalsX, skyCrystalsY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Sky Crystals: ${userData.sky_crystals} (CENTER with gradient and dropshadow)`);
            } catch (error) {
                console.error("❌ Failed to add Sky Crystals:", error);
            }

            // ⭐⭐ total_coins_thrown مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 16px Arial";
                const thrownGradient = ctx.createLinearGradient(655, 272, 685, 282);
                thrownGradient.addColorStop(0, "#FFD700");
                thrownGradient.addColorStop(1, "#FFA500");
                ctx.fillStyle = thrownGradient;
                ctx.textAlign = "center";

                const thrownX = 813;
                const thrownY = 283;

                // ⭐⭐ حساب المجموع ⭐⭐
                const totalCoinsThrown = userData.total_coins_thrown !== undefined ? 
                                          userData.total_coins_thrown : 0;

                const totalConvertedCoins = userData.total_converted_coins !== undefined ? 
                                             userData.total_converted_coins : 0;

                const totalThrown = totalCoinsThrown + totalConvertedCoins;

                // ⭐⭐ عرض المجموع أو "-" لو كلهم مش موجودين ⭐⭐
                const thrownValue = (totalCoinsThrown > 0 || totalConvertedCoins > 0) ? 
                                    totalThrown.toString() : "-";

                // ⭐⭐ إضافة dropshadow ⭐⭐
                ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${thrownValue}`, thrownX, thrownY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Total Effective Coins: ${thrownValue} (${totalCoinsThrown} + ${totalConvertedCoins}) (CENTER with gradient and dropshadow)`);
            } catch (error) {
                console.error("❌ Failed to add Total Effective Coins:", error);
            }

            // ⭐⭐ current_level مع gradient و dropshadow (CENTER)
            try {
                ctx.font = "bold 17px Arial";
                const levelGradient = ctx.createLinearGradient(775, 272, 805, 282);
                levelGradient.addColorStop(0, "#4ECDC4");
                levelGradient.addColorStop(1, "#44A08D");
                ctx.fillStyle = levelGradient;
                ctx.textAlign = "center";

                const levelX = 697;
                const levelY = 283;

                // ⭐⭐ عرض القيمة أو "-" لو مش موجودة ⭐⭐
                const levelValue = userData.current_level !== undefined ? 
                                   userData.current_level : "-";

                // ⭐⭐ إضافة dropshadow ⭐⭐
                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                ctx.fillText(`${levelValue}`, levelX, levelY);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Current Level (Skywell): ${levelValue} (CENTER with gradient and dropshadow)`);
            } catch (error) {
                console.error("❌ Failed to add Current Level:", error);
            }

            // ⭐⭐ Rank مع gradient و dropshadow (CENTER)
            try {
                const rankX = 560;
                const rankY = 80;

                ctx.font = "bold 24px Arial";
                const rankGradient = ctx.createLinearGradient(
                    rankX - 30, rankY,
                    rankX + 30, rankY
                );
                rankGradient.addColorStop(0, "#FFFFFF");
                rankGradient.addColorStop(1, "#0073ff");
                ctx.fillStyle = rankGradient;
                ctx.textAlign = "center";

                // ⭐⭐ إضافة dropshadow قوية للرتبة ⭐⭐
                ctx.shadowColor = "rgba(0, 150, 255, 0.75)";
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 3;
                ctx.shadowOffsetY = 3;

                ctx.fillText(`${userRank}`, rankX, rankY + 10);

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

                console.log(`✅ Rank #${userRank} (CENTER with gradient and dropshadow)`);
            } catch (error) {
                console.error("❌ Failed to add Rank:", error);
            }

            // ⭐⭐ إضافة OG إذا وصل 10,000 رسالة ⭐⭐
            try {
                if (totalSentMessages >= 10000) {
                    ctx.font = "bold 18px Arial";
                    const ogGradient = ctx.createLinearGradient(245, 90, 305, 100);
                    ogGradient.addColorStop(0, "#FFD700");
                    ogGradient.addColorStop(1, "#FFA500");
                    ctx.fillStyle = ogGradient;
                    ctx.textAlign = "left";

                    // ⭐⭐ إضافة dropshadow بنفس نمط باقي العناصر ⭐⭐
                    ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
                    ctx.shadowBlur = 8;
                    ctx.shadowOffsetX = 2;
                    ctx.shadowOffsetY = 2;

                    ctx.fillText("OG", 110, 219);

                    ctx.shadowColor = "transparent";
                    ctx.shadowBlur = 0;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 0;

                    console.log(`✅ Added OG badge for ${targetUser.username} (${totalSentMessages} messages)`);
                }
            } catch (error) {
                console.error('❌ Failed to add OG badge:', error.message);
            }

            // ⭐⭐ إضافة علامة Daily Checkmark مع dropshadow ⭐⭐
            try {
                const now = new Date();
                const dailyCheckX = 528;
                const dailyCheckY = 270;
                const checkSize = 20;

                const dailyIconUrl = "https://i.ibb.co/wNH2XLg9/Check.png";

                // ⭐⭐ إضافة dropshadow للدائرة ⭐⭐
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                if (userData.last_daily) {
                    const lastDaily = new Date(userData.last_daily);
                    const hoursDiff = (now - lastDaily) / (1000 * 60 * 60);

                    if (hoursDiff < 24) {
                        // ✅ المستخدم أخذ المكافأة اليومية خلال الـ 24 ساعة الماضية
                        try {
                            const dailyIcon = await loadImage(dailyIconUrl);
                            ctx.drawImage(dailyIcon, dailyCheckX, dailyCheckY, checkSize, checkSize);
                            console.log("✅ Daily checkmark icon added from URL with dropshadow");
                        } catch (iconError) {
                            console.log("⚠️ Using fallback daily checkmark:", iconError.message);

                            // ⭐⭐ البديل مع dropshadow ⭐⭐
                            ctx.fillStyle = "#0073ff";
                            ctx.beginPath();
                            ctx.arc(dailyCheckX + checkSize/2, dailyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.fillStyle = "#FFFFFF";
                            ctx.font = "bold 16px Arial";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.fillText("✓", dailyCheckX + checkSize/2, dailyCheckY + checkSize/2);
                        }
                    } else {
                        // ❌ المستخدم لم يأخذ المكافأة اليومية
                        ctx.fillStyle = "#073ff";
                        ctx.beginPath();
                        ctx.arc(dailyCheckX + checkSize/2, dailyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = "#FFFFFF";
                        ctx.font = "bold 16px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("D", dailyCheckX + checkSize/2, dailyCheckY + checkSize/2);
                        console.log("❌ Daily reward not claimed - showing D with dropshadow");
                    }
                } else {
                    // ❌ المستخدم لم يأخذ المكافأة اليومية أبداً
                    const centerX = dailyCheckX + checkSize/2;
                    const centerY = dailyCheckY + checkSize/2;
                    const radiusX = (checkSize/2) + 1.5;  // زيادة أفقية
                    const radiusY = (checkSize/2) + 1.5;  // زيادة رأسية

                    ctx.fillStyle = "#0073ff";
                    ctx.beginPath();
                    // استخدام ellipse بدلاً من arc للتحكم في نصف القطر أفقيًا وعموديًا
                    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "bold 16px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("D", centerX, centerY);
                    console.log("❌ Never claimed daily reward - showing D with dropshadow");
                }

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

            } catch (error) {
                console.error("❌ Failed to add daily checkmark:", error);
            }

            // ⭐⭐ إضافة علامة Weekly Checkmark مع dropshadow ⭐⭐
            try {
                const now = new Date();
                const weeklyCheckX = 573;
                const weeklyCheckY = 270;
                const checkSize = 20;

                const weeklyIconUrl = "https://i.ibb.co/wNH2XLg9/Check.png";

                // ⭐⭐ إضافة dropshadow للدائرة ⭐⭐
                ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;

                if (userData.last_weekly) {
                    const lastWeekly = new Date(userData.last_weekly);
                    const daysDiff = (now - lastWeekly) / (1000 * 60 * 60 * 24);

                    if (daysDiff < 7) {
                        // ✅ المستخدم أخذ المكافأة الأسبوعية خلال الـ 7 أيام الماضية
                        try {
                            const weeklyIcon = await loadImage(weeklyIconUrl);
                            ctx.drawImage(weeklyIcon, weeklyCheckX, weeklyCheckY, checkSize, checkSize);
                            console.log("✅ Weekly checkmark icon added from URL with dropshadow");
                        } catch (iconError) {
                            console.log("⚠️ Using fallback weekly checkmark:", iconError.message);

                            // ⭐⭐ البديل مع dropshadow ⭐⭐
                            ctx.fillStyle = "#0073ff";
                            ctx.beginPath();
                            ctx.arc(weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                            ctx.fill();

                            ctx.fillStyle = "#FFFFFF";
                            ctx.font = "bold 16px Arial";
                            ctx.textAlign = "center";
                            ctx.textBaseline = "middle";
                            ctx.fillText("✓", weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2);
                        }
                    } else {
                        // ❌ المستخدم لم يأخذ المكافأة الأسبوعية
                        ctx.fillStyle = "#FF0000";
                        ctx.beginPath();
                        ctx.arc(weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2, checkSize/2, 0, Math.PI * 2);
                        ctx.fill();

                        ctx.fillStyle = "#FFFFFF";
                        ctx.font = "bold 14px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText("W", weeklyCheckX + checkSize/2, weeklyCheckY + checkSize/2);
                        console.log("❌ Weekly reward not claimed - showing W with dropshadow");
                    }
                } else {
                    // ❌ المستخدم لم يأخذ المكافأة الأسبوعية أبداً
                    const centerX = weeklyCheckX + checkSize/2;
                    const centerY = weeklyCheckY + checkSize/2;

                    // زيادة نصف القطر أفقيًا أكثر (لأن W عريض)
                    const radiusX = (checkSize/2) + 1.5;  // زيادة أفقية
                    const radiusY = (checkSize/2) + 1.5;   // زيادة رأسية أقل

                    ctx.fillStyle = "#0073ff";
                    ctx.beginPath();
                    // رسم شكل بيضاوي بدلاً من دائرة
                    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = "#FFFFFF";
                    ctx.font = "bold 14px Arial";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("W", centerX, centerY);
                    console.log("❌ Never claimed weekly reward - showing W with dropshadow");
                }

                ctx.shadowColor = "transparent";
                ctx.shadowBlur = 0;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 0;

            } catch (error) {
                console.error("❌ Failed to add weekly checkmark:", error);
            }

            // تحويل وإرسال
            const buffer = canvas.toBuffer("image/png");
            const attachment = new AttachmentBuilder(buffer, {
                name: "rank-card.png",
            });

            await interaction.editReply({
                files: [attachment],
            });

            console.log(
                `✅ Rank card generated successfully for ${targetUser.username} WITH DROPSHADOW`,
            );
            console.log(`🎨 Background: ${backgroundSource}${userWallpaperUrl ? ` (${userWallpaperUrl})` : ''}`);
            console.log(`📊 Stats:`);
            console.log(`  - Level: ${currentRoman} (${currentLevelData.level})`);
            console.log(`  - Rank: #${userRank}`);
            console.log(`  - XP Total: ${userData.totalXP}`);
            console.log(`  - XP Today: ${userData.xpEarnedToday}/${maxXP}`);
            console.log(`  - Coins Today: ${userData.coinsEarnedToday}/${maxCoins}`);

        } catch (error) {
            console.error("Error in /rank command:", error);
            await interaction.editReply({
                content: "❌ An error occurred. Please try again.",
                ephemeral: true,
            });
        }
    },
};