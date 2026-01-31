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

// دالة لرسم Progress bar
function drawProgressBar(ctx, x, y, width, height, radius, progress, color, text = '') {
    // الخلفية
    ctx.fillStyle = '#2a2a2a';
    drawRoundedRect(ctx, x, y, width, height, radius);
    ctx.fill();

    // التقدم
    if (progress > 0) {
        const progressWidth = Math.max(10, (width - 4) * progress);
        ctx.fillStyle = color;
        drawRoundedRect(ctx, x + 2, y + 2, progressWidth, height - 4, radius - 2);
        ctx.fill();
    }

    // النص في منتصف الـ Progress bar
    if (text) {
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // تأثير ظل للنص
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        ctx.fillText(text, x + width / 2, y + height / 2);

        // إعادة ضبط الظل
        ctx.shadowColor = 'transparent';
    }
}

// دالة لتحديد ال Role وال Progress بناءً على الـ verified invites والرولز الحالية
function getUserProgress(verifiedCount, member) {
    const roles = [
        { name: 'Gamer 1', required: 5, color: '#32cd32', badgeUrl: 'https://i.ibb.co/kV3J0Hc8/gamer-1.png', roleId: process.env.GAMER1 },
        { name: 'Gamer 2', required: 15, color: '#1e90ff', badgeUrl: 'https://i.ibb.co/tpZdgKR6/gamer-3.png', roleId: process.env.GAMER2 },
        { name: 'Gamer 3', required: 30, color: '#8f30b8', badgeUrl: 'https://i.ibb.co/YBmJgprx/gamer-2.png', roleId: process.env.GAMER3 },
        { name: 'Gamer 4', required: 50, color: '#ffd900', badgeUrl: 'https://i.ibb.co/LXC3v5WC/gamer-4.png', roleId: process.env.GAMER4 }
    ];

    let currentRole = { name: 'Beginner', color: '#cccccc', badgeUrl: null };
    let nextRole = roles[0];
    let progress = 0;
    let achievedRoles = [];

    // تحديد أعلى رتبة معاها اليوزر
    let highestAchievedRole = null;

    // نفحص من أعلى رتبة لأقل عشان نلاقي أعلى رتبة معاها اليوزر
    for (let i = roles.length - 1; i >= 0; i--) {
        if (member.roles.cache.has(roles[i].roleId)) {
            highestAchievedRole = roles[i];
            break;
        }
    }

    // إذا اليوزر معاه أي رتبة، نعتمد عليها بدل الـ verified count
    if (highestAchievedRole) {
        currentRole = highestAchievedRole;

        // نحدد الرتبة التالية (إذا كانت موجودة)
        const currentIndex = roles.findIndex(role => role.name === highestAchievedRole.name);
        nextRole = roles[currentIndex + 1] || null;

        // نحسب الـ progress بناءً على الرتبة الحالية والرتبة التالية
        if (nextRole) {
            // هنا الفرق: بنحسب من صفر للرتبة التالية مش من الرتبة الحالية
            progress = verifiedCount / nextRole.required;
        } else {
            progress = 1; // وصل لأعلى رتبة
        }

        // نضيف كل الرتب اللي أقل أو تساوي الرتبة الحالية للإنجازات
        achievedRoles = roles.filter(role => role.required <= highestAchievedRole.required);
    } else {
        // إذا مفيش رتبة، نستخدم النظام القديم
        for (let i = 0; i < roles.length; i++) {
            if (verifiedCount >= roles[i].required) {
                achievedRoles.push(roles[i]);
                currentRole = roles[i];
                nextRole = roles[i + 1] || null;
            } else {
                nextRole = roles[i];
                break;
            }
        }

        if (nextRole) {
            // هنا كمان بنحسب من صفر للرتبة التالية
            progress = verifiedCount / nextRole.required;
        } else {
            progress = 1;
        }
    }

    return {
        currentRole,
        achievedRoles,
        nextRole: nextRole?.name || null,
        progress: Math.min(1, Math.max(0, progress)),
        nextRoleColor: nextRole?.color || '#0073ff',
        requiredForNext: nextRole?.required || verifiedCount,
        isMaxLevel: !nextRole
    };
}

// دالة جديدة لتحديد الشارات اللي تظهر بناءً على الرولز
function getAchievedBadges(member) {
    const roleBadges = [
        { roleId: process.env.GAMER1, badgeUrl: 'https://i.ibb.co/kV3J0Hc8/gamer-1.png' },
        { roleId: process.env.GAMER2, badgeUrl: 'https://i.ibb.co/tpZdgKR6/gamer-3.png' },
        { roleId: process.env.GAMER3, badgeUrl: 'https://i.ibb.co/YBmJgprx/gamer-2.png' },
        { roleId: process.env.GAMER4, badgeUrl: 'https://i.ibb.co/LXC3v5WC/gamer-4.png' }
    ];

    const achievedBadges = [];

    for (const roleBadge of roleBadges) {
        if (member.roles.cache.has(roleBadge.roleId)) {
            achievedBadges.push(roleBadge);
        }
    }

    return achievedBadges;
}

