const { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');
const twemoji = require('twemoji');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showlogchannels')
        .setDescription('Show configured log channels for the server')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Select specific channel type to show (optional)')
                .addChoices(
                    { name: 'Welcome', value: 'welcome' },
                    { name: 'Mod Commands', value: 'modcommands' },
                    { name: 'Community Commands', value: 'communitycommands' },
                    { name: 'Tweets', value: 'tweets' },
                    { name: 'Announcements', value: 'announcements' },
                    { name: 'Leave', value: 'leave' },
                    { name: 'Counted Channels', value: 'counted' },
                    { name: 'Giveaway Auto Channels', value: 'giveaway_auto' }
                )
                .setRequired(false)),

    async execute(interaction, client) {
        await interaction.deferReply({ ephemeral: false });

        const channelType = interaction.options.getString('type') || 'all';

        try {
            // إذا كان النوع counted أو giveaway_auto، استخدم الإيمبد
            if (channelType === 'counted' || channelType === 'giveaway_auto') {
                await showChannelsEmbed(interaction, channelType);
            } else {
                // وإلا استخدم الصورة كالمعتاد
                const buffer = await createChannelsImage(interaction, channelType);
                const attachment = new AttachmentBuilder(buffer, { name: `logchannels.png` });
                await interaction.editReply({ files: [attachment] });
            }

        } catch (error) {
            console.error('Error showing log channels:', error);

            if (channelType === 'counted' || channelType === 'giveaway_auto') {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#FF4444')
                    .setTitle('❌ Error')
                    .setDescription('An error occurred while fetching channels data.')
                    .setTimestamp();
                await interaction.editReply({ embeds: [errorEmbed] });
            } else {
                const buffer = await createErrorImage('❌ Error', 'An error occurred while fetching log channels.');
                const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
                await interaction.editReply({ files: [attachment] });
            }
        }
    }
};

// دالة لعرض القنوات في إيمبد
async function showChannelsEmbed(interaction, channelType) {
    let channels;
    let title;
    let description;
    let emoji;

    if (channelType === 'counted') {
        channels = await dbManager.getCountedChannels(interaction.guild.id);
        title = '<:Book:1433497871445000192> Counted Channels';
        description = 'Channels included in message counting:';
        emoji = '<:Infobg:1412839140407378062>';
    } else if (channelType === 'giveaway_auto') {
        channels = await dbManager.getGiveawayAutoChannels(interaction.guild.id);
        title = '<:Book:1433497871445000192> Auto Giveaway Channels';
        description = 'Channels included in auto giveaway role:';
        emoji = '<:Infobg:1412839140407378062>';
    }

    const embed = new EmbedBuilder()
        .setColor(channelType === 'counted' ? '#0073ff' : '#0073ff')
        .setTitle(title)
        .setDescription(description)

    if (channels.length === 0) {
        embed.addFields({
            name: `${emoji} No Channels`,
            value: `No channels have been configured for ${channelType === 'counted' ? 'message counting' : 'auto giveaway role'}.`,
            inline: false
        });
    } else {
        // تجميع القنوات في حقل واحد - التعديل هنا
        const channelList = channels.map((channel, index) => {
            const discordChannel = interaction.guild.channels.cache.get(channel.channel_id);
            const channelMention = discordChannel ? discordChannel.toString() : `#${channel.channel_name}`;

            // استخدم العمود المناسب حسب نوع القناة
            let setBy;
            if (channelType === 'counted') {
                setBy = channel.added_by ? `<@${channel.added_by}>` : 'Unknown';
            } else if (channelType === 'giveaway_auto') {
                setBy = channel.set_by ? `<@${channel.set_by}>` : 'Unknown';
            }

            return `[${index + 1}] ${channelMention} - Set by ${setBy}`;
        }).join('\n');

        embed.addFields({
            name: `${emoji} Configured Channels (${channels.length})`,
            value: channelList,
            inline: false
        });

        // إضافة معلومات إضافية
        embed.addFields({
            name: '<:Lamp:1433497875505090764> How it works',
            value: channelType === 'counted' 
                ? 'Messages sent in these channels will be counted for statistics.'
                : 'Automatically get the giveaway role for 7 Days.',
            inline: false
        });
    }

    await interaction.editReply({ embeds: [embed] });
}

