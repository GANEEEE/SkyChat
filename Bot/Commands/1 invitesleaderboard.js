const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');
const twemoji = require('twemoji');

// تخزين رسائل الليدر بورد وجامعي الأزرار
let leaderboardMessages = new Map();
let activeCollectors = new Map();

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

// ترتيب المستخدمين
async function getSortedUsers(range = 'all') {
    try {
        let query = `
            SELECT user_id, username, total, verified, unverified, left_count
            FROM invites 
            WHERE total > 0 OR verified > 0 OR unverified > 0 OR left_count > 0
            ORDER BY verified DESC, total DESC, unverified DESC
        `;

        const leaderboardData = await dbManager.all(query);
        return leaderboardData.map((user, index) => ({
            ...user,
            rank: index + 1
        }));
    } catch (error) {
        console.error('Error getting sorted users:', error);
        return [];
    }
}

// إنشاء صورة الليدر بورد
async function createLeaderboardImage(sortedUsers, page = 0, perPage = 10, range = 'all') {
    const width = 1100;
    const height = 1100;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية ثابتة داكنة
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

    // العنوان الرئيسي بناءً على النطاق الزمني
    let title = 'Invites Leaderboard';
    if (range === 'weekly') {
        title += ' (Last 7 Days)';
    } else if (range === 'monthly') {
        title += ' (Last 30 Days)';
    } else {
        title += ' (All Time)';
    }

    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 80);

    // مسافة بين العنوان والهيدر
    const headerY = 130;

    // الهيدر - الأعمدة
    const columnWidths = [70, 300, 150, 150, 150, 150];
    const columnHeaders = ['Rank', 'Inviter', 'Total', 'Verified', 'Unverified', 'Left'];
    const headerEmojis = ['', '', '📫', '🟢', '🟡', '🔴'];

    // ألوان الأعمدة
    const columnColors = ['#0073ff', '#0073ff', '#0073ff', '#00ff47', '#ffd700', '#ff4444'];

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
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';

    for (let i = 0; i < columnHeaders.length; i++) {
        const centerX = currentX + (columnWidths[i] / 2);

        // لون النص حسب العمود
        ctx.fillStyle = columnColors[i];

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
        ctx.fillText('No invite data available yet', width / 2, height / 2);
        return canvas.toBuffer('image/png');
    }

    // رسم كل لاعب في الجدول
    const startY = headerY + 120;
    const rowHeight = 75;

    for (let i = 0; i < pageData.length; i++) {
        const user = pageData[i];
        const rank = startIdx + i + 1;
        const y = startY + (i * rowHeight);

        // خلفية الصف - تبادل بين لونين
        ctx.fillStyle = i % 2 === 0 ? '#1a1a1a' : '#222222';
        drawRoundedRect(ctx, 40, y, width - 80, rowHeight, 10);
        ctx.fill();

        // إطار الصف - للأوائل 3 فقط
        if (rank <= 3) {
            if (rank === 1) {
                ctx.strokeStyle = '#FFD700';
            } else if (rank === 2) {
                ctx.strokeStyle = '#C0C0C0';
            } else if (rank === 3) {
                ctx.strokeStyle = '#CD7F32';
            }

            ctx.lineWidth = 1.5;
            drawRoundedRect(ctx, 40, y, width - 80, rowHeight, 10);
            ctx.stroke();
        }

        currentX = 60;

        // عمود الرتبة - أرقام ملونة للرتب الأولى
        let rankColor = '#FFFFFF';
        if (rank === 1) rankColor = '#FFD700'; // دهبي
        else if (rank === 2) rankColor = '#C0C0C0'; // فضي
        else if (rank === 3) rankColor = '#CD7F32'; // برونزي

        ctx.fillStyle = rankColor;
        ctx.font = 'bold 26px Arial';
        ctx.textAlign = 'center';

        const rankText = rank.toString();
        ctx.fillText(rankText, currentX + (columnWidths[0] / 2), y + 45);
        currentX += columnWidths[0];

        // عمود اللاعب (الاسم) - توسيط
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        let username = user.username || `User ${user.user_id}`;
        if (ctx.measureText(username).width > 200) {
            while (ctx.measureText(username + '...').width > 200 && username.length > 3) {
                username = username.slice(0, -1);
            }
            username += '...';
        }
        ctx.fillText(username, currentX + (columnWidths[1] / 2), y + 45);
        currentX += columnWidths[1];

        // الأعمدة الرقمية - كل الإحصائيات بألوان مختلفة
        const stats = [
            { value: user.total || 0, color: '#FFFFFF' }, // أزرق
            { value: user.verified || 0, color: '#00ff47' }, // أخضر
            { value: user.unverified || 0, color: '#ffd700' }, // أصفر
            { value: user.left_count || 0, color: '#ff4444' } // أحمر
        ];

        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';

        for (let j = 0; j < stats.length; j++) {
            const centerX = currentX + (columnWidths[j + 2] / 2);

            // رسم الرقم باللون المخصص
            ctx.fillStyle = stats[j].color;
            ctx.fillText(stats[j].value.toString(), centerX, y + 45);

            currentX += columnWidths[j + 2];
        }

        /*// خط فاصل بين الصفوف
        if (i < pageData.length - 1) {
            ctx.strokeStyle = '#FFFFFF10';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(60, y + rowHeight);
            ctx.lineTo(width - 60, y + rowHeight);
            ctx.stroke();
        }*/
    }

    // معلومات الصفحة في الأسفل
    const footerY = height - 40;
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Page ${page + 1} of ${totalPages} • ${sortedUsers.length} Inviters`, width / 2, footerY);

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

// إنشاء Select Menu و أزرار التنقل
function createActionRows(currentPage, totalPages, currentRange = 'all') {
    // إنشاء Select Menu للفترات الزمنية
    const rangeSelect = new StringSelectMenuBuilder()
        .setCustomId('range_select')
        .setPlaceholder('Select time range')
        .addOptions(
            new StringSelectMenuOptionBuilder()
                .setLabel('All Time')
                .setValue('all')
                .setDescription('Show all time invites')
                .setDefault(currentRange === 'all'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Last 7 Days')
                .setValue('weekly')
                .setDescription('Show invites from last 7 days')
                .setDefault(currentRange === 'weekly'),
            new StringSelectMenuOptionBuilder()
                .setLabel('Last 30 Days')
                .setValue('monthly')
                .setDescription('Show invites from last 30 days')
                .setDefault(currentRange === 'monthly')
        );

    const selectRow = new ActionRowBuilder().addComponents(rangeSelect);

    const navigationRow = new ActionRowBuilder().addComponents(
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

    return [selectRow, navigationRow];
}

// إعداد جامع الأزرار
function setupButtonCollector(message, interaction, currentRange = 'all') {
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
                // استخدام flags بدلاً من ephemeral
                await i.deferReply({ flags: 64 }); // 64 = EPHEMERAL

                try {
                    // محاولة استيراد ملف invites stats
                    let invitesStatsModule;
                    try {
                        invitesStatsModule = require('./invitesstats');
                    } catch (requireError) {
                        // إذا الملف مش موجود، جرب مسار آخر
                        try {
                            invitesStatsModule = require('./invites');
                        } catch (error) {
                            console.error('Cannot find invites stats module:', error);
                            throw new Error('Invites stats module not found');
                        }
                    }

                    // استخدام الدالة المناسبة
                    if (invitesStatsModule && invitesStatsModule.execute) {
                        await invitesStatsModule.execute(i, i.client);
                    } else {
                        throw new Error('Invites stats execute function not found');
                    }

                } catch (error) {
                    console.error('Error in Find Me:', error);

                    // بديل إذا فشل تحميل الصورة
                    const userStats = await dbManager.get(
                        'SELECT * FROM invites WHERE user_id = ?',
                        [i.user.id]
                    );

                    if (!userStats) {
                        return await i.followUp({ 
                            content: '❌ No invite stats found for your account.', 
                            flags: 64 
                        });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('Invite Stats')
                        .setColor(0x0073ff)
                        .setDescription(`**Here are your invite statistics:**`)
                        .setThumbnail(i.user.displayAvatarURL({ dynamic: true, size: 128 }))
                        .addFields(
                            { name: '📫 Total', value: `\`${userStats.total || 0}\``, inline: true },
                            { name: '🟢 Verified', value: `\`${userStats.verified || 0}\``, inline: true },
                            { name: '🟡 Unverified', value: `\`${userStats.unverified || 0}\``, inline: true },
                            { name: '🔴 Left', value: `\`${userStats.left_count || 0}\``, inline: true }
                        );

                    await i.followUp({ embeds: [embed], flags: 64 });
                }

            } else if (i.customId === 'range_select') {
                await i.deferUpdate();

                const currentData = leaderboardMessages.get(message.id);
                if (!currentData) {
                    await i.followUp({ content: 'Session expired. Please use the command again.', flags: 64 });
                    return;
                }

                const newRange = i.values[0];
                const sortedUsers = await getSortedUsers(newRange);
                const buffer = await createLeaderboardImage(sortedUsers, 0, 10, newRange);
                const attachment = new AttachmentBuilder(buffer, { name: 'invites_leaderboard.png' });
                const rows = createActionRows(0, Math.ceil(sortedUsers.length / 10), newRange);

                leaderboardMessages.set(message.id, {
                    ...currentData,
                    sortedUsers: sortedUsers,
                    currentPage: 0,
                    totalPages: Math.ceil(sortedUsers.length / 10),
                    range: newRange
                });

                await i.editReply({ files: [attachment], components: rows });
                // إزالة هذا السطر - لا تعيد إنشاء الـ collector
                // setupButtonCollector(message, interaction, newRange);

            } else if (i.customId === 'prev_page' || i.customId === 'next_page') {
                await i.deferUpdate();

                const currentData = leaderboardMessages.get(message.id);
                if (!currentData) {
                    await i.followUp({ content: 'Session expired. Please use the command again.', flags: 64 });
                    return;
                }

                let newPage = currentData.currentPage;

                if (i.customId === 'prev_page') {
                    newPage = Math.max(0, newPage - 1);
                } else {
                    newPage = Math.min(currentData.totalPages - 1, newPage + 1);
                }

                const buffer = await createLeaderboardImage(currentData.sortedUsers, newPage, 10, currentData.range);
                const attachment = new AttachmentBuilder(buffer, { name: 'invites_leaderboard.png' });
                const rows = createActionRows(newPage, currentData.totalPages, currentData.range);

                leaderboardMessages.set(message.id, {
                    ...currentData,
                    currentPage: newPage
                });

                await i.editReply({ files: [attachment], components: rows });
                // إزالة هذا السطر - لا تعيد إنشاء الـ collector
                // setupButtonCollector(message, interaction, currentData.range);
            }
        } catch (error) {
            console.error('Error handling button interaction:', error);
            if (!i.replied && !i.deferred) {
                await i.reply({ content: 'An error occurred. Please try again.', flags: 64 });
            }
        }
    });

    collector.on('end', (collected, reason) => {
        console.log(`Collector ended for message ${message.id}. Reason: ${reason}`);
        activeCollectors.delete(message.id);
        leaderboardMessages.delete(message.id);

        if (reason === 'time') {
            const disabledSelect = new StringSelectMenuBuilder()
                .setCustomId('range_select')
                .setPlaceholder('Select time range')
                .setDisabled(true)
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('All Time')
                        .setValue('all')
                        .setDescription('Show all time invites'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Last 7 Days')
                        .setValue('weekly')
                        .setDescription('Show invites from last 7 days'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('Last 30 Days')
                        .setValue('monthly')
                        .setDescription('Show invites from last 30 days')
                );

            const disabledSelectRow = new ActionRowBuilder().addComponents(disabledSelect);

            const disabledNavRow = new ActionRowBuilder().addComponents(
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

            message.edit({ components: [disabledSelectRow, disabledNavRow] }).catch(console.error);
        }
    });
}

// تحديث جميع الليدر بوردات النشطة
async function updateAllLeaderboards() {
    for (const [messageId, data] of leaderboardMessages.entries()) {
        try {
            const channel = data.channel;
            const message = await channel.messages.fetch(messageId);
            const buffer = await createLeaderboardImage(data.sortedUsers, data.currentPage, 10, data.range);
            const attachment = new AttachmentBuilder(buffer, { name: 'invites_leaderboard.png' });

            const rows = createActionRows(data.currentPage, data.totalPages, data.range);
            await message.edit({ files: [attachment], components: rows });
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            leaderboardMessages.delete(messageId);
        }
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invitesleaderboard')
        .setDescription('Show the top members by invites')
        .addStringOption(option =>
            option.setName('range')
                .setDescription('Time period to display')
                .addChoices(
                    { name: 'All Time', value: 'all' },
                    { name: 'Last 7 Days', value: 'weekly' },
                    { name: 'Last 30 Days', value: 'monthly' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const range = interaction.options.getString('range') || 'all';
            const sortedUsers = await getSortedUsers(range);

            if (sortedUsers.length === 0) {
                const buffer = await createErrorImage('No Data', 'No invite data available yet.');
                const attachment = new AttachmentBuilder(buffer, { name: 'invites_leaderboard.png' });
                return interaction.editReply({ files: [attachment] });
            }

            const buffer = await createLeaderboardImage(sortedUsers, 0, 10, range);
            const attachment = new AttachmentBuilder(buffer, { name: 'invites_leaderboard.png' });
            const rows = createActionRows(0, Math.ceil(sortedUsers.length / 10), range);

            const message = await interaction.editReply({ files: [attachment], components: rows });

            leaderboardMessages.set(message.id, {
                channel: message.channel,
                sortedUsers: sortedUsers,
                currentPage: 0,
                totalPages: Math.ceil(sortedUsers.length / 10),
                range: range
            });

            setupButtonCollector(message, interaction, range);
        } catch (error) {
            console.error('Error:', error);
            const buffer = await createErrorImage('Error', 'An error occurred while loading leaderboard.');
            const attachment = new AttachmentBuilder(buffer, { name: 'invites_leaderboard.png' });
            await interaction.editReply({ files: [attachment] });
        }
    },

    updateAllLeaderboards
};