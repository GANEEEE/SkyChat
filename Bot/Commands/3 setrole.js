const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const dbManager = require('../Data/database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setrole')
        .setDescription('Set roles for the server')
        .addRoleOption(option =>
            option.setName('verifiedrole')
                .setDescription('Choose the role to set as verified role')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('moderaterole')
                .setDescription('Choose the role to set as moderate role')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('modrole')
                .setDescription('Choose the role to set as mod role')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('coloraccessrole')
                .setDescription('Choose the role to set as color access role')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('platformaccessrole')
                .setDescription('Choose the role to set as platform access role')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('championrestrole')
                .setDescription('Choose the role to set as champion rest role')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        // التحقق من الصلاحية
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const embed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('⛔ Permission Denied')
                .setImage(process.env.RedLine)
                .setDescription('You need **Administrator** permissions to use this command.');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        const verifiedRole = interaction.options.getRole('verifiedrole');
        const moderateRole = interaction.options.getRole('moderaterole');
        const modRole = interaction.options.getRole('modrole');
        const colorAccessRole = interaction.options.getRole('coloraccessrole');
        const platformAccessRole = interaction.options.getRole('platformaccessrole');
        const championRestRole = interaction.options.getRole('championrestrole');

        // التحقق من أنه تم اختيار رتبة واحدة على الأقل
        if (!verifiedRole && !moderateRole && !modRole && !colorAccessRole && !platformAccessRole && !championRestRole) {
            const embed = new EmbedBuilder()
                .setColor('#FFA500')
                .setTitle('⚠️ No Roles Selected')
                .setImage(process.env.OrangeLine)
                .setDescription('You must select at least one role to set (verified, moderate, mod, color access, platform access, or champion rest).');
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }

        try {
            let updatedRoles = [];

            // حفظ إعدادات verified role إذا تم اختياره
            if (verifiedRole) {
                await dbManager.setBotSetting(
                    'verifiedRole', 
                    JSON.stringify({
                        id: verifiedRole.id,
                        name: verifiedRole.name,
                        color: verifiedRole.hexColor,
                        guildId: interaction.guild.id,
                        guildName: interaction.guild.name,
                        setBy: interaction.user.id,
                        setByName: interaction.user.tag,
                        setAt: new Date().toISOString()
                    }), 
                    interaction.guild.id, 
                    interaction.user.id
                );
                client.verifiedRole = verifiedRole;
                updatedRoles.push(`✅ Verified Role: ${verifiedRole.toString()}`);
            }

            // حفظ إعدادات moderate role إذا تم اختياره
            if (moderateRole) {
                await dbManager.setBotSetting(
                    'moderateRole', 
                    JSON.stringify({
                        id: moderateRole.id,
                        name: moderateRole.name,
                        color: moderateRole.hexColor,
                        guildId: interaction.guild.id,
                        guildName: interaction.guild.name,
                        setBy: interaction.user.id,
                        setByName: interaction.user.tag,
                        setAt: new Date().toISOString()
                    }), 
                    interaction.guild.id, 
                    interaction.user.id
                );
                client.moderateRole = moderateRole;
                updatedRoles.push(`🛡️ Moderate Role: ${moderateRole.toString()}`);
            }

            // حفظ إعدادات mod role إذا تم اختياره
            if (modRole) {
                await dbManager.setBotSetting(
                    'modRole', 
                    JSON.stringify({
                        id: modRole.id,
                        name: modRole.name,
                        color: modRole.hexColor,
                        guildId: interaction.guild.id,
                        guildName: interaction.guild.name,
                        setBy: interaction.user.id,
                        setByName: interaction.user.tag,
                        setAt: new Date().toISOString()
                    }), 
                    interaction.guild.id, 
                    interaction.user.id
                );
                client.modRole = modRole;
                updatedRoles.push(`🔧 Mod Role: ${modRole.toString()}`);
            }

            // حفظ إعدادات color access role إذا تم اختياره
            if (colorAccessRole) {
                await dbManager.setBotSetting(
                    'colorAccessRole', 
                    JSON.stringify({
                        id: colorAccessRole.id,
                        name: colorAccessRole.name,
                        color: colorAccessRole.hexColor,
                        guildId: interaction.guild.id,
                        guildName: interaction.guild.name,
                        setBy: interaction.user.id,
                        setByName: interaction.user.tag,
                        setAt: new Date().toISOString()
                    }), 
                    interaction.guild.id, 
                    interaction.user.id
                );
                client.colorAccessRole = colorAccessRole;
                updatedRoles.push(`🎨 Color Access Role: ${colorAccessRole.toString()}`);
            }

            // حفظ إعدادات platform access role إذا تم اختياره
            if (platformAccessRole) {
                await dbManager.setBotSetting(
                    'platformAccessRole', 
                    JSON.stringify({
                        id: platformAccessRole.id,
                        name: platformAccessRole.name,
                        color: platformAccessRole.hexColor,
                        guildId: interaction.guild.id,
                        guildName: interaction.guild.name,
                        setBy: interaction.user.id,
                        setByName: interaction.user.tag,
                        setAt: new Date().toISOString()
                    }), 
                    interaction.guild.id, 
                    interaction.user.id
                );
                client.platformAccessRole = platformAccessRole;
                updatedRoles.push(`🌐 Platform Access Role: ${platformAccessRole.toString()}`);
            }

            // حفظ إعدادات champion rest role إذا تم اختياره
            if (championRestRole) {
                await dbManager.setBotSetting(
                    'championRestRole', 
                    JSON.stringify({
                        id: championRestRole.id,
                        name: championRestRole.name,
                        color: championRestRole.hexColor,
                        guildId: interaction.guild.id,
                        guildName: interaction.guild.name,
                        setBy: interaction.user.id,
                        setByName: interaction.user.tag,
                        setAt: new Date().toISOString()
                    }), 
                    interaction.guild.id, 
                    interaction.user.id
                );
                client.championRestRole = championRestRole;
                updatedRoles.push(`🛏 Champion Rest Role: ${championRestRole.toString()}`);
            }

            // إنشاء وإرسال embed الرد
            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('✅ Roles Updated Successfully')
                .setDescription(updatedRoles.join('\n'))
                .setImage(process.env.BlueLine)
                .addFields(
                    { name: '👤 Set by', value: interaction.user.toString(), inline: false }
                )

            await interaction.reply({ embeds: [successEmbed] });

        } catch (error) {
            console.error('Error setting roles:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setImage(process.env.RedLine)
                .setDescription('An error occurred while setting the roles.');
            await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
    },

    // دالة لتحميل الرول عند بدء التشغيل
    async loadRoles(client) {
        try {
            // تحميل verified role
            const verifiedRoleData = await dbManager.getBotSetting('verifiedRole');
            if (verifiedRoleData) {
                try {
                    const roleInfo = JSON.parse(verifiedRoleData.setting_value);
                    const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);
                    if (guild) {
                        const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (role) {
                            client.verifiedRole = role;
                            console.log(`✅ Verified role loaded: ${role.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing verified role data:', error);
                }
            }

            // تحميل moderate role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');
            if (moderateRoleData) {
                try {
                    const roleInfo = JSON.parse(moderateRoleData.setting_value);
                    const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);
                    if (guild) {
                        const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (role) {
                            client.moderateRole = role;
                            console.log(`✅ Moderate role loaded: ${role.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing moderate role data:', error);
                }
            }

            // تحميل mod role
            const modRoleData = await dbManager.getBotSetting('modRole');
            if (modRoleData) {
                try {
                    const roleInfo = JSON.parse(modRoleData.setting_value);
                    const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);
                    if (guild) {
                        const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (role) {
                            client.modRole = role;
                            console.log(`✅ Mod role loaded: ${role.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing mod role data:', error);
                }
            }

            // تحميل color access role
            const colorAccessRoleData = await dbManager.getBotSetting('colorAccessRole');
            if (colorAccessRoleData) {
                try {
                    const roleInfo = JSON.parse(colorAccessRoleData.setting_value);
                    const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);
                    if (guild) {
                        const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (role) {
                            client.colorAccessRole = role;
                            console.log(`✅ Color Access role loaded: ${role.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing color access role data:', error);
                }
            }

            // تحميل platform access role
            const platformAccessRoleData = await dbManager.getBotSetting('platformAccessRole');
            if (platformAccessRoleData) {
                try {
                    const roleInfo = JSON.parse(platformAccessRoleData.setting_value);
                    const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);
                    if (guild) {
                        const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (role) {
                            client.platformAccessRole = role;
                            console.log(`✅ Platform Access role loaded: ${role.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing platform access role data:', error);
                }
            }

            // تحميل champion rest role
            const championRestRoleData = await dbManager.getBotSetting('championRestRole');
            if (championRestRoleData) {
                try {
                    const roleInfo = JSON.parse(championRestRoleData.setting_value);
                    const guild = await client.guilds.fetch(roleInfo.guildId).catch(() => null);
                    if (guild) {
                        const role = await guild.roles.fetch(roleInfo.id).catch(() => null);
                        if (role) {
                            client.championRestRole = role;
                            console.log(`✅ Champion Rest role loaded: ${role.name}`);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing champion rest role data:', error);
                }
            }

            console.log('✅ All roles loaded successfully');
            return true;

        } catch (error) {
            console.error('Error loading roles:', error);
            return false;
        }
    }
};