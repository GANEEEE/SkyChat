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

// دالة لإنشاء صورة إحصائيات الشهرة
async function createFameStatsImage(user, userData, interaction) {
    const width = 900;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة ذهبية للشهرة
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

    // جلب الرتبة بناءً على إجمالي النقاط - التصحيح هنا
    let rank = 1;
    try {
        const rankData = await dbManager.get(
            'SELECT COUNT(*) + 1 as rank FROM fame_points WHERE total > ?',
            [userData.total || 0]
        );

        // تحقق من وجود البيانات وتحويلها لرقم
        if (rankData && rankData.rank) {
            rank = parseInt(rankData.rank);
        }
    } catch (error) {
        console.error('Error getting rank:', error);
        rank = 1; // استخدام القيمة الافتراضية في حالة الخطأ
    }

    // صورة المستخدم مع إطار دهبي
    try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));

        // رسم الإطار الذهبي الدائري أولاً
        ctx.save();
        ctx.beginPath();
        ctx.arc(80, 70, 48, 0, Math.PI * 2);
        ctx.closePath();
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.stroke();

        // قص الصورة بشكل دائري ورسمها
        ctx.beginPath();
        ctx.arc(80, 70, 46, 0, Math.PI * 2); // دائرة أصغر قليلاً للصورة
        ctx.closePath();
        ctx.clip();

        // رسم الصورة بمقاس صحيح داخل الدائرة
        ctx.drawImage(avatar, 32, 22, 96, 96);
        ctx.restore();
    } catch (error) {
        console.error('Error loading avatar:', error);
    }

    // اسم المستخدم متدرج
    const usernameGradient = ctx.createLinearGradient(150, 50, 400, 70);
    usernameGradient.addColorStop(0, '#FFD700'); // دهبي
    usernameGradient.addColorStop(0.5, '#FFA500'); // برتقالي
    usernameGradient.addColorStop(1, '#FFD700'); // دهبي

    ctx.fillStyle = usernameGradient;
    ctx.font = 'bold 42px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(user.username, 150, 80);

    // Fame Statistics تحت الاسم
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Fame Statistics', 150, 120);

    // Global Rank على اليمين فوق الخط - التصحيح هنا
    let rankColor = '#FFFFFF'; // أزرق للباقي

    if (rank === 1) {
        rankColor = '#FFD700'; // دهبي
    } else if (rank === 2) {
        rankColor = '#C0C0C0'; // فضي  
    } else if (rank === 3) {
        rankColor = '#CD7F32'; // برونزي
    }

    // التأكد من تعيين اللون
    ctx.fillStyle = rankColor;
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Global Rank: #${rank}`, width - 30, 120);

    // خط فاصل
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 135);
    ctx.lineTo(width - 30, 135);
    ctx.stroke();

    // إحصائيات الشهرة في 6 مربعات جنب بعض
    const fameStats = [
        { 
            label: 'Total', 
            value: userData.total || 0, 
            color: '#FFD700',
            emoji: '🏆'
        },
        { 
            label: 'Daily', 
            value: userData.daily || 0, 
            color: '#00FF88',
            emoji: '📢'
        },
        { 
            label: 'Special', 
            value: userData.special || 0, 
            color: '#FF6BFF',
            emoji: '✨'
        },
        { 
            label: 'VIP', 
            value: userData.vip || 0, 
            color: '#FFA500',
            emoji: '👑'
        },
        { 
            label: 'Weekly', 
            value: userData.weekly || 0, 
            color: '#4ECDC4',
            emoji: '📅'
        },
        { 
            label: 'Humbler', 
            value: userData.humbler || 0, 
            color: '#87CEEB',
            emoji: '🕊' // تغيير إلى Dove
        }
    ];

    // إعدادات الشبكة - 6 مربعات في صف واحد
    const startX = 30;
    const startY = 155; // بعد الخط مباشرة (تم التعديل من 145)
    const boxWidth = 130; // عرض المربعات
    const boxHeight = 110; // ارتفاع المربعات
    const gap = 15;
    const radius = 10; // نصف قطر الاستدارة

    // حساب المساحة الإجمالية المطلوبة
    const totalWidth = (boxWidth * 6) + (gap * 5);

    // إذا كانت المساحة أكبر من العرض المتاح، نضبط الأبعاد
    let actualBoxWidth = boxWidth;
    let actualGap = gap;

    if (totalWidth > (width - 60)) {
        // حساب الأبعاد الجديدة لتناسب العرض
        const availableWidth = width - 60;
        actualBoxWidth = (availableWidth - (gap * 5)) / 6;
    }

    for (let i = 0; i < fameStats.length; i++) {
        const stat = fameStats[i];
        const x = startX + (i * (actualBoxWidth + actualGap));

        // التأكد من أن المربعات لا تخرج من الصورة
        if (x + actualBoxWidth > width - 30) {
            break; // نتوقف إذا تجاوزنا الحد
        }

        // تأثير الظل
        ctx.fillStyle = '#00000030';
        drawRoundedRect(ctx, x + 2, startY + 2, actualBoxWidth, boxHeight, radius);
        ctx.fill();

        // خلفية المربع
        ctx.fillStyle = '#1a1a1a';
        drawRoundedRect(ctx, x, startY, actualBoxWidth, boxHeight, radius);
        ctx.fill();

        // إطار المربع
        ctx.strokeStyle = stat.color;
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, x, startY, actualBoxWidth, boxHeight, radius);
        ctx.stroke();

        // تظليل داخلي
        const innerGradient = ctx.createLinearGradient(x, startY, x, startY + boxHeight);
        innerGradient.addColorStop(0, stat.color + '20');
        innerGradient.addColorStop(1, stat.color + '05');
        ctx.fillStyle = innerGradient;
        drawRoundedRect(ctx, x + 2, startY + 2, actualBoxWidth - 4, boxHeight - 4, radius - 2);
        ctx.fill();

        // الإيموجي في الأعلى
        await drawEmoji(ctx, stat.emoji, x + actualBoxWidth/2 - 12, startY + 15, 24);

        // القيمة في المنتصف (منزلة بين الإيموجي والعنوان)
        ctx.fillStyle = stat.color;
        ctx.font = 'bold 22px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(stat.value.toString(), x + actualBoxWidth/2, startY + 70);

        // اسم الإحصائية في الأسفل
        ctx.fillStyle = '#CCCCCC';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, x + actualBoxWidth/2, startY + boxHeight - 20);
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

    // إطار أحمر
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // إيموجي الخطأ
    await drawEmoji(ctx, '❌', width / 2 - 20, 40, 40);

    // عنوان الخطأ
    ctx.fillStyle = '#FF4444';
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

