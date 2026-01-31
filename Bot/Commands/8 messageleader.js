const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');
const twemoji = require('twemoji');

// تخزين رسائل الليدر بورد وجامعي الأزرار
let leaderboardMessages = new Map();
let activeCollectors = new Map();

// دالة لإنشاء تدرج لوني
function createGradient(ctx, x, y, width, height, colorStops) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    colorStops.forEach(stop => {
        gradient.addColorStop(stop.position, stop.color);
    });
    return gradient;
}

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

// caching للإيموجي
const emojiCache = new Map();
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

// دالة لفحص البيانات
function debugLeaderboardData(sortedUsers, userId) {
    /*console.log('=== DEBUG LEADERBOARD DATA ===');
    console.log('Total users:', sortedUsers.length);
    console.log('Looking for user ID:', userId);*/

    // عرض أول 5 مستخدمين للتحقق
    sortedUsers.slice(0, 5).forEach((user, index) => {
        console.log(`User ${index + 1}:`, {
            id: user.id,
            user_id: user.user_id,
            username: user.username,
            hasId: !!user.id,
            hasUserId: !!user.user_id,
            idType: typeof user.id,
            userIdType: typeof user.user_id
        });
    });

    // البحث عن المستخدم
    const foundUser = sortedUsers.find(u => {
        //console.log('Comparing:', u.id, 'with', userId, 'result:', u.id === userId);
        return u.id === userId;
    });

    //console.log('User found:', !!foundUser);
    //console.log('=== END DEBUG ===');

    return foundUser;
}

// ترتيب المستخدمين
async function getSortedUsers(period = 'total') {
    try {
        const result = await dbManager.getMessageLeaderboard(period, 0, 1000);
        return result.users || [];
    } catch (error) {
        console.error('Error getting sorted users:', error);
        return [];
    }
}

