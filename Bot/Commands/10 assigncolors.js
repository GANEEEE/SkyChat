const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('assigncolors')
        .setDescription('Assign or remove a specific color role to yourself')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('color')
                .setDescription('Select the color you want - Click again to remove')
                .setRequired(true)
                .addChoices(
                    { name: '🍒 Crimson', value: '1416515504138489886' },
                    { name: '🥝 Emerald', value: '1416516093299916951' },
                    { name: '🍋 Goldnerd', value: '1416516139210768465' },
                    { name: '🪻 Violet', value: '1416516194055487498' },
                    { name: '🌸 Rose', value: '1416516259574452447' },
                    { name: '🌆 Midnight', value: '1416516330026172526' },
                    { name: '🪔 Apricot', value: '1417650028226547774' },
                    { name: '🧊 Cold Ice', value: '1417649953374863440' },
                    { name: '🍯 Amber', value: '1417650145889095680' },
                    { name: '🍫 Mocha', value: '1417652289824358533' },
                    { name: '🕯️ Mist', value: '1430923922412666911' },
                    { name: '🪷 Velvet', value: '1430924075844239561' },
                    { name: '❌ Remove Current Color', value: 'remove' }
                )),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const selectedColorId = interaction.options.getString('color');
            const member = interaction.member;

            // التحقق من وجود رول Color Access
            const colorAccessRole = await this.getColorAccessRole(client);
            if (!colorAccessRole) {
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Color Access Not Configured')
                    .setDescription('The Color Access role has not been set up yet.\nPlease contact an administrator to set it up using `/setrole`.')
                    .setImage(process.env.OrangeLine);
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق إذا المستخدم عنده رول Color Access
            if (!member.roles.cache.has(colorAccessRole.id)) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Access Denied')
                    .setDescription(`You need the ${colorAccessRole.toString()} role to use color commands.`)
                    .setImage(process.env.RedLine)
                    .addFields(
                        { name: 'Required Role', value: colorAccessRole.toString(), inline: true },
                        { name: 'How to Get Access', value: 'Purchase the role from the Chat Rewards store', inline: true }
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            // تعريف معلومات الأدوار مع الألوان
            const roleInfo = {
                '1416515504138489886': { name: 'Crimson', emoji: '🍒', hex: '#DC143C' },
                '1416516093299916951': { name: 'Emerald', emoji: '🥝', hex: '#50C878' },
                '1416516139210768465': { name: 'Goldnerd', emoji: '🍋', hex: '#FFD700' },
                '1416516194055487498': { name: 'Violet', emoji: '🪻', hex: '#8A2BE2' },
                '1416516259574452447': { name: 'Rose', emoji: '🌸', hex: '#FF66B2' },
                '1416516330026172526': { name: 'Midnight', emoji: '🌆', hex: '#191970' },
                '1417650028226547774': { name: 'Apricot', emoji: '🪔', hex: '#FBCEB1' },
                '1417649953374863440': { name: 'Cold Ice', emoji: '🧊', hex: '#B9F2FF' },
                '1417650145889095680': { name: 'Amber', emoji: '🍯', hex: '#FFBF00' },
                '1417652289824358533': { name: 'Mocha', emoji: '🍫', hex: '#967969' },
                '1430923922412666911': { name: 'Mist', emoji: '🕯️', hex: '#4B5D67' },
                '1430924075844239561': { name: 'Velvet', emoji: '🪷', hex: '#D8A7B1' }
            };

            // الحصول على اللون الحالي للمستخدم
            const currentColorRole = this.getUserCurrentColorRole(member);

            if (selectedColorId === 'remove') {
                if (!currentColorRole) {
                    const embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('ℹ️ No Color Found')
                        .setDescription('You don\'t have any color role to remove.')
                        .setImage(process.env.OrangeLine);
                    return interaction.editReply({ embeds: [embed] });
                }

                await member.roles.remove(currentColorRole.id);
                const colorInfo = roleInfo[currentColorRole.id];

                const embed = new EmbedBuilder()
                    .setColor(colorInfo.hex)
                    .setTitle('✅ Color Removed!')
                    .setDescription(`${colorInfo.emoji} The **${colorInfo.name}** role has been removed.`)
                    .setThumbnail(this.getColorThumbnail(colorInfo.hex))
                    .addFields(
                        { name: 'Removed Role', value: `<@&${currentColorRole.id}>`, inline: true },
                        { name: 'Status', value: '❌ **Removed**', inline: true }
                    );

                await interaction.editReply({ embeds: [embed] });
                console.log(`✅ Removed ${colorInfo.name} from ${interaction.user.tag}`);
                return;
            }

            const newRole = interaction.guild.roles.cache.get(selectedColorId);
            const newColorInfo = roleInfo[selectedColorId];

            if (!newRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Role Not Found')
                    .setDescription(`The selected color role was not found.`)
                    .setImage(process.env.RedLine);
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من صلاحيات البوت
            if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Missing Permissions')
                    .setDescription('The bot does not have the Manage Roles permission!')
                    .setImage(process.env.RedLine);
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من أن البوت يستطيع تعديل هذا الرول
            if (newRole.position >= interaction.guild.members.me.roles.highest.position) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Role Hierarchy Error')
                    .setDescription('The color role is higher than my highest role, so I cannot manage it.')
                    .setImage(process.env.RedLine);
                return interaction.editReply({ embeds: [embed] });
            }

            // إذا المستخدم معاه اللون المطلوب بالفعل
            if (currentColorRole && currentColorRole.id === selectedColorId) {
                // إزالة اللون الحالي
                await member.roles.remove(currentColorRole.id);

                const embed = new EmbedBuilder()
                    .setColor(newColorInfo.hex)
                    .setTitle('🔁 Color Role Removed!')
                    .setDescription(`${newColorInfo.emoji} The **${newColorInfo.name}** role has been removed from you.`)
                    .setThumbnail(this.getColorThumbnail(newColorInfo.hex))
                    .addFields(
                        { name: 'Role', value: `<@&${newRole.id}>`, inline: true },
                        { name: 'Status', value: '❌ **Removed**', inline: true },
                        { name: 'Color Code', value: `\`${newColorInfo.hex}\``, inline: false }
                    );

                await interaction.editReply({ embeds: [embed] });
                console.log(`✅ Removed ${newColorInfo.name} from ${interaction.user.tag}`);

            } else if (currentColorRole) {
                // إذا المستخدم معاه لون مختلف ويحاول أخذ لون جديد
                const currentColorInfo = roleInfo[currentColorRole.id];

                const embed = new EmbedBuilder()
                    .setColor(currentColorInfo.hex)
                    .setTitle('🔄 Replace Color?')
                    .setDescription(`You already have the ${currentColorInfo.emoji} **${currentColorInfo.name}** role.\nDo you want to replace it with ${newColorInfo.emoji} **${newColorInfo.name}**?`)
                    .addFields(
                        { name: 'Current Color', value: `${currentColorInfo.emoji} ${currentColorInfo.name}`, inline: true },
                        { name: 'New Color', value: `${newColorInfo.emoji} ${newColorInfo.name}`, inline: true },
                        { name: 'Note', value: 'You can only have one color role at a time', inline: false }
                    );

                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`replace_color_${newRole.id}`)
                            .setLabel('Replace Color')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🔄'),
                        new ButtonBuilder()
                            .setCustomId('cancel_replace')
                            .setLabel('Keep Current')
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('✖️')
                    );

                const response = await interaction.editReply({ 
                    embeds: [embed], 
                    components: [row],
                    ephemeral: true 
                });

                // إنشاء collector للرد على الزر
                const collector = response.createMessageComponentCollector({ 
                    time: 30000, // 30 ثانية
                    filter: i => i.user.id === interaction.user.id 
                });

                collector.on('collect', async i => {
                    if (i.customId === `replace_color_${newRole.id}`) {
                        // إزالة اللون الحالي وإضافة الجديد
                        await member.roles.remove(currentColorRole.id);
                        await member.roles.add(newRole.id);

                        const successEmbed = new EmbedBuilder()
                            .setColor(newColorInfo.hex)
                            .setTitle('✅ Color Replaced!')
                            .setDescription(`${newColorInfo.emoji} Your color has been changed to **${newColorInfo.name}**!`)
                            .setThumbnail(this.getColorThumbnail(newColorInfo.hex))
                            .addFields(
                                { name: 'Old Color', value: `${currentColorInfo.emoji} ${currentColorInfo.name}`, inline: true },
                                { name: 'New Color', value: `${newColorInfo.emoji} ${newColorInfo.name}`, inline: true }
                            );

                        await i.update({ embeds: [successEmbed], components: [] });
                        console.log(`✅ Replaced ${currentColorInfo.name} with ${newColorInfo.name} for ${interaction.user.tag}`);

                    } else if (i.customId === 'cancel_replace') {
                        const cancelEmbed = new EmbedBuilder()
                            .setColor(currentColorInfo.hex)
                            .setTitle('ℹ️ Operation Cancelled')
                            .setDescription(`Keeping your current color: ${currentColorInfo.emoji} **${currentColorInfo.name}**`)
                            .setThumbnail(this.getColorThumbnail(currentColorInfo.hex));

                        await i.update({ embeds: [cancelEmbed], components: [] });
                    }
                });

                collector.on('end', collected => {
                    if (collected.size === 0) {
                        interaction.editReply({ 
                            content: '⏰ Timeout - No action taken.', 
                            embeds: [], 
                            components: [] 
                        }).catch(() => {});
                    }
                });

            } else {
                // إذا المستخدم ممعاهوش أي لون - إضافة اللون الجديد مباشرة
                await member.roles.add(newRole.id);

                const embed = new EmbedBuilder()
                    .setColor(newColorInfo.hex)
                    .setTitle('🎨 Color Role Assigned!')
                    .setDescription(`${newColorInfo.emoji} You have been given the **${newColorInfo.name}** role!`)
                    .setThumbnail(this.getColorThumbnail(newColorInfo.hex))
                    .addFields(
                        { name: 'Role', value: `<@&${newRole.id}>`, inline: true },
                        { name: 'Status', value: '✅ **Added**', inline: true },
                        { name: 'Tip', value: 'Run the same command again to remove this color', inline: false }
                    )
                    .setImage('https://i.ibb.co/KjRnd2Rg/Colors-pallete-Tiny.png');

                await interaction.editReply({ embeds: [embed] });
                console.log(`✅ Assigned ${newColorInfo.name} to ${interaction.user.tag}`);
            }

        } catch (error) {
            console.error('❌ Error in assigncolors:', error);

            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ An error occurred.')
                .setDescription(this.getRoleErrorMessage(error))
                .setImage(process.env.RedLine);

            await interaction.editReply({ embeds: [embed] });
        }
    },

    // دالة للحصول على اللون الحالي للمستخدم
    getUserCurrentColorRole(member) {
        const colorRoleIds = [
            '1416515504138489886', '1416516093299916951', '1416516139210768465',
            '1416516194055487498', '1416516259574452447', '1416516330026172526',
            '1417650028226547774', '1417649953374863440', '1417650145889095680',
            '1417652289824358533', '1430923922412666911', '1430924075844239561'
        ];

        for (const roleId of colorRoleIds) {
            const role = member.roles.cache.get(roleId);
            if (role) {
                return role;
            }
        }
        return null;
    },

    // دالة للحصول على رول Color Access من الداتا بيز
    async getColorAccessRole(client) {
        try {
            // إذا كان الرول محمل بالفعل في الكلَاينت
            if (client.colorAccessRole) {
                return client.colorAccessRole;
            }

            // جلب الرول من الداتا بيز
            const colorAccessRoleData = await dbManager.getBotSetting('colorAccessRole');
            if (!colorAccessRoleData) {
                return null;
            }

            const roleInfo = JSON.parse(colorAccessRoleData.setting_value);
            const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);

            if (!guild) {
                return null;
            }

            const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
            if (role) {
                // تخزين الرول في الكلَاينت للاستخدام المستقبلي
                client.colorAccessRole = role;
                return role;
            }

            return null;
        } catch (error) {
            console.error('Error getting color access role:', error);
            return null;
        }
    },

    getColorThumbnail(hexColor) {
        // إنشاء صورة مصغرة للون
        return `https://singlecolorimage.com/get/${hexColor.replace('#', '')}/100x100`;
    },

    getRoleErrorMessage(error) {
        if (error.code === 50013) {
            return 'The bot does not have sufficient permissions to manage roles.';
        } else if (error.code === 50001) {
            return 'The bot does not have access to manage roles.';
        } else {
            return `An unexpected error occurred: ${error.message}`;
        }
    }
};