const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
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

// دالة مساعدة لرسم الإيموجي باستخدام Twemoji
async function drawEmoji(ctx, emojiCode, x, y, size = 24) {
    try {
        const emojiUrl = twemoji.parse(emojiCode).match(/src="([^"]*)"/)[1];
        const emojiImage = await loadImage(emojiUrl);
        ctx.drawImage(emojiImage, x, y, size, size);
    } catch (error) {
        console.error('Error loading emoji:', error);
        // رسم مربع بديل إذا فشل تحميل الإيموجي
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, size, size);
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('showrole')
        .setDescription('Show all configured roles for the server')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Type of role to show')
                .setRequired(false)
                .addChoices(
                    { name: 'Moderate Role', value: 'moderate' },
                    { name: 'Mod Role', value: 'mod' },
                    { name: 'Verified Role', value: 'verified' },
                    { name: 'Color Access Role', value: 'coloraccess' },
                    { name: 'Platform Access Role', value: 'platformaccess' },
                    { name: 'Champion Rest Role', value: 'championrest' },
                    { name: 'All Roles', value: 'all' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const buffer = await createErrorImage('⛔ Permission Denied', 'You need Administrator permissions to use this command.');
            const attachment = new AttachmentBuilder(buffer, { name: 'permission_denied.png' });
            return interaction.reply({ files: [attachment], ephemeral: true });
        }

        const roleType = interaction.options.getString('type') || 'all';

        try {
            // جلب بيانات جميع الرولات
            const rolesData = {
                moderate: await dbManager.getBotSetting('moderateRole'),
                mod: await dbManager.getBotSetting('modRole'),
                verified: await dbManager.getBotSetting('verifiedRole'),
                coloraccess: await dbManager.getBotSetting('colorAccessRole'),
                platformaccess: await dbManager.getBotSetting('platformAccessRole'),
                championrest: await dbManager.getBotSetting('championRestRole')
            };

            // إنشاء الصورة بناءً على النوع
            let buffer;
            if (roleType === 'all') {
                buffer = await createAllRolesImage(rolesData, client, interaction);
            } else {
                buffer = await createSingleRoleImage(rolesData[roleType], roleType, client, interaction);
            }

            const attachment = new AttachmentBuilder(buffer, { name: `roles_${roleType}.png` });
            await interaction.reply({ files: [attachment] });

        } catch (error) {
            console.error('Error showing roles:', error);
            const buffer = await createErrorImage('❌ Error', 'An error occurred while retrieving role information.');
            const attachment = new AttachmentBuilder(buffer, { name: 'error.png' });
            await interaction.reply({ files: [attachment], ephemeral: true });
        }
    }
};

