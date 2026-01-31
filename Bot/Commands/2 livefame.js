const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');
const twemoji = require('twemoji');

// تخزين رسالة اللايف فيم للسيرفر الواحد
let liveMessageData = null;
let updateInterval = null;
const CURRENT_GUILD_ID = process.env.GUILD_ID || "default_guild_id";

// caching للإيموجي
const emojiCache = new Map();

// تخزين آخر حالة للمقارنة
let previousUserData = new Map();

// دالة مساعدة لرسم مستطيل بحواف مستديرة
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

// دالة لرسم الإيموجي
async function drawEmoji(ctx, emoji, x, y, size) {
    try {
        let image;
        if (emojiCache.has(emoji)) {
            image = emojiCache.get(emoji);
        } else {
            const codepoint = twemoji.convert.toCodePoint(emoji);
            const url = `https://twemoji.maxcdn.com/v/latest/72x72/${codepoint}.png`;
            image = await loadImage(url);
            emojiCache.set(emoji, image);
        }
        ctx.drawImage(image, x, y, size, size);
    } catch (error) {
        console.warn(`Failed to load emoji: ${emoji}`, error);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${size}px Arial`;
        ctx.fillText(emoji, x, y + size);
    }
}

// دالة لتحويل الوقت إلى نص مقروء
function getTimeAgo(timestamp) {
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now - updated;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `before ${diffMins} min/s`;
    if (diffHours < 24) return `before ${diffHours} hour/s`;
    return `before ${diffDays} day`;
}

// ترتيب المستخدمين حسب آخر تحديث (الأحدث أولاً)
async function getSortedUsers() {
    try {
        // نجيب 20 مستخدم عشان عندنا بيانات كافية للمقارنة
        const users = await dbManager.all(`
            SELECT user_id, username, daily, special, vip, weekly, humbler, total, last_updated 
            FROM fame_points 
            ORDER BY last_updated DESC 
            LIMIT 20
        `);

        const currentData = new Map();
        const usersWithChanges = users.map(user => {
            const userData = {
                id: user.user_id,
                username: user.username,
                daily: user.daily || 0,
                special: user.special || 0,
                vip: user.vip || 0,
                weekly: user.weekly || 0,
                humbler: user.humbler || 0,
                total: user.total || 0,
                last_updated: user.last_updated,
                time_ago: getTimeAgo(user.last_updated),
                changes: {
                    total: 0,
                    daily: 0,
                    special: 0,
                    vip: 0,
                    weekly: 0,
                    humbler: 0
                }
            };

            // مقارنة مع البيانات السابقة لاكتشاف التغييرات
            if (previousUserData.has(user.user_id)) {
                const prev = previousUserData.get(user.user_id);

                // حساب التغييرات
                userData.changes.total = user.total - prev.total;
                userData.changes.daily = user.daily - prev.daily;
                userData.changes.special = user.special - prev.special;
                userData.changes.vip = user.vip - prev.vip;
                userData.changes.weekly = user.weekly - prev.weekly;
                userData.changes.humbler = user.humbler - prev.humbler;
            } else {
                // إذا المستخدم جديد في القائمة، نعتبر كل القيم زيادات
                userData.changes.total = user.total;
                userData.changes.daily = user.daily;
                userData.changes.special = user.special;
                userData.changes.vip = user.vip;
                userData.changes.weekly = user.weekly;
                userData.changes.humbler = user.humbler;
            }

            // حفظ البيانات الحالية للمقارنة المستقبلية
            currentData.set(user.user_id, {
                total: user.total,
                daily: user.daily,
                special: user.special,
                vip: user.vip,
                weekly: user.weekly,
                humbler: user.humbler,
                last_updated: user.last_updated
            });

            return userData;
        });

        // تحديث البيانات السابقة
        previousUserData = currentData;

        // نرجع فقط الـ 10 الأحدث
        return usersWithChanges.slice(0, 10);
    } catch (error) {
        console.error('Error getting sorted users:', error);
        return [];
    }
}

// إنشاء صورة الليدر بورد بنفس تصميم fameleaderboard
async function createLeaderboardImage(sortedUsers, page = 0, perPage = 10) {
    const width = 1100;
    const height = 1100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة ذهبية - نفس ستايل famestats
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#1a1400');
    bgGradient.addColorStop(0.5, '#2a2000');
    bgGradient.addColorStop(1, '#1a1400');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 0; // المسافة من الحواف
    ctx.strokeStyle = '#FFD700'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // العنوان الرئيسي
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Live Hall Of Fame', width / 2, 80);

    // مسافة بين العنوان والهيدر
    const headerY = 130;

    // الهيدر - الأعمدة
    const columnWidths = [80, 250, 110, 110, 110, 110, 110, 110];
    const columnHeaders = ['Rank', 'Player', 'Total', 'Daily', 'Special', 'VIP', 'Weekly', 'Humbler'];
    const headerEmojis = ['', '', '🏆', '📢', '✨', '👑', '📅', '🕊'];

    // خلفية الهيدر
    ctx.fillStyle = '#FFD70020';
    drawRoundedRect(ctx, 30, headerY, width - 60, 80, 10);
    ctx.fill();

    // إطار الهيدر
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 30, headerY, width - 60, 80, 10);
    ctx.stroke();

    // كتابة عناوين الأعمدة مع الايموجي فوق والنص تحت
    let currentX = 50;
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';

    for (let i = 0; i < columnHeaders.length; i++) {
        if (i === 0) {
            // عمود الرتبة - نص فقط
            ctx.fillText(columnHeaders[i], currentX + (columnWidths[i] / 2), headerY + 50);
            currentX += columnWidths[i];
        } else if (i === 1) {
            // عمود اللاعب - نص فقط (توسيط فوق الاسامي)
            ctx.fillText(columnHeaders[i], currentX + (columnWidths[i] / 2), headerY + 50);
            currentX += columnWidths[i];
        } else {
            // الأعمدة الأخرى - ايموجي فوق والنص تحت
            const emoji = headerEmojis[i];
            const text = columnHeaders[i];
            const centerX = currentX + (columnWidths[i] / 2);

            // رسم الايموجي في الأعلى
            await drawEmoji(ctx, emoji, centerX - 18, headerY + 12, 35);

            // رسم النص تحت الايموجي
            ctx.fillText(text, centerX, headerY + 70);

            currentX += columnWidths[i];
        }
    }

    // بيانات اللاعبين
    const startIdx = page * perPage;
    const endIdx = startIdx + perPage;
    const pageData = sortedUsers.slice(startIdx, endIdx);

    // إذا مفيش بيانات
    if (pageData.length === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No data available yet', width / 2, height / 2);
        return canvas.toBuffer('image/png');
    }

    // رسم كل لاعب في الجدول
    const startY = headerY + 110;
    const rowHeight = 70;

    for (let i = 0; i < pageData.length; i++) {
        const user = pageData[i];
        const rank = startIdx + i + 1;
        const gap = 10; // المسافة بين الصفوف
        const y = startY + (i * (rowHeight + gap));

        // تحديد لون الصف حسب قِدْم التحديث
        const timeDiff = (Date.now() - new Date(user.last_updated)) / 60000;
        const isNewUser = !previousUserData.has(user.user_id) && timeDiff < 60; // جديد إذا ظهر في آخر ساعة

        let rowColor = '#00000020';
        let borderColor = '#FFFFFF10';

        if (timeDiff < 10 || isNewUser) {
            rowColor = '#FFD70020'; // خلفية ذهبية فاتحة
            borderColor = '#FFD70030'; // إطار ذهبي
        }

        // خلفية الصف
        ctx.fillStyle = rowColor;
        drawRoundedRect(ctx, 30, y, width - 60, rowHeight, 8);
        ctx.fill();

        // إطار الصف
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = (timeDiff < 10 || isNewUser) ? 2 : 1;
        drawRoundedRect(ctx, 30, y, width - 60, rowHeight, 8);
        ctx.stroke();

        currentX = 50;

        // عمود الرتبة - أرقام عادية ملونة زي الميداليات
        let rankColor = '#FFFFFF';
        if (rank === 1) rankColor = '#FFD700';
        else if (rank === 2) rankColor = '#C0C0C0';
        else if (rank === 3) rankColor = '#CD7F32';

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        const rankText = rank.toString();
        ctx.fillText(rankText, currentX + (columnWidths[0] / 2), y + 42);
        currentX += columnWidths[0];

        // عمود اللاعب (الاسم) - توسيط
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        let username = user.username || `User ${user.id}`;
        if (ctx.measureText(username).width > 230) {
            while (ctx.measureText(username + '...').width > 230 && username.length > 3) {
                username = username.slice(0, -1);
            }
            username += '...';
        }
        ctx.fillText(username, currentX + (columnWidths[1] / 2), y + 42);
        currentX += columnWidths[1];

        // الأعمدة الرقمية - ايموجي فوق والرقم تحت
        const stats = [
            { value: user.total || 0, change: user.changes.total, type: 'total' },
            { value: user.daily || 0, change: user.changes.daily, type: 'daily' },
            { value: user.special || 0, change: user.changes.special, type: 'special' },
            { value: user.vip || 0, change: user.changes.vip, type: 'vip' },
            { value: user.weekly || 0, change: user.changes.weekly, type: 'weekly' },
            { value: user.humbler || 0, change: user.changes.humbler, type: 'humbler' }
        ];

        ctx.textAlign = 'center';

        for (let j = 0; j < stats.length; j++) {
            const centerX = currentX + (columnWidths[j + 2] / 2);
            const stat = stats[j];

            // تحديد لون النص - دهبي فاتح إذا كان فيه زيادة
            if (stat.change > 0) {
                ctx.fillStyle = '#FFE55C'; // دهبي فاتح للزيادة
            } else {
                ctx.fillStyle = '#FFFFFF'; // أبيض إذا لا يوجد زيادة
            }
            ctx.font = 'bold 28px Arial';

            // رسم الرقم
            ctx.fillText(stat.value.toString(), centerX, y + 45);

            currentX += columnWidths[j + 2];
        }

        /*// خط فاصل بين الصفوف
        if (i < pageData.length - 1) {
            ctx.strokeStyle = '#FFFFFF10';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(50, y + rowHeight);
            ctx.lineTo(width - 50, y + rowHeight);
            ctx.stroke();
        }*/
    }

    return canvas.toBuffer('image/png');
}

// دالة لتحديث الـ Live Fame Leaderboard
async function updateLiveFame(client) {
    if (!liveMessageData) return false;

    try {
        const { channelId, messageId } = liveMessageData;
        const channel = await client.channels.fetch(channelId);

        if (!channel) {
            console.log('Channel not found');
            liveMessageData = null;
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'fame');
            return false;
        }

        const sortedUsers = await getSortedUsers();
        const buffer = await createLeaderboardImage(sortedUsers, 0);
        const attachment = new AttachmentBuilder(buffer, { name: 'livefame_leaderboard.png' });

        try {
            const message = await channel.messages.fetch(messageId);
            await message.edit({ files: [attachment] });
            //console.log('✅ Live fame leaderboard updated - Showing', sortedUsers.length, 'users');
            return true;
        } catch (error) {
            console.log('Message not found:', error.message);
            liveMessageData = null;
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'fame');
            return false;
        }

    } catch (error) {
        console.error('Error updating live fame:', error.message);
        return false;
    }
}

// دالة للتحقق من التحديثات
async function checkForFameUpdates(client) {
    try {
        if (!liveMessageData) return;
        await updateLiveFame(client);
    } catch (error) {
        console.error('❌ Error checking for fame updates:', error.message);
    }
}

// دالة لتحميل الـ live message من الداتابيز
async function loadLiveFameMessage(client) {
    try {
        const liveData = await dbManager.getLiveLeaderboard(CURRENT_GUILD_ID, 'fame');
        if (!liveData) return;

        try {
            const channel = await client.channels.fetch(liveData.channel_id);
            const message = await channel.messages.fetch(liveData.message_id);

            liveMessageData = {
                channelId: liveData.channel_id,
                messageId: liveData.message_id
            };

            console.log('✅ Loaded live fame message');
        } catch (error) {
            console.log('❌ Live fame message not found, deleting from DB');
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'fame');
        }

    } catch (error) {
        console.error('Error loading live fame message:', error);
    }
}

// بدء نظام الـ Live Fame
function startLiveFameSystem(client) {
    loadLiveFameMessage(client).then(() => {
        if (updateInterval) clearInterval(updateInterval);

        updateInterval = setInterval(() => checkForFameUpdates(client), 1800000); // 30 دقيقة
        console.log('🚀 Live Fame system started - checking every 30 minutes');

        setTimeout(() => checkForFameUpdates(client), 5000);
    });
}

// دالة لاختبار التحديث يدوياً
async function forceFameUpdate(client) {
    console.log('🔧 Force updating fame leaderboard');
    return await updateLiveFame(client);
}

// دالة لمسح البيانات السابقة (إذا احتجت)
function clearPreviousData() {
    previousUserData.clear();
    console.log('🧹 Cleared previous user data');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('livefame')
        .setDescription('Setup live fame updates in a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send live fame updates')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildText)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const channel = interaction.options.getChannel('channel');

            if (!channel.permissionsFor(interaction.guild.members.me).has('SendMessages')) {
                return interaction.editReply({ content: 'I don\'t have permission to send messages in that channel!' });
            }

            const sortedUsers = await getSortedUsers();
            const buffer = await createLeaderboardImage(sortedUsers, 0);
            const attachment = new AttachmentBuilder(buffer, { name: 'livefame_leaderboard.png' });

            const message = await channel.send({ files: [attachment] });

            // حفظ البيانات
            liveMessageData = {
                channelId: channel.id,
                messageId: message.id
            };

            // حفظ في الداتابيز باستخدام الدالة الأصلية
            await dbManager.saveLiveLeaderboard(CURRENT_GUILD_ID, 'fame', channel.id, message.id);

            await interaction.editReply({ 
                content: `✅ Live fame updates has been setup in ${channel}! It will update every 10 minutes.` 
            });

            console.log(`✅ Live fame setup in channel ${channel.id}`);

        } catch (error) {
            console.error('❌ Error setting up live fame:', error.message);
            await interaction.editReply('❌ An error occurred while setting up the live fame updates.');
        }
    },

    startLiveFameSystem,
    forceFameUpdate,
    clearPreviousData,
    liveMessageData
};