// تحسين دالة تحميل الإيموجي مع caching
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
        // استخدام بديل نصي إذا فشل تحميل الصورة
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${size}px Arial`;
        ctx.fillText(emoji, x, y + size);
    }
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

// إعدادات القنوات المركزية
const CHANNEL_CONFIGS = {
    welcome: { emoji: '👋', title: 'Welcome', color: '#00FF88' },
    modcommands: { emoji: '🔧', title: 'Mod Commands', color: '#4ECDC4' },
    communitycommands: { emoji: '💬', title: 'Community', color: '#45B7D1' },
    tweets: { emoji: '🐦', title: 'Tweets', color: '#1DA1F2' },
    announcements: { emoji: '📢', title: 'Announcements', color: '#FFD700' },
    leave: { emoji: '🚪', title: 'Leave', color: '#FF6B6B' }
};

// دالة مساعدة لرسم الخلفية
function drawBackground(ctx, width, height) {
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#101010');
    bgGradient.addColorStop(0.5, '#101010');
    bgGradient.addColorStop(1, '#101010');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج أزرق للشهرة - على الجانبين فقط
    const borderPadding = 0;
    ctx.strokeStyle = '#0073ff';
    ctx.lineWidth = 5;

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    // الجانب الأيمن
    ctx.moveTo(width - borderPadding, borderPadding);
    ctx.lineTo(width - borderPadding, height - borderPadding);
    ctx.stroke();
}

// دالة لرسم قناة مفردة
async function drawSingleChannel(ctx, width, height, channelConfig, channelData, guild) {
    const discordChannel = channelData ? guild.channels.cache.get(channelData.channel_id) : null;

    // خلفية المربع الرئيسي مع تأثير ظل
    ctx.fillStyle = '#101010';
    ctx.fillRect(100, 100, width - 200, 200);

    // إطار متدرج حسب الحالة
    const borderGradient = ctx.createLinearGradient(100, 100, width - 100, 300);
    if (discordChannel) {
        borderGradient.addColorStop(0, '#00FF88');
        borderGradient.addColorStop(1, '#00AA55');
    } else if (channelData) {
        borderGradient.addColorStop(0, '#FF4444');
        borderGradient.addColorStop(1, '#AA0000');
    } else {
        borderGradient.addColorStop(0, '#FFA500');
        borderGradient.addColorStop(1, '#CC8400');
    }

    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = 4;
    ctx.strokeRect(100, 100, width - 200, 200);

    // الإيموجي في المركز
    await drawEmoji(ctx, channelConfig.emoji, width / 2 - 30, 120, 60);

    // العنوان
    ctx.fillStyle = channelConfig.color;
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(channelConfig.title, width / 2, 220);

    // حالة القناة
    let statusText, statusColor;
    if (discordChannel) {
        statusText = '✅ Online';
        statusColor = '#00FF88';
    } else if (channelData) {
        statusText = '❌ Offline';
        statusColor = '#FF4444';
    } else {
        statusText = '⚠️ Not Set';
        statusColor = '#FFA500';
    }

    ctx.fillStyle = statusColor;
    ctx.font = 'bold 20px Arial';
    ctx.fillText(statusText, width / 2, 260);

    // معلومات القناة
    if (discordChannel) {
        ctx.fillStyle = '#CCCCCC';
        ctx.font = '20px Arial';
        ctx.fillText(`#${discordChannel.name}`, width / 2, 300);
    } else if (channelData) {
        ctx.fillStyle = '#FF8888';
        ctx.font = '18px Arial';
        ctx.fillText('Channel not found in server', width / 2, 300);
    }
}