// دالة لتحميل صورة الشارة مع معالجة الأخطاء
async function loadBadgeImage(badgeUrl) {
    if (!badgeUrl) return null;

    try {
        const image = await loadImage(badgeUrl);
        return image;
    } catch (error) {
        console.error('Error loading badge image:', error);
        return null;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('Show your invites or someone else invites')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to check invites for')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user') || interaction.user;

        try {
            // جيب الـ member object عشان تقدر تشيك على الرولز للشارات
            const member = interaction.guild.members.cache.get(targetUser.id) || 
                           await interaction.guild.members.fetch(targetUser.id);

            if (!member) {
                return interaction.reply({
                    content: `Cannot find member ${targetUser.username} in this server.`,
                    ephemeral: true
                });
            }

            const userData = await dbManager.get(
                'SELECT * FROM invites WHERE user_id = ?',
                [targetUser.id]
            );

            if (!userData) {
                return interaction.reply({
                    content: `No invite data found for user ${targetUser.username}.`,
                    ephemeral: true
                });
            }

            const verifiedCount = userData.verified || 0;

            // نظام الـ progress bar بناءً على الـ verified invites والرولز الحالية
            const userProgress = getUserProgress(verifiedCount, member);

            // الشارات بناءً على الرولز اللي معاه
            const achievedBadges = getAchievedBadges(member);

            const width = 900;
            const height = 300;
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // الخلفية الرئيسية مع Gradient
            const bgGradient = ctx.createLinearGradient(0, 0, width, 0);
            bgGradient.addColorStop(0, '#101010');
            bgGradient.addColorStop(0.25, '#101010');
            bgGradient.addColorStop(0.25, '#101010');
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

            // دائرة الصورة
            const avatarRadius = 95;
            const avatarX = 150;
            const avatarY = height / 2;

            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 10;
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
            ctx.fillStyle = '#0f0f0f';
            ctx.fill();
            ctx.restore();

            // إطار الصورة
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#0073ff';
            ctx.stroke();

            // تحميل الصورة داخل الدائرة
            try {
                const avatar = await loadImage(targetUser.displayAvatarURL({ extension: 'png', size: 512 }));
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX, avatarY, avatarRadius - 4, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, avatarX - avatarRadius + 4, avatarY - avatarRadius + 4, (avatarRadius - 4) * 2, (avatarRadius - 4) * 2);
                ctx.restore();
            } catch (error) {
                console.error('Error loading avatar:', error);
            }

            // اسم المستخدم
            ctx.font = 'bold 52px Arial';
            const usernameGradient = ctx.createLinearGradient(280, 50, 500, 50);
            usernameGradient.addColorStop(0, '#0073ff');
            usernameGradient.addColorStop(1, '#004599');
            ctx.fillStyle = usernameGradient;

            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            ctx.textAlign = 'left';
            ctx.fillText(targetUser.username, 280, 75);

            // عرض جميع الشارات المحققة جنب بعض (بناءً على الرولز)
            const badgeSize = 35;
            const badgeStartX = 280;
            const badgeY = 90;
            const badgeGap = 10;

            let currentBadgeX = badgeStartX;

            for (let i = 0; i < achievedBadges.length; i++) {
                const badge = achievedBadges[i];
                const badgeImage = await loadBadgeImage(badge.badgeUrl);

                if (badgeImage) {
                    // خلفية الشارة
                    ctx.save();
                    ctx.shadowColor = 'rgba(0,0,0,0.5)';
                    ctx.shadowBlur = 5;
                    ctx.shadowOffsetX = 0;
                    ctx.shadowOffsetY = 3;

                    // رسم الشارة
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(currentBadgeX + badgeSize/2, badgeY + badgeSize/2, badgeSize/2, 0, Math.PI * 2);
                    ctx.closePath();
                    ctx.clip();
                    ctx.drawImage(badgeImage, currentBadgeX, badgeY, badgeSize, badgeSize);
                    ctx.restore();

                    ctx.restore();

                    // الانتقال للمسافة التالية
                    currentBadgeX += badgeSize + badgeGap;
                }
            }

            // إذا لم يكن هناك شارات، نعرض شارة Beginner
            if (achievedBadges.length === 0) {
                ctx.font = 'bold 18px Arial';
                ctx.fillStyle = '#cccccc';
                ctx.textAlign = 'left';
                ctx.fillText('Beginner', badgeStartX, badgeY + badgeSize/2 + 5);
            }

            // Invite Info
            ctx.font = 'bold 24px Arial';
            const infoGradient = ctx.createLinearGradient(280, 140, 500, 140);
            infoGradient.addColorStop(0, '#ffffff');
            infoGradient.addColorStop(1, '#cccccc');
            ctx.fillStyle = infoGradient;
            ctx.fillText('Invite Info', 280, 150);

            // Progress to Next Role (تظهر فقط إذا لم يكن أعلى رتبة)
            if (!userProgress.isMaxLevel) {
                const nextRoleGradient = ctx.createLinearGradient(width - 350, 140, width - 40, 140);
                nextRoleGradient.addColorStop(0, userProgress.nextRoleColor);
                nextRoleGradient.addColorStop(1, userProgress.nextRoleColor + 'aa');
                ctx.fillStyle = nextRoleGradient;

                ctx.textAlign = 'right';
                ctx.fillText(`Progress to ${userProgress.nextRole}`, width - 40, 150);
                ctx.textAlign = 'left';
            }

            // Progress Bar مع النص في المنتصف
            const progressBarX = 280;
            const progressBarY = 160;
            const progressBarWidth = width - 320;
            const progressBarHeight = 30;
            const progressBarRadius = 10;

            // النص الذي سيظهر في منتصف الـ Progress bar
            let progressText;
            if (userProgress.isMaxLevel) {
                progressText = 'Congratulations, You\'re officially Gamer 4 :D';
            } else {
                progressText = `${verifiedCount}/${userProgress.requiredForNext} Verified`;
            }

            drawProgressBar(
                ctx, 
                progressBarX, 
                progressBarY, 
                progressBarWidth, 
                progressBarHeight, 
                progressBarRadius, 
                userProgress.progress, 
                userProgress.nextRoleColor,
                progressText
            );

            // إعدادات Total / Verified / Unverified / Left
            const stats = [
                { label: 'Total', value: userData.total || 0, gradientColors: ['#ffffff', '#cccccc'] },
                { label: 'Verified', value: verifiedCount, gradientColors: ['#00ff47', '#00a335'] },
                { label: 'Unverified', value: userData.unverified || 0, gradientColors: ['#ffd700', '#cc9900'] },
                { label: 'Left', value: userData.left_count || 0, gradientColors: ['#ff4444', '#cc0000'] }
            ];

            // محاذاة المربعات
            const lineStartX = 260;
            const lineEndX = width - 20;
            const lineWidth = lineEndX - lineStartX;

            const boxWidth = 130;
            const gap = (lineWidth - (stats.length * boxWidth)) / (stats.length + 1);
            const startX = lineStartX + gap;

            // إحداثيات المربعات
            const boxY = 200;
            const boxHeight = 80;
            const radius = 15;

            stats.forEach((stat, i) => {
                const x = startX + i * (boxWidth + gap) + boxWidth / 2;
                const boxX = x - boxWidth / 2;

                // تأثير الظل للمربع
                ctx.save();
                ctx.shadowColor = 'rgba(0,0,0,0.6)';
                ctx.shadowBlur = 10;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 5;

                // خلفية المربع
                ctx.fillStyle = '#1a1a1a';
                drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
                ctx.fill();

                // إطار المربع
                const borderGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
                borderGradient.addColorStop(0, stat.gradientColors[0]);
                borderGradient.addColorStop(1, stat.gradientColors[1]);
                ctx.strokeStyle = borderGradient;
                ctx.lineWidth = 3;
                drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
                ctx.stroke();

                // تظليل داخلي
                const innerGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
                innerGradient.addColorStop(0, stat.gradientColors[0] + '20');
                innerGradient.addColorStop(0.5, stat.gradientColors[1] + '10');
                innerGradient.addColorStop(1, stat.gradientColors[1] + '05');
                ctx.fillStyle = innerGradient;
                drawRoundedRect(ctx, boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4, radius - 2);
                ctx.fill();

                ctx.restore();

                // العنوان داخل المربع (متوسط)
                ctx.font = 'bold 18px Arial';
                const labelGradient = ctx.createLinearGradient(boxX, boxY + 25, boxX + boxWidth, boxY + 25);
                labelGradient.addColorStop(0, stat.gradientColors[0]);
                labelGradient.addColorStop(1, stat.gradientColors[1]);
                ctx.fillStyle = labelGradient;

                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                ctx.textAlign = 'center';
                ctx.fillText(stat.label, x, boxY + 25);

                // القيمة داخل المربع (متوسط)
                ctx.font = 'bold 28px Arial';
                const valueGradient = ctx.createLinearGradient(boxX, boxY + 55, boxX + boxWidth, boxY + 55);
                valueGradient.addColorStop(0, stat.gradientColors[0]);
                valueGradient.addColorStop(1, stat.gradientColors[1]);
                ctx.fillStyle = valueGradient;

                ctx.shadowColor = 'rgba(0,0,0,0.7)';
                ctx.shadowBlur = 6;
                ctx.shadowOffsetX = 0;
                ctx.shadowOffsetY = 3;
                ctx.fillText(stat.value.toString(), x, boxY + 55);

                ctx.shadowColor = 'transparent';
            });

            // إخراج الصورة
            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'invites.png' });

            await interaction.reply({ files: [attachment] });

        } catch (error) {
            console.error('Error in invites command:', error);
            await interaction.reply({
                content: 'An error occurred while generating the invite card.',
                ephemeral: true
            });
        }
    }
};