// دالة لإنشاء صورة جميع الرولات
async function createAllRolesImage(rolesData, client, interaction) {
    const width = 800;
    const height = 950; // زيادة الارتفاع لاستيعاب جميع الرولات
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0f0f0f');
    bgGradient.addColorStop(1, '#1a1a1a');
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

    // العنوان
    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Role Settings Overview', width / 2, 50);

    // تعريف جميع الرولات
    const roles = [
        { key: 'moderate', title: 'Moderate Role', emoji: '🛡️', defaultColor: '#FF6B6B' },
        { key: 'mod', title: 'Mod Role', emoji: '🔧', defaultColor: '#4ECDC4' },
        { key: 'verified', title: 'Verified Role', emoji: '✅', defaultColor: '#45B7D1' },
        { key: 'coloraccess', title: 'Color Access Role', emoji: '🎨', defaultColor: '#FFD93D' },
        { key: 'platformaccess', title: 'Platform Access Role', emoji: '🌐', defaultColor: '#6BCF7F' },
        { key: 'championrest', title: 'Champion Rest Role', emoji: '🛏️', defaultColor: '#FF6B8B' }
    ];

    const startY = 90;
    const roleHeight = 120;
    const gap = 20;
    const radius = 15;

    for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        const data = rolesData[role.key];
        const y = startY + (i * (roleHeight + gap));

        // جلب لون الرول الفعلي إذا كان موجود
        let roleColor = role.defaultColor;
        let guildRole = null;
        if (data) {
            try {
                const roleInfo = JSON.parse(data.setting_value);
                guildRole = await getGuildRole(roleInfo, client);
                if (guildRole) {
                    // استخدام لون الرول الفعلي إذا كان موجود وغير افتراضي
                    roleColor = guildRole.hexColor !== '#000000' ? guildRole.hexColor : '#0073ff';
                } else {
                    // إذا الرول مش موجود في السيرفر، استخدم اللون الأزرق
                    roleColor = '#0073ff';
                }
            } catch (error) {
                // استخدم اللون الأزرق إذا كان فيه خطأ
                roleColor = '#0073ff';
            }
        } else {
            // إذا مافيش بيانات للرول، استخدم اللون الأزرق
            roleColor = '#0073ff';
        }

        // خلفية الرول بحواف مستديرة
        ctx.fillStyle = '#1a1a1a';
        drawRoundedRect(ctx, 40, y, width - 80, roleHeight, radius);
        ctx.fill();

        // إطار الرول باللون الفعلي بحواف مستديرة
        ctx.strokeStyle = roleColor;
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, 40, y, width - 80, roleHeight, radius);
        ctx.stroke();

        // تظليل داخلي
        const innerGradient = ctx.createLinearGradient(40, y, 40, y + roleHeight);
        innerGradient.addColorStop(0, roleColor + '20');
        innerGradient.addColorStop(1, roleColor + '05');
        ctx.fillStyle = innerGradient;
        drawRoundedRect(ctx, 42, y + 2, width - 84, roleHeight - 4, radius - 2);
        ctx.fill();

        // حساب عرض النص لتحديد موقع الإيموجي
        const titleText = `${role.title}`;
        ctx.fillStyle = roleColor;
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';

        // قياس عرض النص
        const textWidth = ctx.measureText(titleText).width;
        const emojiSize = 22;
        const totalWidth = textWidth + emojiSize + 10;

        // رسم العنوان والإيموجي في المنتصف
        const startX = (width - totalWidth) / 2;

        // رسم الإيموجي أولاً
        await drawEmoji(ctx, role.emoji, startX, y + 8, emojiSize);

        // ثم رسم النص
        ctx.fillText(titleText, startX + emojiSize + 10 + (textWidth / 2), y + 28);

        if (data) {
            try {
                const roleInfo = JSON.parse(data.setting_value);

                // معلومات الرول - جدول منظم
                ctx.textAlign = 'left';
                ctx.fillStyle = '#CCCCCC';
                ctx.font = '18px Arial';

                // تحديد أعمدة الجدول
                const columnWidth = (width - 120) / 2;
                const leftX = 100;
                const rightX = leftX + columnWidth;
                let infoY = y + 60;

                // الصف الأول: Name | ID
                ctx.fillText('Name:', leftX, infoY);
                ctx.fillText(roleInfo.name, leftX + 65, infoY);

                ctx.fillText('ID:', rightX, infoY);
                ctx.fillText(roleInfo.id, rightX + 30, infoY);

                infoY += 25;

                // الصف الثاني: Members | Position
                if (guildRole) {
                    ctx.fillText('Members:', leftX, infoY);
                    ctx.fillText(guildRole.members.size.toString(), leftX + 90, infoY);

                    ctx.fillText('Position:', rightX, infoY);
                    ctx.fillText(guildRole.position.toString(), rightX + 85, infoY);
                } else {
                    ctx.fillText('Members:', leftX, infoY);
                    ctx.fillText('N/A', leftX + 85, infoY);

                    ctx.fillText('Position:', rightX, infoY);
                    ctx.fillText('N/A', rightX + 80, infoY);
                }

                infoY += 25;

                // الصف الثالث: Set by | Status
                ctx.fillText('Set by:', leftX, infoY);
                ctx.fillText(await getUsername(roleInfo.setBy, client), leftX + 70, infoY);

                ctx.fillText('Status:', rightX, infoY);
                const status = guildRole ? 'Online' : 'Offline';
                ctx.fillStyle = guildRole ? '#00FF88' : '#FF4444';
                ctx.fillText(status, rightX + 70, infoY);
                ctx.fillStyle = '#CCCCCC';

            } catch (error) {
                ctx.fillStyle = '#FFA500';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('⚠️ Corrupted Data', width / 2, y + 60);
            }
        } else {
            ctx.fillStyle = '#FFA500';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('⚠️ Not Configured', width / 2, y + 60);
        }
    }

    return canvas.toBuffer('image/png');
}