// دالة جديدة لإنشاء صورة "لا توجد بيانات" باللون الذهبي
async function createNoDataImage(title, message) {
    const width = 600;
    const height = 200;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة ذهبية داكنة
    const goldGradient = ctx.createLinearGradient(0, 0, width, height);
    goldGradient.addColorStop(0, '#1a1400');
    goldGradient.addColorStop(1, '#2a2000');
    ctx.fillStyle = goldGradient;
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

    // إيموجي النجوم (بدلاً من علامة الخطأ)
    await drawEmoji(ctx, '⭐', width / 2 - 20, 40, 40);

    // العنوان باللون الذهبي
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 110);

    // رسالة النص
    ctx.fillStyle = '#FFEAA7'; // لون ذهبي فاتح للنص
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
        // جلب بيانات الشهرة من جدول fame_points
        const userData = await dbManager.get('SELECT * FROM fame_points WHERE user_id = ?', [userId]);

        if (!userData) {
            const buffer = await createNoDataImage('No Fame Points', 'You dont have any fame points yet, Start earning now!');
            const attachment = new AttachmentBuilder(buffer, { name: 'fame_nodata.png' });
            return interaction.editReply({ files: [attachment] });
        }

        const targetUser = interaction.options.getUser('user') || interaction.user;
        const buffer = await createFameStatsImage(targetUser, userData, interaction);
        const attachment = new AttachmentBuilder(buffer, { name: 'fame_stats.png' });

        await interaction.editReply({ files: [attachment] });

    } catch (error) {
        console.error('Error showing user stats:', error);
        const buffer = await createErrorImage('Error', 'An error occurred while fetching fame statistics.');
        const attachment = new AttachmentBuilder(buffer, { name: 'fame_error.png' });
        await interaction.editReply({ files: [attachment] });
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('famestats')
        .setDescription('Show your fame points statistics')
        .addUserOption(option => option
            .setName('user')
            .setDescription('The user to show stats for')
            .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply(); // عامة
        const targetUser = interaction.options.getUser('user') || interaction.user;
        await showUserStats(targetUser.id, interaction);
    },

    // تصدير الدالة للاستخدام في الملفات الأخرى
    showUserStats
};