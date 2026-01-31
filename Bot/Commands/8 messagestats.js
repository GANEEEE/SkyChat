const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const dbManager = require('../Data/database');

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

// دالة لإنشاء تدرج لوني
function createGradient(ctx, x, y, width, height, colorStops) {
    const gradient = ctx.createLinearGradient(x, y, x, y + height);
    colorStops.forEach(stop => {
        gradient.addColorStop(stop.position, stop.color);
    });
    return gradient;
}

// دالة جديدة لجلب كل المستخدمين بدون pagination (مثل messagesleaderboard)
async function loadAllUsersForSearch(period = 'total') {
    try {
        // جلب عدد كبير جداً من المستخدمين للتأكد من وجود الجميع
        const result = await dbManager.getMessageLeaderboard(period, 0, 1000);
        return result.users || [];
    } catch (error) {
        console.error('Error loading all users for search:', error);
        return [];
    }
}

// دالة لإنشاء صورة الإحصائيات
async function createUserStatsImage(user, interaction) {
    const width = 900;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#101010');
    bgGradient.addColorStop(1, '#101010');
    ctx.fillStyle = bgGradient;
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

    // جلب البيانات - باستخدام الدالة الجديدة
    const [dailyData, weeklyData, monthlyData, totalData, allUsers] = await Promise.all([
        dbManager.getUserMessageStats(user.id, 'daily'),
        dbManager.getUserMessageStats(user.id, 'weekly'),
        dbManager.getUserMessageStats(user.id, 'monthly'),
        dbManager.getUserMessageStats(user.id, 'total'),
        loadAllUsersForSearch('total') // استخدام الدالة الجديدة
    ]);

    // حساب الترتيب العالمي بنفس طريقة messagesstats القديم
    const userTotalMessages = totalData?.total || totalData?.sent || 0;
    let globalRank = 1;

    // حساب الترتيب بناء على الرسائل الإجمالية
    for (const otherUser of allUsers) {
        const otherUserTotal = otherUser.total || otherUser.sent || 0;
        if (otherUserTotal > userTotalMessages) {
            globalRank++;
        }
    }

    // التحقق من الرتب حسب الشروط الجديدة
    const hasTopTalker = globalRank <= 10; // أول 10
    const hasEliteTalker = globalRank <= 5; // أول 5

    // صورة المستخدم مع إطار
    try {
        const avatar = await loadImage(user.displayAvatarURL({ extension: 'png', size: 128 }));

        // رسم الإطار الدائري أولاً
        ctx.save();
        ctx.beginPath();
        ctx.arc(80, 70, 52, 0, Math.PI * 2); // دائرة أكبر قليلاً للإطار
        ctx.closePath();
        ctx.strokeStyle = '#0073ff'; // لون الإطار
        ctx.lineWidth = 4; // سمك الإطار
        ctx.stroke();

        // قص الصورة بشكل دائري
        ctx.beginPath();
        ctx.arc(80, 70, 48, 0, Math.PI * 2); // دائرة أصغر للصورة
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, 32, 22, 96, 96); // تعديل الموقع ليناسب الدائرة الجديدة
        ctx.restore();
    } catch (error) {
        console.error('Error loading avatar:', error);
    }

    // اسم المستخدم متدرج
    const usernameGradient = ctx.createLinearGradient(150, 50, 500, 70);
    usernameGradient.addColorStop(0, '#0073ff');   // أزرق
    usernameGradient.addColorStop(0.5, '#00a8ff'); // أزرق فاتح
    usernameGradient.addColorStop(1, '#0073ff');   // أزرق

    ctx.fillStyle = usernameGradient;
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(user.username, 150, 75);

    // Message Statistics تحت الاسم
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Message Statistics', 150, 120);

    // Elite Talker (أول 5) - على اليمين
    if (hasEliteTalker) {
        try {
            // تحميل صورة من رابط - ضع الرابط هنا
            const eliteImage = await loadImage('https://i.ibb.co/r2SnB5qF/Elite-Talker.png');

            // تدرج أحمر وبنفسجي للنص
            const eliteGradient = ctx.createLinearGradient(width - 200, 40, width - 20, 70);
            eliteGradient.addColorStop(0, '#FF0000'); // أحمر
            eliteGradient.addColorStop(1, '#8A2BE2'); // بنفسجي

            ctx.fillStyle = eliteGradient;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'right';

            // حساب المساحة الكلية للنص والصورة
            const text = 'Elite Talker';
            const textWidth = ctx.measureText(text).width;
            const totalWidth = 30 + 40 + textWidth; // 30 للصورة + 10 فراغ + عرض النص

            // رسم الصورة أولاً
            ctx.drawImage(eliteImage, width - totalWidth, 25, 30, 30);

            // ثم رسم النص
            ctx.fillText(text, width - 30, 50);

        } catch (error) {
            console.error('Error loading elite image:', error);
            // بديل إذا فشل تحميل الصورة
            const eliteGradient = ctx.createLinearGradient(width - 200, 40, width - 20, 70);
            eliteGradient.addColorStop(0, '#FF0000');
            eliteGradient.addColorStop(1, '#8A2BE2');
            ctx.fillStyle = eliteGradient;
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('🏆 Elite Talker', width - 30, 50);
        }
    }

    // Top Talker (أول 10) - تحت Elite Talker
    if (hasTopTalker) {
        try {
            // تحميل صورة من رابط - ضع الرابط هنا
            const topImage = await loadImage('https://i.ibb.co/1Jz8B0G1/Chat.png');

            // تدرج ذهبي للنص
            const topGradient = ctx.createLinearGradient(width - 200, 70, width - 20, 80);
            topGradient.addColorStop(0, '#FFD700'); // ذهبي فاتح
            topGradient.addColorStop(1, '#FFA500'); // ذهبي غامق

            ctx.fillStyle = topGradient;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'right';

            // حساب المساحة الكلية للنص والصورة
            const text = 'Top Talker';
            const textWidth = ctx.measureText(text).width;
            const totalWidth = 25 + 35 + textWidth; // 25 للصورة + 8 فراغ + عرض النص

            // رسم الصورة أولاً
            ctx.drawImage(topImage, width - totalWidth, 65, 25, 25);

            // ثم رسم النص
            ctx.fillText(text, width - 30, 85);

        } catch (error) {
            console.error('Error loading top image:', error);
            // بديل إذا فشل تحميل الصورة
            const topGradient = ctx.createLinearGradient(width - 200, 70, width - 20, 80);
            topGradient.addColorStop(0, '#FFD700');
            topGradient.addColorStop(1, '#FFA500');
            ctx.fillStyle = topGradient;
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'right';
            ctx.fillText('👑 Top Talker', width - 30, 85);
        }
    }

    // Global Rank تحت Top Talker - بنفس نظام الألوان الجديد
    let rankColor = '#0073ff'; // لون افتراضي للباقي

    // أول 5: تدرج لوني من الأحمر للأزرق
    if (globalRank <= 5) {
        const gradient = createGradient(ctx, width - 150, 100, 0, 25, [
            { position: 0, color: '#ff0007' },   // أحمر من فوق
            { position: 1, color: '#5600ff' }    // أزرق من تحت
        ]);
        rankColor = gradient;
    } 
    // المراكز 6-10: دهبي
    else if (globalRank <= 10) {
        rankColor = '#FFD700'; // دهبي
    }
    // الباقي: أزرق
    else {
        rankColor = '#0073ff'; // أزرق
    }

    // النص الأبيض + الرقم الملون
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('Global Rank: ', width - 30 - ctx.measureText(`#${globalRank}`).width, 120);

    ctx.fillStyle = rankColor;
    ctx.fillText(`#${globalRank}`, width - 30, 120);

    // خط فاصل
    ctx.strokeStyle = '#0073ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 135);
    ctx.lineTo(width - 30, 135);
    ctx.stroke();

    // الإحصائيات في مربعات جنب بعض
    const stats = [
        { label: 'Daily', value: dailyData?.sent || 0, color: '#00FF88' },
        { label: 'Weekly', value: weeklyData?.sent || 0, color: '#4ECDC4' },
        { label: 'Monthly', value: monthlyData?.sent || 0, color: '#45B7D1' },
        { label: 'All Time', value: totalData?.sent || 0, color: '#0073ff' }
    ];

    // حساب أبعاد المربعات علشان تكون متساوية وجنب بعض
    const totalGap = 70;
    const availableWidth = width - 60 - totalGap;
    const boxWidth = availableWidth / 4;
    const boxHeight = 120;
    const startX = 30;
    const y = 150;
    const radius = 12; // نصف قطر الاستدارة

    let x = startX;

    for (let i = 0; i < 4; i++) {
        const stat = stats[i];
        const currentX = x + (i * (boxWidth + (totalGap / 3)));

        // تأثير الظل
        ctx.fillStyle = '#00000030';
        drawRoundedRect(ctx, currentX + 2, y + 2, boxWidth, boxHeight, radius);
        ctx.fill();

        // خلفية المربع
        ctx.fillStyle = '#1a1a1a';
        drawRoundedRect(ctx, currentX, y, boxWidth, boxHeight, radius);
        ctx.fill();

        // إطار المربع
        ctx.strokeStyle = stat.color;
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, currentX, y, boxWidth, boxHeight, radius);
        ctx.stroke();

        // تظليل داخلي
        const innerGradient = ctx.createLinearGradient(currentX, y, currentX, y + boxHeight);
        innerGradient.addColorStop(0, stat.color + '20');
        innerGradient.addColorStop(1, stat.color + '05');
        ctx.fillStyle = innerGradient;
        drawRoundedRect(ctx, currentX + 2, y + 2, boxWidth - 4, boxHeight - 4, radius - 2);
        ctx.fill();

        // العنوان - متوسطن
        ctx.fillStyle = '#CCCCCC';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(stat.label, currentX + boxWidth / 2, y + 30);

        // القيمة - متوسطن
        ctx.fillStyle = stat.color;
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(stat.value.toString(), currentX + boxWidth / 2, y + boxHeight / 2 + 10);

        // كلمة "Messages" تحت القيمة - متوسطن
        ctx.fillStyle = '#888888';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Messages', currentX + boxWidth / 2, y + boxHeight - 20);
    }

    return canvas.toBuffer('image/png');
}

// بناء الأمر
const data = new SlashCommandBuilder()
    .setName('messages')
    .setDescription('Display member Message Statistics for all time periods.')
    .addUserOption(option => option
        .setName('user')
        .setDescription('The member to display their message statistics.')
        .setRequired(false));

// معالجة الأمر
async function execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    const targetUser = interaction.options.getUser('user') || interaction.user;

    try {
        const buffer = await createUserStatsImage(targetUser, interaction);
        const attachment = new AttachmentBuilder(buffer, { name: 'messages_stats.png' });

        await interaction.editReply({ files: [attachment] });
    } catch (error) {
        console.error('Error creating stats image:', error);
        await interaction.editReply('❌ An error occurred while generating statistics image.');
    }
}

// التصدير
module.exports = {
    data,
    execute
};