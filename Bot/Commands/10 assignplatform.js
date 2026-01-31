const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('assignplatform')
        .setDescription('Assign or remove gaming platform access role')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('platform')
                .setDescription('Select your gaming platform')
                .setRequired(true)
                .addChoices(
                    { name: '💻 PC', value: 'pc gamer' },
                    { name: '🟦 Playstation', value: 'playstation gamer' },
                    { name: '🟩 Xbox', value: 'xbox gamer' },
                    { name: '🟥 Nintendo Switch', value: 'nintendo gamer' },
                    { name: '📱 Mobile', value: 'mobile gamer' },
                    { name: '❌ Remove Platform Access', value: 'remove' }
                )),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ ephemeral: true });

            const selectedPlatform = interaction.options.getString('platform');
            const member = interaction.member;

            // التحقق من وجود رول Platform Access
            const platformAccessRole = await this.getPlatformAccessRole(client);
            if (!platformAccessRole) {
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('⚠️ Platform Access Not Configured')
                    .setDescription('The Platform Access role has not been set up yet.\nPlease contact an administrator to set it up using `/setrole`.')
                    .setImage(process.env.OrangeLine);
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق إذا المستخدم عنده رول Platform Access
            if (!member.roles.cache.has(platformAccessRole.id)) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Access Denied')
                    .setDescription(`You need the ${platformAccessRole.toString()} role to use platform commands.`)
                    .setImage(process.env.RedLine)
                    .addFields(
                        { name: 'Required Role', value: platformAccessRole.toString(), inline: true },
                        { name: 'How to Get Access', value: 'Purchase the role from the Chat Rewards store', inline: true }
                    );
                return interaction.editReply({ embeds: [embed] });
            }

            // تعريف معلومات المنصات مع المفاتيح المطابقة للقيم
            const platformInfo = {
                'pc gamer': { 
                    name: 'PC', 
                    emoji: '💻', 
                    roleId: '1394820300750717070',
                    description: 'PC Gamer'
                },
                'playstation gamer': { 
                    name: 'Playstation', 
                    emoji: '🟦', 
                    roleId: '1394820268098195516',
                    description: 'Playstation Gamer'
                },
                'xbox gamer': { 
                    name: 'Xbox', 
                    emoji: '🟩', 
                    roleId: '1430927282213752972',
                    description: 'Xbox Gamer'
                },
                'nintendo gamer': { 
                    name: 'Nintendo Switch', 
                    emoji: '🟥', 
                    roleId: '1430927399985614909',
                    description: 'Nintendo Switch Gamer'
                },
                'mobile gamer': { 
                    name: 'Mobile', 
                    emoji: '📱', 
                    roleId: '1394820249316102186',
                    description: 'Mobile Gamer'
                }
            };

            if (selectedPlatform === 'remove') {
                const removedCount = await this.removeUserPlatformRoles(member, platformInfo);

                if (removedCount === 0) {
                    const embed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('ℹ️ No Platform Roles Found')
                        .setDescription('You don\'t have any platform roles to remove.')
                        .setImage(process.env.OrangeLine);
                    return interaction.editReply({ embeds: [embed] });
                }

                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('✅ Platform Access Removed!')
                    .setDescription(`Successfully removed **${removedCount}** platform roles from you.`)
                    .setImage(process.env.BlueLine);

                await interaction.editReply({ embeds: [embed] });
                console.log(`✅ Removed ${removedCount} platform roles from ${interaction.user.tag}`);
                return;
            }

            // استخدام selectedPlatform مباشرة كمفتاح
            const platform = platformInfo[selectedPlatform];

            // تحقق إضافي إذا platform غير معرف
            if (!platform) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Invalid Platform')
                    .setDescription('The selected platform is not valid.')
                    .setImage(process.env.RedLine);
                return interaction.editReply({ embeds: [embed] });
            }

            const role = interaction.guild.roles.cache.get(platform.roleId);

            if (!role) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Role Not Found')
                    .setDescription(`The ${platform.emoji} **${platform.name}** role was not found.\nPlease contact an administrator.`)
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
            if (role.position >= interaction.guild.members.me.roles.highest.position) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Role Hierarchy Error')
                    .setDescription('The platform role is higher than my highest role, so I cannot manage it.')
                    .setImage(process.env.RedLine);
                return interaction.editReply({ embeds: [embed] });
            }

            // إذا المستخدم معاه الرول بالفعل
            if (member.roles.cache.has(platform.roleId)) {
                // إزالة الرول
                await member.roles.remove(platform.roleId);

                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setTitle('🔁 Platform Access Removed!')
                    .setDescription(`${platform.emoji} The **${platform.name}** access has been removed.`)
                    .addFields(
                        { name: 'Platform', value: platform.name, inline: true },
                        { name: 'Status', value: '❌ **Removed**', inline: true },
                        { name: 'Description', value: platform.description, inline: false }
                    );

                await interaction.editReply({ embeds: [embed] });
                console.log(`✅ Removed ${platform.name} from ${interaction.user.tag}`);

            } else {
                // إضافة الرول الجديد
                await member.roles.add(platform.roleId);

                const embed = new EmbedBuilder()
                    .setColor('#0073ff')
                    .setTitle('✅ Platform Access Granted!')
                    .setDescription(`${platform.emoji} You have been granted access to **${platform.name}**!`)
                    .addFields(
                        { name: 'Platform', value: platform.name, inline: true },
                        { name: 'Status', value: '✅ **Added**', inline: true },
                        { name: 'Description', value: platform.description, inline: false },
                        { name: 'Tip', value: 'Run the same command again to remove this access', inline: false }
                    );

                await interaction.editReply({ embeds: [embed] });
                console.log(`✅ Granted ${platform.name} to ${interaction.user.tag}`);
            }

        } catch (error) {
            console.error('❌ Error in assignplatform:', error);

            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ An error occurred.')
                .setDescription(this.getRoleErrorMessage(error))
                .setImage(process.env.RedLine);

            await interaction.editReply({ embeds: [embed] });
        }
    },

    // دالة لإزالة جميع رولات المنصات من المستخدم
    async removeUserPlatformRoles(member, platformInfo) {
        let removedCount = 0;

        for (const platformKey in platformInfo) {
            const platform = platformInfo[platformKey];
            const role = member.roles.cache.get(platform.roleId);

            if (role) {
                await member.roles.remove(platform.roleId).catch(() => {});
                removedCount++;
            }
        }

        return removedCount;
    },

    // دالة للحصول على رول Platform Access من الداتا بيز
    async getPlatformAccessRole(client) {
        try {
            // إذا كان الرول محمل بالفعل في الكلَاينت
            if (client.platformAccessRole) {
                return client.platformAccessRole;
            }

            // جلب الرول من الداتا بيز
            const platformAccessRoleData = await dbManager.getBotSetting('platformAccessRole');
            if (!platformAccessRoleData) {
                return null;
            }

            const roleInfo = JSON.parse(platformAccessRoleData.setting_value);
            const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);

            if (!guild) {
                return null;
            }

            const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
            if (role) {
                // تخزين الرول في الكلَاينت للاستخدام المستقبلي
                client.platformAccessRole = role;
                return role;
            }

            return null;
        } catch (error) {
            console.error('Error getting platform access role:', error);
            return null;
        }
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