const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');
const twemoji = require('twemoji');

// تخزين رسالة اللايف شيم للسيرفر الواحد
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

// ترتيب المستخدمين حسب آخر تحديث (الأحدث أولاً)
async function getSortedUsers() {
    try {
        // نجيب 20 مستخدم عشان عندنا بيانات كافية للمقارنة
        const users = await dbManager.all(`
            SELECT user_id, username, giveaway_ban, warns, total, last_updated 
            FROM shame_points 
            ORDER BY last_updated DESC 
            LIMIT 20
        `);

        const currentData = new Map();
        const usersWithChanges = users.map(user => {
            const userData = {
                id: user.user_id,
                username: user.username,
                giveaway_ban: user.giveaway_ban,
                warns: user.warns,
                total: user.total,
                last_updated: user.last_updated,
                changes: {
                    total: 0,
                    giveaway_ban: 0,
                    warns: 0
                }
            };

            // مقارنة مباشرة مع البيانات السابقة
            if (previousUserData.has(user.user_id)) {
                const prev = previousUserData.get(user.user_id);

                // حساب التغييرات المباشرة (بدون تراكم)
                userData.changes.total = user.total - prev.total;
                userData.changes.giveaway_ban = user.giveaway_ban - prev.giveaway_ban;
                userData.changes.warns = user.warns - prev.warns;
            } else {
                // إذا المستخدم جديد في القائمة، نعتبر كل القيم زيادات
                userData.changes.total = user.total;
                userData.changes.giveaway_ban = user.giveaway_ban;
                userData.changes.warns = user.warns;
            }

            // حفظ البيانات الحالية للمقارنة المستقبلية
            currentData.set(user.user_id, {
                total: user.total,
                giveaway_ban: user.giveaway_ban,
                warns: user.warns,
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
    return `before ${diffDays} day/s`;
}

// إنشاء صورة الليدر بورد
async function createLeaderboardImage(sortedUsers, page = 0, perPage = 10) {
    const width = 1100;
    const height = 1100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة حمراء داكنة - ستايل يناسب العار
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#1a0000');
    bgGradient.addColorStop(0.5, '#2a0000');
    bgGradient.addColorStop(1, '#1a0000');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 0; // المسافة من الحواف
    ctx.strokeStyle = '#8B0000'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // العنوان الرئيسي - توسيط
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Live Hall Of Shame', width / 2, 80);

    // مسافة بين العنوان والهيدر
    const headerY = 120;

    // الهيدر - الأعمدة (بدون Last Update)
    const columnWidths = [80, 350, 200, 200, 200];
    const columnHeaders = ['Rank', 'Player', 'Total', 'Giveaway Ban', 'Warn'];
    const headerEmojis = ['', '', '🥀', '🚫', '⚠'];

    // خلفية الهيدر
    ctx.fillStyle = '#8B000020';
    drawRoundedRect(ctx, 30, headerY, width - 60, 80, 10);
    ctx.fill();

    // إطار الهيدر
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 30, headerY, width - 60, 80, 10);
    ctx.stroke();

    // كتابة عناوين الأعمدة مع الايموجي فوق والنص تحت - توسيط
    let currentX = 50;
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';

    for (let i = 0; i < columnHeaders.length; i++) {
        if (i === 0) {
            // عمود الرتبة - نص فقط
            ctx.fillText(columnHeaders[i], currentX + (columnWidths[i] / 2), headerY + 50);
            currentX += columnWidths[i];
        } else if (i === 1) {
            // عمود اللاعب - نص فقط
            ctx.fillText(columnHeaders[i], currentX + (columnWidths[i] / 2), headerY + 50);
            currentX += columnWidths[i];
        } else {
            // الأعمدة الأخرى - ايموجي فوق والنص تحت
            const emoji = headerEmojis[i];
            const text = columnHeaders[i];
            const centerX = currentX + (columnWidths[i] / 2);

            // رسم الايموجي في الأعلى
            await drawEmoji(ctx, emoji, centerX - 15, headerY + 12, 30);

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
    const rowHeight = 75;

    for (let i = 0; i < pageData.length; i++) {
        const user = pageData[i];
        const rank = startIdx + i + 1;
        const gap = 10; // المسافة بين الصفوف
        const y = startY + (i * (rowHeight + gap));

        // تحديد لون الصف حسب قِدْم التحديث
        const timeAgo = getTimeAgo(user.last_updated);
        let rowColor = '#00000020';
        let borderColor = '#FFFFFF10';

        // إذا التحديث حديث (أقل من 10 دقائق) أو المستخدم جديد
        const timeDiff = (Date.now() - new Date(user.last_updated)) / 60000;
        const isNewUser = !previousUserData.has(user.user_id) && timeDiff < 60; // جديد إذا ظهر في آخر ساعة

        if (timeDiff < 10 || isNewUser) {
            rowColor = '#00000020'; // خلفية حمراء فاتحة
            borderColor = '#FFFFFF10'; // إطار أحمر
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

        // عمود الرتبة - توسيط
        ctx.fillStyle = '#FFFFFF';
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
        if (ctx.measureText(username).width > 280) {
            while (ctx.measureText(username + '...').width > 280 && username.length > 3) {
                username = username.slice(0, -1);
            }
            username += '...';
        }

        ctx.fillText(username, currentX + (columnWidths[1] / 2), y + 42);
        currentX += columnWidths[1];

        // الأعمدة الرقمية - مع الألوان للزيادات والنقصان - توسيط
        const stats = [
            { value: user.total || 0, change: user.changes.total, type: 'total' },
            { value: user.giveaway_ban || 0, change: user.changes.giveaway_ban, type: 'giveaway_ban' },
            { value: user.warns || 0, change: user.changes.warns, type: 'warns' }
        ];

        ctx.textAlign = 'center';

        for (let j = 0; j < stats.length; j++) {
            const centerX = currentX + (columnWidths[j + 2] / 2);
            const stat = stats[j];

            // تحديد لون النص - أحمر للزيادة، أخضر للنقصان، أبيض إذا لا يوجد تغيير
            if (stat.change > 0) {
                ctx.fillStyle = '#FF0000'; // أحمر للزيادة
            } else if (stat.change < 0) {
                ctx.fillStyle = '#00FF00'; // أخضر للنقصان
            } else {
                ctx.fillStyle = '#FFFFFF'; // أبيض إذا لا يوجد تغيير
            }
            ctx.font = 'bold 28px Arial';

            // رسم الرقم فقط
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

// دالة لتحديث الـ Live Shame Leaderboard
async function updateLiveShame(client) {
    if (!liveMessageData) return false;

    try {
        const { channelId, messageId } = liveMessageData;
        const channel = await client.channels.fetch(channelId);

        if (!channel) {
            console.log('Channel not found');
            liveMessageData = null;
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'shame');
            return false;
        }

        const sortedUsers = await getSortedUsers();
        const buffer = await createLeaderboardImage(sortedUsers, 0);
        const attachment = new AttachmentBuilder(buffer, { name: 'liveshame_leaderboard.png' });

        try {
            const message = await channel.messages.fetch(messageId);
            await message.edit({ files: [attachment] });
            //console.log('✅ Live shame leaderboard updated - Showing', sortedUsers.length, 'users');
            return true;
        } catch (error) {
            console.log('Message not found:', error.message);
            liveMessageData = null;
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'shame');
            return false;
        }

    } catch (error) {
        console.error('Error updating live shame:', error.message);
        return false;
    }
}

// دالة للتحقق من التحديثات
async function checkForShameUpdates(client) {
    try {
        if (!liveMessageData) return;
        await updateLiveShame(client);
    } catch (error) {
        console.error('❌ Error checking for shame updates:', error.message);
    }
}

// دالة لتحميل الـ live message من الداتابيز
async function loadLiveShameMessage(client) {
    try {
        const liveData = await dbManager.getLiveLeaderboard(CURRENT_GUILD_ID, 'shame');
        if (!liveData) return;

        try {
            const channel = await client.channels.fetch(liveData.channel_id);
            const message = await channel.messages.fetch(liveData.message_id);

            liveMessageData = {
                channelId: liveData.channel_id,
                messageId: liveData.message_id
            };

            console.log('✅ Loaded live shame message');
        } catch (error) {
            console.log('❌ Live shame message not found, deleting from DB');
            await dbManager.deleteLiveLeaderboard(CURRENT_GUILD_ID, 'shame');
        }

    } catch (error) {
        console.error('Error loading live shame message:', error);
    }
}

// بدء نظام الـ Live Shame
function startLiveShameSystem(client) {
    loadLiveShameMessage(client).then(() => {
        if (updateInterval) clearInterval(updateInterval);

        updateInterval = setInterval(() => checkForShameUpdates(client), 1800000); // 30 دقيقة
        console.log('🚀 Live Shame system started - checking every 30 minutes');

        setTimeout(() => checkForShameUpdates(client), 5000);
    });
}

// دالة لاختبار التحديث يدوياً
async function forceShameUpdate(client) {
    console.log('🔧 Force updating shame leaderboard');
    return await updateLiveShame(client);
}

// دالة لمسح البيانات السابقة (إذا احتجت)
function clearPreviousData() {
    previousUserData.clear();
    console.log('🧹 Cleared previous user data');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('liveshame')
        .setDescription('Setup live shame updates in a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send live shame updates')
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
            const attachment = new AttachmentBuilder(buffer, { name: 'liveshame_leaderboard.png' });

            const message = await channel.send({ files: [attachment] });

            // حفظ البيانات
            liveMessageData = {
                channelId: channel.id,
                messageId: message.id
            };

            // حفظ في الداتابيز
            await dbManager.saveLiveLeaderboard(CURRENT_GUILD_ID, 'shame', channel.id, message.id);

            await interaction.editReply({ 
                content: `✅ Live shame updates has been setup in ${channel}! It will update every 10 minutes.` 
            });

            console.log(`✅ Live shame setup in channel ${channel.id}`);

        } catch (error) {
            console.error('❌ Error setting up live shame:', error.message);
            await interaction.editReply('❌ An error occurred while setting up the live shame updates.');
        }
    },

    startLiveShameSystem,
    forceShameUpdate,
    clearPreviousData,
    liveMessageData
};