// دالة لرسم جميع القنوات
async function drawAllChannels(ctx, width, height, logChannels, guild) {
    const startX = 50;
    const startY = 80;
    const boxWidth = 220;
    const boxHeight = 120; // زيادة الارتفاع لتوسيط المحتوى
    const gap = 25;
    const radius = 12;

    let row = 0;
    let col = 0;

    for (const [channelKey, channelConfig] of Object.entries(CHANNEL_CONFIGS)) {
        const channelData = logChannels.find(ch => ch.channel_type === channelKey);
        const x = startX + (col * (boxWidth + gap));
        const y = startY + (row * (boxHeight + gap));

        // تأثير الظل
        ctx.fillStyle = '#00000030';
        drawRoundedRect(ctx, x + 2, y + 2, boxWidth, boxHeight, radius);
        ctx.fill();

        // خلفية المربع
        ctx.fillStyle = '#1a1a1a';
        drawRoundedRect(ctx, x, y, boxWidth, boxHeight, radius);
        ctx.fill();

        // تحديد لون الإطار حسب الحالة
        let borderColor;
        let statusText;
        if (channelData) {
            const discordChannel = guild.channels.cache.get(channelData.channel_id);
            borderColor = discordChannel ? '#00FF88' : '#FF4444';
            statusText = discordChannel ? 'Online' : 'Offline';
        } else {
            borderColor = '#FFA500';
            statusText = 'Not Set';
        }

        // إطار المربع
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, x, y, boxWidth, boxHeight, radius);
        ctx.stroke();

        // تظليل داخلي بلون القناة
        const innerGradient = ctx.createLinearGradient(x, y, x, y + boxHeight);
        innerGradient.addColorStop(0, channelConfig.color + '20');
        innerGradient.addColorStop(1, channelConfig.color + '05');
        ctx.fillStyle = innerGradient;
        drawRoundedRect(ctx, x + 2, y + 2, boxWidth - 4, boxHeight - 4, radius - 2);
        ctx.fill();

        // الإيموجي في المنتصف العلوي
        await drawEmoji(ctx, channelConfig.emoji, x + (boxWidth / 2) - 12, y + 20, 24);

        // عنوان القناة - في المنتصف تحت الإيموجي
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(channelConfig.title, x + boxWidth / 2, y + 60);

        // حالة القناة تحت العنوان
        ctx.fillStyle = borderColor;
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(statusText, x + boxWidth / 2, y + 80);

        // اسم القناة في الأسفل
        ctx.fillStyle = channelConfig.color;
        ctx.font = '18px Arial';
        ctx.textAlign = 'center';

        let channelInfo = 'Not configured';
        if (channelData) {
            const discordChannel = guild.channels.cache.get(channelData.channel_id);
            channelInfo = discordChannel ? `#${discordChannel.name}` : 'Channel not found';
        }

        // تقصير النص الطويل
        if (channelInfo.length > 25) {
            channelInfo = channelInfo.substring(0, 25) + '...';
        }

        ctx.fillText(channelInfo, x + boxWidth / 2, y + 100);

        col++;
        if (col >= 3) { // 3 مربعات في كل صف
            col = 0;
            row++;
        }
    }
}

// الدالة الرئيسية لإنشاء صورة القنوات
async function createChannelsImage(interaction, channelType) {
    const width = 800;
    const height = 400; // العودة إلى 400
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // رسم الخلفية
    drawBackground(ctx, width, height);

    // جلب بيانات القنوات
    const logChannels = await dbManager.all('SELECT * FROM log_channels WHERE guild_id = ?', [interaction.guild.id]);

    // العنوان الرئيسي
    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Log Channels', width / 2, 50);

    // عرض حسب النوع المحدد
    if (channelType !== 'all') {
        const channelConfig = CHANNEL_CONFIGS[channelType];
        const channelData = logChannels.find(ch => ch.channel_type === channelType);
        await drawSingleChannel(ctx, width, height, channelConfig, channelData, interaction.guild);
    } else {
        await drawAllChannels(ctx, width, height, logChannels, interaction.guild);
    }

    return canvas.toBuffer('image/png');
}

// دالة إنشاء صورة الخطأ (محسنة)
async function createErrorImage(title, message) {
    const width = 600;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة للخطأ
    const errorGradient = ctx.createLinearGradient(0, 0, width, height);
    errorGradient.addColorStop(0, '#1a0f0f');
    errorGradient.addColorStop(1, '#2a1a1a');
    ctx.fillStyle = errorGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار أحمر
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // عنوان الخطأ
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 80);

    // رسالة الخطأ
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '18px Arial';

    const words = message.split(' ');
    let line = '';
    let y = 140;
    const maxWidth = width - 100;

    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && line !== '') {
            ctx.fillText(line, width / 2, y);
            line = word + ' ';
            y += 30;
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, width / 2, y);

    return canvas.toBuffer('image/png');
}