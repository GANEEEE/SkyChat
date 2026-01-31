// verifySimple.js - الكود النهائي الصحيح
const { 
    SlashCommandBuilder, 
    ContainerBuilder, 
    SectionBuilder, 
    SeparatorBuilder, 
    TextDisplayBuilder,
    ButtonBuilder, 
    ButtonStyle,
    ActionRowBuilder,
    ChannelType,
    MessageFlags
} = require('discord.js');

class VerifySimpleCommand {
    constructor() {
        this.data = new SlashCommandBuilder()
            .setName('verifycode')
            .setDescription('Create simple verification panel')
            .setDMPermission(false)
            .addChannelOption(option =>
                option
                    .setName('channel')
                    .setDescription('Channel to send panel in')
                    .setRequired(false)
                    .addChannelTypes(ChannelType.GuildText)
            );

        this.activeCodes = new Map();
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [code, data] of this.activeCodes.entries()) {
                if (now - data.createdAt > 60000) {
                    this.activeCodes.delete(code);
                }
            }
        }, 30000);
    }

    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;

        try {
            // ✅ الحصول على صورة السيرفر (الأفاتار)
            const guildIcon = interaction.guild.iconURL({ extension: 'png', size: 256 }) || 
                            'https://i.imgur.com/AfFp7pu.png'; // صورة افتراضية

            // ✅ إنشاء الكونتينر باستخدام Components V2
            const verificationContainer = new ContainerBuilder()
                .setAccentColor(0x0073ff) // اللون الأزرق

                // ✅ السكشن الأول: عنوان الفيريفيكيشن مع ثامبنيل السيرفر
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents(
                            (textDisplay) =>
                                textDisplay.setContent('# 🔐 Account Verification\n**Click the button below to start verification**')
                        )
                        .setThumbnailAccessory((thumbnail) =>
                            thumbnail
                                .setDescription(`Verification for ${interaction.guild.name}`)
                                .setURL(guildIcon)
                        )
                )

                // ✅ الفاصل
                .addSeparatorComponents((separator) => separator)

                // ✅ النص: خطوات الفيريفيكيشن (بدون سكشن)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('## 📋 Verification Steps:\n```\n1. Click "Start Verification"\n2. Choose the correct code\n3. Get verified role\n```')
                )

                // ✅ الفاصل
                .addSeparatorComponents((separator) => separator)

                // ✅ السكشن مع الزر فقط
                .addSectionComponents((section) =>
                    section
                        .addTextDisplayComponents(
                            (textDisplay) =>
                                textDisplay.setContent('### Ready to verify?')
                        )
                        .setButtonAccessory((button) =>
                            button
                                .setCustomId('simple_start_verification')
                                .setLabel('Start Verification')
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji({name: '🔐'})
                        )
                );

            await targetChannel.send({
                components: [verificationContainer],
                flags: MessageFlags.IsComponentsV2
            });

            await interaction.editReply({
                content: `✅ Verification panel created in ${targetChannel}!`
            });

        } catch (error) {
            console.error('Error creating panel:', error);
            await interaction.editReply({
                content: '❌ Error creating verification panel.'
            });
        }
    }

    async buttonHandler(interaction) {
        if (interaction.customId === 'simple_start_verification') {
            await this.handleVerificationStart(interaction);
        } else if (interaction.customId.startsWith('simple_verify_')) {
            await this.handleCodeSelection(interaction);
        }
    }

    async handleVerificationStart(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userId = interaction.user.id;
        const code = this.generateCode();

        this.activeCodes.set(code, {
            userId: userId,
            createdAt: Date.now(),
            attempts: 0,
            username: interaction.user.username
        });

        // ✅ الحصول على صورة السيرفر (الأفاتار)
        const guildIcon = interaction.guild.iconURL({ extension: 'png', size: 256 }) || 
                        'https://i.imgur.com/AfFp7pu.png'; // صورة افتراضية

        // ✅ إنشاء أزرار الكود
        const wrongCodes = new Set();
        while (wrongCodes.size < 3) {
            let wrongCode = '';
            for (let i = 0; i < 6; i++) {
                const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
                wrongCode += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            if (wrongCode !== code) {
                wrongCodes.add(wrongCode);
            }
        }

        const allCodes = [code, ...Array.from(wrongCodes)];
        const shuffledCodes = [...allCodes].sort(() => Math.random() - 0.5);

        const buttons = shuffledCodes.map((btnCode) => {
            return new ButtonBuilder()
                .setCustomId(`simple_verify_${btnCode === code ? 'correct' : 'wrong'}_${btnCode}`)
                .setLabel(btnCode)
                .setStyle(ButtonStyle.Secondary);
        });

        // ✅ إنشاء ActionRow للازرار الـ 4
        const buttonRow = new ActionRowBuilder()
            .addComponents(buttons);

        // ✅ إنشاء الكونتينر للكود باستخدام Components V2
        const codeContainer = new ContainerBuilder()
            .setAccentColor(0x0073ff) // اللون الأزرق

            // ✅ السكشن الأول: العنوان مع ثامبنيل السيرفر
            .addSectionComponents((section) =>
                section
                    .addTextDisplayComponents(
                        (textDisplay) =>
                            textDisplay.setContent('# 🔢 Verification Code\n**Select the correct code from the buttons below:**')
                    )
                    .setThumbnailAccessory((thumbnail) =>
                        thumbnail
                            .setDescription(`Verification for ${interaction.guild.name}`)
                            .setURL(guildIcon)
                    )
            )

            // ✅ الفاصل
            .addSeparatorComponents((separator) => separator)

            // ✅ النص: الكود (بدون سكشن)
            .addTextDisplayComponents((textDisplay) =>
                textDisplay.setContent('## Your Verification Code:\n```css\n[' + code + ']\n```')
            )

            // ✅ الفاصل
            .addSeparatorComponents((separator) => separator)

            // ✅ إضافة ActionRow جوا الكونتينر
            .addActionRowComponents((actionRow) =>
                actionRow.setComponents(buttons)
            );

        await interaction.editReply({
            components: [codeContainer],
            flags: MessageFlags.IsComponentsV2
        });
    }

    async handleCodeSelection(interaction) {
        await interaction.deferUpdate();

        const parts = interaction.customId.split('_');
        const isCorrect = parts[2] === 'correct';
        const selectedCode = parts[3];

        let correctCode = null;
        let userData = null;

        // البحث عن الكود الصحيح
        for (const [code, data] of this.activeCodes.entries()) {
            if (data.userId === interaction.user.id) {
                correctCode = code;
                userData = data;
                break;
            }
        }

        if (!correctCode || (Date.now() - userData.createdAt > 60000)) {
            if (correctCode) this.activeCodes.delete(correctCode);

            // ✅ رسالة الفشل
            const failedContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('# ❌ Verification Failed\n**Please start the verification process again.**')
                );

            await interaction.editReply({
                components: [failedContainer],
                flags: MessageFlags.IsComponentsV2
            });
            return;
        }

        if (isCorrect) {
            // ✅ نجاح
            this.activeCodes.delete(correctCode);

            // ✅ رسالة النجاح
            const successContainer = new ContainerBuilder()
                .setAccentColor(0x0073ff)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent(`# ✅ Verification Successful!\n**Welcome ${interaction.user}!**\n\n### Status\nAccount verified successfully`)
                );

            await interaction.editReply({
                components: [successContainer],
                flags: MessageFlags.IsComponentsV2
            });

            await this.updateUserRoles(interaction);

        } else {
            // ✅ فشل
            userData.attempts += 1;

            if (userData.attempts >= 3) {
                this.activeCodes.delete(correctCode);

                const failedContainer = new ContainerBuilder()
                    .setAccentColor(0xFF0000)
                    .addTextDisplayComponents((textDisplay) =>
                        textDisplay.setContent('# ❌ Verification Failed\n**Too many incorrect attempts. Please start again.**')
                    );

                await interaction.editReply({
                    components: [failedContainer],
                    flags: MessageFlags.IsComponentsV2
                });
                return;
            }

            // ✅ رسالة محاولة أخرى
            const retryContainer = new ContainerBuilder()
                .setAccentColor(0xFFA500)
                .addTextDisplayComponents((textDisplay) =>
                    textDisplay.setContent('# ⚠️ Incorrect Code\n**Please try again.**')
                );

            await interaction.editReply({
                components: [retryContainer],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }

    async updateUserRoles(interaction) {
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);

            const UNVERIFIED_ROLE_ID = '1390001642069299280';
            if (UNVERIFIED_ROLE_ID && member.roles.cache.has(UNVERIFIED_ROLE_ID)) {
                await member.roles.remove(UNVERIFIED_ROLE_ID);
                console.log(`Removed unverified role from ${interaction.user.tag}`);
            }

            const VERIFIED_ROLE_ID = '1385519950919106571';
            if (VERIFIED_ROLE_ID) {
                const role = await interaction.guild.roles.fetch(VERIFIED_ROLE_ID);
                if (role && !member.roles.cache.has(VERIFIED_ROLE_ID)) {
                    await member.roles.add(role);
                    console.log(`Added verified role to ${interaction.user.tag}`);
                }
            }

        } catch (error) {
            console.error('Error updating roles:', error);
        }
    }
}

module.exports = new VerifySimpleCommand();