// إنشاء صورة الليدر بورد
async function createLeaderboardImage(sortedUsers, page = 0, perPage = 10, period = 'total') {
    const width = 1100;
    const height = 1250;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية ثابتة داكنة - بدون gradient
    ctx.fillStyle = '#101010';
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 0; // المسافة من الحواف
    ctx.strokeStyle = '#0073ff'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // العنوان الرئيسي
    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Messages Leaderboard', width / 2, 80);

    // مسافة بين العنوان والهيدر
    const headerY = 130;

    // الهيدر - الأعمدة مع كل الفترات وتوزيع أفضل
    const columnWidths = [70, 250, 160, 160, 160, 160]; // عمود All Time أوسع قليلاً
    const columnHeaders = ['Rank', 'Member', 'Daily', 'Weekly', 'Monthly', 'All Time'];
    const headerEmojis = ['', '', '🕑', '📊', '📈', '📊'];

    // خلفية الهيدر
    ctx.fillStyle = '#0073ff15';
    drawRoundedRect(ctx, 40, headerY, width - 80, 80, 12);
    ctx.fill();

    // إطار الهيدر
    ctx.strokeStyle = '#0073ff';
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 40, headerY, width - 80, 80, 12);
    ctx.stroke();

    // كتابة عناوين الأعمدة مع الايموجي فوق والنص تحت
    let currentX = 60;
    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';

    for (let i = 0; i < columnHeaders.length; i++) {
        const centerX = currentX + (columnWidths[i] / 2);

        if (i === 0) {
            // عمود الرتبة - نص فقط
            ctx.fillText(columnHeaders[i], centerX, headerY + 50);
        } else if (i === 1) {
            // عمود اللاعب - نص فقط
            ctx.fillText(columnHeaders[i], centerX, headerY + 50);
        } else {
            // الأعمدة الأخرى - ايموجي فوق والنص تحت
            const emoji = headerEmojis[i];
            const text = columnHeaders[i];

            // رسم الايموجي في الأعلى
            await drawEmoji(ctx, emoji, centerX - 16, headerY + 10, 32);

            // رسم النص تحت الايموجي
            ctx.fillText(text, centerX, headerY + 68);
        }
        currentX += columnWidths[i];
    }

    // بيانات اللاعبين
    const startIdx = page * perPage;
    const endIdx = startIdx + perPage;
    const pageData = sortedUsers.slice(startIdx, endIdx);
    const totalPages = Math.ceil(sortedUsers.length / perPage);

    // إذا مفيش بيانات
    if (pageData.length === 0) {
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No data available yet', width / 2, height / 2);
        return canvas.toBuffer('image/png');
    }

    // رسم كل لاعب في الجدول
    const startY = headerY + 140;
    const rowHeight = 75; // ارتفاع كل صف
    const gapHeight = 15; // المسافة الإضافية بين الصفوف

    for (let i = 0; i < pageData.length; i++) {
        const user = pageData[i];
        const rank = startIdx + i + 1;

        // حساب الـ Y مع المسافات الإضافية
        const y = startY + (i * (rowHeight + gapHeight));

        // خلفية الصف - أول 10 بتكون متدرجة، والباقي تبادل ألوان
        let backgroundColor;

        if (rank <= 5) {
            // أول 5: تدرج لوني من الأحمر للأزرق
            const bgGradient = ctx.createLinearGradient(40, y, 40, y + rowHeight);
            bgGradient.addColorStop(0, '#ff000710'); // أحمر شفاف
            bgGradient.addColorStop(1, '#5600ff10'); // أزرق شفاف
            backgroundColor = bgGradient;
        } 
        else if (rank <= 10) {
            // المراكز 6-10: تدرج لوني مختلف (مثلاً أزرق وأخضر)
            const bgGradient = ctx.createLinearGradient(40, y, 40, y + rowHeight);
            bgGradient.addColorStop(0, '#FFD70008'); // أزرق شفاف
            bgGradient.addColorStop(1, '#FFEC8B08'); // أخضر شفاف
            backgroundColor = bgGradient;
        }
        else {
            // الباقي: تبادل بين لونين
            backgroundColor = i % 2 === 0 ? '#1a1a1a' : '#222222';
        }

        ctx.fillStyle = backgroundColor;
        drawRoundedRect(ctx, 40, y, width - 80, rowHeight, 10);
        ctx.fill();

        // إطار الصف - أول 10 فقط يكونوا ملونين، الباقي رمادي
        let frameColor = '#FFFFFF15'; // لون افتراضي رمادي للباقي

        if (rank <= 10) {
            // أول 5: تدرج لوني من الأحمر للأزرق
            if (rank <= 5) {
                const frameGradient = ctx.createLinearGradient(40, y, 40, y + rowHeight);
                frameGradient.addColorStop(0, '#ff0007');
                frameGradient.addColorStop(1, '#5600ff');
                frameColor = frameGradient;
            } 
            // المراكز 6-10: دهبي
            else {
                frameColor = '#FFD700'; // دهبي
            }
        }

        ctx.strokeStyle = frameColor;
        ctx.lineWidth = 1.5;
        drawRoundedRect(ctx, 40, y, width - 80, rowHeight, 10);
        ctx.stroke();

        currentX = 60;

        // عمود الرتبة - ألوان حسب الترتيب
        let rankColor = '#0073ff'; // لون افتراضي للباقي

        // أول 5: تدرج لوني من الأحمر للأزرق
        if (rank <= 5) {
            const gradient = createGradient(ctx, currentX, y, 0, rowHeight, [
                { position: 0, color: '#ff0007' },   // أحمر من فوق
                { position: 1, color: '#5600ff' }    // أزرق من تحت
            ]);
            rankColor = gradient;
        } 
        // المراكز 6-10: دهبي
        else if (rank <= 10) {
            rankColor = '#FFD700'; // دهبي
        }
        // الباقي: أزرق
        else {
            rankColor = '#0073ff'; // أزرق
        }

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        const rankText = rank.toString();
        ctx.fillText(rankText, currentX + (columnWidths[0] / 2), y + 45);
        currentX += columnWidths[0];

        // عمود اللاعب (الاسم) - توسيط
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        let username = user.username || `User ${user.id}`;
        if (ctx.measureText(username).width > 200) {
            while (ctx.measureText(username + '...').width > 200 && username.length > 3) {
                username = username.slice(0, -1);
            }
            username += '...';
        }
        ctx.fillText(username, currentX + (columnWidths[1] / 2), y + 45);
        currentX += columnWidths[1];

        // الأعمدة الرقمية - كل الفترات
        const stats = [
            user.daily_sent || 0,
            user.weekly_sent || 0,
            user.monthly_sent || 0,
            user.sent || user.total || 0
        ];

        ctx.textAlign = 'center';
        ctx.font = 'bold 28px Arial';

        for (let j = 0; j < stats.length; j++) {
            const centerX = currentX + (columnWidths[j + 2] / 2);

            // رسم الرقم فقط
            ctx.fillStyle = '#FFFFFF';
            ctx.fillText(stats[j].toString(), centerX, y + 45);

            currentX += columnWidths[j + 2];
        }

        // خط فاصل بين الصفوف
        if (i < pageData.length - 1) {
            ctx.strokeStyle = '#FFFFFF10';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(60, y + rowHeight);
            ctx.lineTo(width - 60, y + rowHeight);
            ctx.stroke();
        }
    }

    // معلومات الصفحة في الأسفل
    const footerY = height - 35;
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${page + 1} of ${totalPages} • ${sortedUsers.length} Member/s`, width / 2, footerY);

    /*// خط فاصل فوق الفوتر
    ctx.strokeStyle = '#0073ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(120, footerY - 25);
    ctx.lineTo(width - 120, footerY - 25);
    ctx.stroke();*/

    return canvas.toBuffer('image/png');
}

// إنشاء صورة الخطأ
async function createErrorImage(title, message) {
    const width = 600;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية ثابتة
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#0073ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    await drawEmoji(ctx, '❌', width / 2 - 20, 40, 40);

    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 100);

    ctx.fillStyle = '#CCCCCC';
    ctx.font = '16px Arial';

    const words = message.split(' ');
    let line = '';
    let y = 130;
    const maxWidth = width - 100;

    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, width / 2, y);
            line = word + ' ';
            y += 25;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, width / 2, y);

    return canvas.toBuffer('image/png');
}

// إنشاء أزرار التنقل
function createActionRow(currentPage, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('prev_page')
            .setLabel('◀️ Prev')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage === 0),
        new ButtonBuilder()
            .setCustomId('check_stats')
            .setLabel('Find Me')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔍'),
        new ButtonBuilder()
            .setCustomId('next_page')
            .setLabel('Next ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(currentPage >= totalPages - 1)
    );
}

// إعداد جامع الأزرار
function setupButtonCollector(message, interaction, sortedUsers) {
    if (activeCollectors.has(message.id)) {
        const oldCollector = activeCollectors.get(message.id);
        if (!oldCollector.ended) {
            oldCollector.stop();
        }
        activeCollectors.delete(message.id);
    }

    const collector = message.createMessageComponentCollector({ 
        filter: i => i.user.id === interaction.user.id,
        time: 300000
    });

    activeCollectors.set(message.id, collector);

    collector.on('collect', async i => {
        try {
            if (i.customId === 'check_stats') {
                await i.deferReply({ ephemeral: true });

                const currentData = leaderboardMessages.get(message.id);

                if (!currentData || !currentData.sortedUsers) {
                    return await i.followUp({ 
                        content: '❌ Leaderboard data not available. Please try again.', 
                        ephemeral: true 
                    });
                }

                // استخدام دالة الdebugging
                debugLeaderboardData(currentData.sortedUsers, i.user.id);

                // البحث بجميع الطرق الممكنة
                let userInLeaderboard = null;
                let searchMethod = '';

                // الطريقة 1: البحث بـ id
                userInLeaderboard = currentData.sortedUsers.find(u => u.id === i.user.id);
                if (userInLeaderboard) searchMethod = 'id';

                // الطريقة 2: البحث بـ user_id
                if (!userInLeaderboard) {
                    userInLeaderboard = currentData.sortedUsers.find(u => u.user_id === i.user.id);
                    if (userInLeaderboard) searchMethod = 'user_id';
                }

                // الطريقة 3: البحث بالاسم
                if (!userInLeaderboard) {
                    userInLeaderboard = currentData.sortedUsers.find(u => 
                        u.username && u.username.toLowerCase() === i.user.username.toLowerCase()
                    );
                    if (userInLeaderboard) searchMethod = 'username';
                }

                console.log(`User search: Found=${!!userInLeaderboard}, Method=${searchMethod}`);

                if (!userInLeaderboard) {
                    // إذا فشل كل شيء، نستخدم قاعدة البيانات مباشرة
                    try {
                        const dbStats = await dbManager.getUserMessageStats(i.user.id, 'total');
                        if (dbStats) {
                            const embed = new EmbedBuilder()
                                .setColor(0x0073ff)
                                .setDescription(`**<:Chat:1416160630490136766> Messages statistics:**

                                <:Leaderboard:1412843835318599810> **Global Rank:** #${userRank}

                                <:Dot:1417280000960368640> **Daily:** ${userStats.daily_sent}
                                <:Dot:1417280000960368640> **Weekly:** ${userStats.weekly_sent}  
                                <:Dot:1417280000960368640> **Monthly:** ${userStats.monthly_sent}
                                <:Dot:1417280000960368640> **All Time:** ${userStats.sent}`)
                                .setThumbnail(i.user.displayAvatarURL({ dynamic: true, size: 128 })
                                )

                            return await i.followUp({ embeds: [embed], ephemeral: true });
                        }
                    } catch (dbError) {
                        console.error('Database error:', dbError);
                    }

                    return await i.followUp({ 
                        content: '❌ Your stats are not available. Try using the leaderboard command first.', 
                        ephemeral: true 
                    });
                }

                // استخدام البيانات من الليدر بورد
                const userStats = {
                    daily_sent: userInLeaderboard.daily_sent || 0,
                    weekly_sent: userInLeaderboard.weekly_sent || 0,
                    monthly_sent: userInLeaderboard.monthly_sent || 0,
                    sent: userInLeaderboard.sent || userInLeaderboard.total || 0
                };

                // حساب الرتبة
                let userRank = 0;
                if (searchMethod === 'id') {
                    userRank = currentData.sortedUsers.findIndex(u => u.id === i.user.id) + 1;
                } else if (searchMethod === 'user_id') {
                    userRank = currentData.sortedUsers.findIndex(u => u.user_id === i.user.id) + 1;
                } else {
                    userRank = currentData.sortedUsers.findIndex(u => 
                        u.username && u.username.toLowerCase() === i.user.username.toLowerCase()
                    ) + 1;
                }

                const embed = new EmbedBuilder()
                    .setColor(0x0073ff)
                    .setDescription(`**<:Chat:1416160630490136766> Messages statistics:**

                    <:Leaderboard:1412843835318599810> **Global Rank:** #${userRank}

                    <:Dot:1417280000960368640> **Daily:** ${userStats.daily_sent}
                    <:Dot:1417280000960368640> **Weekly:** ${userStats.weekly_sent}  
                    <:Dot:1417280000960368640> **Monthly:** ${userStats.monthly_sent}
                    <:Dot:1417280000960368640> **All Time:** ${userStats.sent}`)
                    .setThumbnail(i.user.displayAvatarURL({ dynamic: true, size: 128 })
                    )

                await i.followUp({ embeds: [embed], ephemeral: true });

            } else if (i.customId === 'prev_page' || i.customId === 'next_page') {
                await i.deferUpdate();

                // استخدام البيانات المخزنة في collector بدلاً من leaderboardMessages
                const currentData = leaderboardMessages.get(message.id);
                if (!currentData) {
                    // إذا لم توجد بيانات، نعيد تحميلها
                    const freshSortedUsers = await getSortedUsers('total');
                    const totalPages = Math.ceil(freshSortedUsers.length / 10);

                    let newPage = 0;
                    if (i.customId === 'prev_page') {
                        newPage = Math.max(0, (currentData?.currentPage || 0) - 1);
                    } else {
                        newPage = Math.min(totalPages - 1, (currentData?.currentPage || 0) + 1);
                    }

                    const buffer = await createLeaderboardImage(freshSortedUsers, newPage, 10, 'total');
                    const attachment = new AttachmentBuilder(buffer, { name: 'messages_leaderboard.png' });
                    const row = createActionRow(newPage, totalPages);

                    // تحديث البيانات المخزنة
                    leaderboardMessages.set(message.id, {
                        channel: message.channel,
                        sortedUsers: freshSortedUsers,
                        currentPage: newPage,
                        totalPages: totalPages,
                        period: 'total'
                    });

                    await i.editReply({ files: [attachment], components: [row] });
                    setupButtonCollector(message, interaction, freshSortedUsers);
                    return;
                }

                let newPage = currentData.currentPage;

                if (i.customId === 'prev_page') {
                    newPage = Math.max(0, newPage - 1);
                } else {
                    newPage = Math.min(currentData.totalPages - 1, newPage + 1);
                }

                const buffer = await createLeaderboardImage(currentData.sortedUsers, newPage, 10, 'total');
                const attachment = new AttachmentBuilder(buffer, { name: 'messages_leaderboard.png' });
                const row = createActionRow(newPage, currentData.totalPages);

                // تحديث البيانات المخزنة
                leaderboardMessages.set(message.id, {
                    ...currentData,
                    currentPage: newPage
                });

                await i.editReply({ files: [attachment], components: [row] });
                // لا نحتاج لاستدعاء setupButtonCollector هنا مرة أخرى
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            if (!i.replied && !i.deferred) {
                await i.reply({ content: 'An error occurred. Please try again.', ephemeral: true });
            } else {
                await i.followUp({ content: 'An error occurred. Please try again.', ephemeral: true });
            }
        }
    });

    collector.on('end', (collected, reason) => {
        console.log(`Collector ended for message ${message.id}. Reason: ${reason}`);
        activeCollectors.delete(message.id);
        leaderboardMessages.delete(message.id);

        if (reason === 'time') {
            const disabledRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('prev_page')
                    .setLabel('◀️ Prev')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('check_stats')
                    .setLabel('Find Me')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🔍')
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('next_page')
                    .setLabel('Next ▶️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            message.edit({ components: [disabledRow] }).catch(console.error);
        }
    });
}

// تحديث جميع الليدر بوردات النشطة
async function updateAllLeaderboards() {
    for (const [messageId, data] of leaderboardMessages.entries()) {
        try {
            const channel = data.channel;
            const message = await channel.messages.fetch(messageId);
            const buffer = await createLeaderboardImage(data.sortedUsers, data.currentPage, 10, 'total');
            const attachment = new AttachmentBuilder(buffer, { name: 'messages_leaderboard.png' });

            const row = createActionRow(data.currentPage, data.totalPages);
            await message.edit({ files: [attachment], components: [row] });
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            leaderboardMessages.delete(messageId);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('messagesleaderboard')
        .setDescription('Display messages leaderboard with all time periods'),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const sortedUsers = await getSortedUsers('total');

            if (sortedUsers.length === 0) {
                const buffer = await createErrorImage('No Data', 'No message data available yet.');
                const attachment = new AttachmentBuilder(buffer, { name: 'messages_leaderboard.png' });
                return interaction.editReply({ files: [attachment] });
            }

            const buffer = await createLeaderboardImage(sortedUsers, 0, 10, 'total');
            const attachment = new AttachmentBuilder(buffer, { name: 'messages_leaderboard.png' });
            const totalPages = Math.ceil(sortedUsers.length / 10);
            const row = createActionRow(0, totalPages);

            const message = await interaction.editReply({ files: [attachment], components: [row] });

            leaderboardMessages.set(message.id, {
                channel: message.channel,
                sortedUsers: sortedUsers,
                currentPage: 0,
                totalPages: totalPages,
                period: 'total'
            });

            setupButtonCollector(message, interaction, sortedUsers);
        } catch (error) {
            console.error('Error:', error);
            const buffer = await createErrorImage('Error', 'An error occurred while loading leaderboard.');
            const attachment = new AttachmentBuilder(buffer, { name: 'messages_leaderboard.png' });
            await interaction.editReply({ files: [attachment] });
        }
    },

    updateAllLeaderboards
};