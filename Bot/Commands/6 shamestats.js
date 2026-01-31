const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');
const twemoji = require('twemoji');

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

// دالة لإنشاء صورة إحصائيات العار
async function createShameStatsImage(user, userData, interaction) {
    const width = 900;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة حمراء للعار
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

    // جلب الرتبة بناءً على إجمالي النقاط
    const rankData = await dbManager.get(
        'SELECT COUNT(*) + 1 as rank FROM shame_points WHERE total > ?',
        [userData.total || 0]
    );
    const rank = rankData.rank;

    // صورة المستخدم مع إطار أحمر
    try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));

        // رسم الإطار الأحمر الدائري أولاً
        ctx.save();
        ctx.beginPath();
        ctx.arc(80, 70, 48, 0, Math.PI * 2);
        ctx.closePath();
        ctx.strokeStyle = '#8B0000';
        ctx.lineWidth = 4;
        ctx.stroke();

        // قص الصورة بشكل دائري ورسمها
        ctx.beginPath();
        ctx.arc(80, 70, 46, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // رسم الصورة بمقاس صحيح داخل الدائرة
        ctx.drawImage(avatar, 32, 22, 96, 96);
        ctx.restore();
    } catch (error) {
        console.error('Error loading avatar:', error);
    }

    // اسم المستخدم
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(user.username, 150, 60);

    // Shame Statistics تحت الاسم
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Shame Statistics', 150, 120);

    // Global Rank على اليمين فوق الخط
    let rankColor = '#8B0000'; // أحمر داكن للباقي

    if (rank === 1) {
        rankColor = '#8B0000'; // أحمر داكن
    } else if (rank === 2) {
        rankColor = '#B22222'; // أحمر ناري  
    } else if (rank === 3) {
        rankColor = '#DC143C'; // قرمزي
    }

    ctx.fillStyle = rankColor;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Global Rank: #${rank}`, width - 30, 120);

    // خط فاصل
    ctx.strokeStyle = '#8B0000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 135);
    ctx.lineTo(width - 30, 135);
    ctx.stroke();

    // إحصائيات العار في 3 مربعات جنب بعض
    const shameStats = [
        { 
            label: 'Total Points', 
            value: userData.total || 0, 
            color: '#8B0000',
            emoji: '🥀'
        },
        { 
            label: 'Giveaway Bans', 
            value: userData.giveaway_ban || 0, 
            color: '#FF4444',
            emoji: '🚫'
        },
        { 
            label: 'Warnings', 
            value: userData.warns || 0, 
            color: '#FF6B6B',
            emoji: '⚠'
        }
    ];

    // إعدادات الشبكة - 3 مربعات في صف واحد
    const startX = 30;
    const startY = 150;
    const boxWidth = 270; // عرض المربعات (3 مربعات في 900px)
    const boxHeight = 110;
    const gap = 15;
    const radius = 12; // نصف قطر الاستدارة

    for (let i = 0; i < shameStats.length; i++) {
        const stat = shameStats[i];
        const x = startX + (i * (boxWidth + gap));

        // التأكد من أن المربعات لا تخرج من الصورة
        if (x + boxWidth > width - 30) {
            break;
        }

        // تأثير الظل
        ctx.fillStyle = '#00000030';
        drawRoundedRect(ctx, x + 2, startY + 2, boxWidth, boxHeight, radius);
        ctx.fill();

        // خلفية المربع
        ctx.fillStyle = '#1a1a1a';
        drawRoundedRect(ctx, x, startY, boxWidth, boxHeight, radius);
        ctx.fill();

        // إطار المربع
        ctx.strokeStyle = stat.color;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, x, startY, boxWidth, boxHeight, radius);
        ctx.stroke();

        // تظليل داخلي
        const innerGradient = ctx.createLinearGradient(x, startY, x, startY + boxHeight);
        innerGradient.addColorStop(0, stat.color + '20');
        innerGradient.addColorStop(1, stat.color + '05');
        ctx.fillStyle = innerGradient;
        drawRoundedRect(ctx, x + 2, startY + 2, boxWidth - 4, boxHeight - 4, radius - 2);
        ctx.fill();

        // الإيموجي في الأعلى
        await drawEmoji(ctx, stat.emoji, x + boxWidth/2 - 12, startY + 15, 24);

        // القيمة في المنتصف
        ctx.fillStyle = stat.color;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(stat.value.toString(), x + boxWidth/2, startY + 70);

        // اسم الإحصائية في الأسفل
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, x + boxWidth/2, startY + boxHeight - 20);
    }

    return canvas.toBuffer('image/png');
}

// دالة لإنشاء صورة الخطأ
async function createErrorImage(title, message) {
    const width = 600;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة للخطأ
    const errorGradient = ctx.createLinearGradient(0, 0, width, height);
    errorGradient.addColorStop(0, '#1a0f0f');
    errorGradient.addColorStop(1, '#2a1a1a');
    ctx.fillStyle = errorGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 4; // المسافة من الحواف
    ctx.strokeStyle = '#8B0000'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // إيموجي الخطأ
    await drawEmoji(ctx, '❌', width / 2 - 20, 40, 40);

    // عنوان الخطأ
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 100);

    // رسالة الخطأ
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

// دالة جديدة لإنشاء صورة السجل النظيف
async function createCleanRecordImage(title, message) {
    const width = 600;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة خضراء للسجل النظيف
    const successGradient = ctx.createLinearGradient(0, 0, width, height);
    successGradient.addColorStop(0, '#0f1a0f');
    successGradient.addColorStop(1, '#1a2a1a');
    ctx.fillStyle = successGradient;
    ctx.fillRect(0, 0, width, height);
    
    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 4; // المسافة من الحواف
    ctx.strokeStyle = '#228B22'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // إيموجي الصح الأخضر
    await drawEmoji(ctx, '✅', width / 2 - 20, 40, 40);

    // عنوان النجاح
    ctx.fillStyle = '#32CD32';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 110);

    // رسالة النجاح
    ctx.fillStyle = '#CCFFCC';
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

// عرض إحصائيات اللاعب
async function showUserStats(userId, interaction) {
    try {
        // جلب بيانات العار من جدول shame_points
        const userData = await dbManager.get('SELECT * FROM shame_points WHERE user_id = ?', [userId]);

        if (!userData) {
            const buffer = await createCleanRecordImage('Clean Record', 'You dont have any shame points, Keep it up!');
            const attachment = new AttachmentBuilder(buffer, { name: 'shame_clean.png' });
            return interaction.editReply({ files: [attachment] });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const buffer = await createShameStatsImage(targetUser, userData, interaction);
        const attachment = new AttachmentBuilder(buffer, { name: 'shame_stats.png' });

        await interaction.editReply({ files: [attachment] });

    } catch (error) {
        console.error('Error showing user stats:', error);
        const buffer = await createErrorImage('Error', 'An error occurred while fetching shame statistics.');
        const attachment = new AttachmentBuilder(buffer, { name: 'shame_error.png' });
        await interaction.editReply({ files: [attachment] });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shamestats')
        .setDescription('Show your shame points statistics')
        .addUserOption(option => option
            .setName('user')
            .setDescription('The user to show stats for')
            .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply();
        const targetUser = interaction.options.getUser('user') || interaction.user;
        await showUserStats(targetUser.id, interaction);
    },

    // تصدير الدالة للاستخدام في الملفات الأخرى
    showUserStats
};