// دالة لإنشاء صورة رول واحد
async function createSingleRoleImage(roleData, roleType, client, interaction) {
    const width = 700;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0f0f0f');
    bgGradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار
    const borderPadding = 4;
    ctx.strokeStyle = '#0073ff';
    ctx.lineWidth = 5;
    ctx.strokeRect(
        borderPadding, 
        borderPadding, 
        width - borderPadding * 2, 
        height - borderPadding * 2
    );

    if (!roleData) {
        // إذا مافيش رول
        ctx.fillStyle = '#FFA500';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ Role Not Configured', width / 2, height / 2);

        ctx.fillStyle = '#CCCCCC';
        ctx.font = '20px Arial';
        ctx.fillText(`No ${roleType} role is set up`, width / 2, height / 2 + 40);
        return canvas.toBuffer('image/png');
    }

    try {
        const roleInfo = JSON.parse(roleData.setting_value);
        const guildRole = await getGuildRole(roleInfo, client);

        // جلب لون الرول الفعلي - استخدام الأزرق إذا مافيش لون
        let roleColor = '#0073ff';
        if (guildRole && guildRole.hexColor !== '#000000') {
            roleColor = guildRole.hexColor;
        }

        // تعريف أنواع الرولات
        const roleConfig = {
            moderate: { emoji: '🛡️', title: 'Moderate Role' },
            mod: { emoji: '🔧', title: 'Mod Role' },
            verified: { emoji: '✅', title: 'Verified Role' },
            coloraccess: { emoji: '🎨', title: 'Color Access Role' },
            platformaccess: { emoji: '🌐', title: 'Platform Access Role' },
            championrest: { emoji: '🛏️', title: 'Champion Rest Role' }
        }[roleType];

        // حساب عرض النص لتحديد موقع الإيموجي
        const titleText = `${roleConfig.title}`;
        ctx.fillStyle = roleColor;
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';

        // قياس عرض النص
        const textWidth = ctx.measureText(titleText).width;
        const emojiSize = 32;
        const totalWidth = textWidth + emojiSize + 15;

        // رسم العنوان والإيموجي في المنتصف
        const startX = (width - totalWidth) / 2;

        // رسم الإيموجي أولاً
        await drawEmoji(ctx, roleConfig.emoji, startX, 30, emojiSize);

        // ثم رسم النص
        ctx.fillText(titleText, startX + emojiSize + 15 + (textWidth / 2), 60);

        // المربع الرئيسي للمعلومات
        const boxX = 50;
        const boxY = 100;
        const boxWidth = width - 100;
        const boxHeight = 250;
        const boxRadius = 20;

        // خلفية المربع الرئيسي
        ctx.fillStyle = '#1a1a1a';
        drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, boxRadius);
        ctx.fill();

        // إطار المربع الرئيسي
        ctx.strokeStyle = roleColor;
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, boxRadius);
        ctx.stroke();

        // تظليل داخلي
        const innerGradient = ctx.createLinearGradient(boxX, boxY, boxX, boxY + boxHeight);
        innerGradient.addColorStop(0, roleColor + '20');
        innerGradient.addColorStop(1, roleColor + '05');
        ctx.fillStyle = innerGradient;
        drawRoundedRect(ctx, boxX + 2, boxY + 2, boxWidth - 4, boxHeight - 4, boxRadius - 2);
        ctx.fill();

        // المعلومات الأساسية - جدول منظم
        ctx.textAlign = 'left';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 20px Arial';

        const startY = boxY + 50;
        const lineHeight = 30;

        // تحديد أعمدة الجدول
        const columnWidth = (boxWidth - 60) / 2;
        const leftX = boxX + 30;
        const rightX = leftX + columnWidth;

        // الصف الأول: Name | ID
        ctx.fillText('Name:', leftX, startY);
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(roleInfo.name, leftX + 85, startY);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('ID:', rightX, startY);
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(roleInfo.id, rightX + 50, startY);

        // الصف الثاني: Members | Position
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Members:', leftX, startY + lineHeight);
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(guildRole ? guildRole.members.size.toString() : 'N/A', leftX + 120, startY + lineHeight);

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Position:', rightX, startY + lineHeight);
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(guildRole ? guildRole.position.toString() : 'N/A', rightX + 95, startY + lineHeight);

        // الصف الثالث: Set by | Status
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Set by:', leftX, startY + (lineHeight * 2));
        ctx.fillStyle = '#CCCCCC';
        ctx.fillText(await getUsername(roleInfo.setBy, client), leftX + 90, startY + (lineHeight * 2));

        ctx.fillStyle = '#FFFFFF';
        ctx.fillText('Status:', rightX, startY + (lineHeight * 2));
        ctx.fillStyle = guildRole ? '#00FF88' : '#FF4444';
        ctx.fillText(guildRole ? 'Online' : 'Offline', rightX + 100, startY + (lineHeight * 2));

    } catch (error) {
        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('❌ Corrupted Role Data', width / 2, height / 2);
    }

    return canvas.toBuffer('image/png');
}

// دالة مساعدة لجلب الرول من السيرفر
async function getGuildRole(roleInfo, client) {
    try {
        const guild = await client.guilds.fetch(roleInfo.guildId);
        const role = await guild.roles.fetch(roleInfo.id);
        return role;
    } catch (error) {
        return null;
    }
}

// دالة مساعدة لجلب اسم المستخدم
async function getUsername(userId, client) {
    try {
        const user = await client.users.fetch(userId);
        return user.username;
    } catch (error) {
        return `Unknown (${userId})`;
    }
}

// دالة لإنشاء صورة الخطأ
async function createErrorImage(title, message) {
    const width = 600;
    const height = 300;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // إطار أحمر
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, width - 4, height - 4);

    // العنوان
    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 80);

    // الرسالة
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '18px Arial';

    // تقسيم الرسالة إذا كانت طويلة
    const words = message.split(' ');
    let line = '';
    let y = 140;

    for (const word of words) {
        const testLine = line + word + ' ';
        const metrics = ctx.measureText(testLine);

        if (metrics.width > width - 100) {
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