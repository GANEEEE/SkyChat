const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const dbManager = require('../Data/database'); // تأكد من المسار الصحيح

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stealemojis')
        .setDescription('Searches for emojis in the last 5 messages and allows stealing them.')
        .setDMPermission(false),

    async execute(interaction, client) {
        try {
            await interaction.deferReply();

            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من أن المستخدم لديه Moderate Role
            const roleInfo = JSON.parse(moderateRoleData.setting_value);
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModerateRole = member.roles.cache.has(roleInfo.id);

            if (!hasModerateRole) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⛔ Permission Denied')
                    .setImage(process.env.RedLine)
                    .setDescription(`This command is available only for <@&${roleInfo.id}>.`);
                return interaction.editReply({ embeds: [embed] });
            }

            const messages = await interaction.channel.messages.fetch({ limit: 5 });
            const emojis = this.extractEmojis(messages);

            if (emojis.length === 0) {
                return await interaction.editReply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#8B0000')
                            .setTitle('❌ No matching emojis found.')
                            .setDescription('`No emojis were found in the last 5 messages!`')
                            .setImage(process.env.RedLine)
                    ]
                });
            }

            const { embed, buttons } = this.createEmojiDisplay(emojis, 0);
            const reply = await interaction.editReply({ 
                embeds: [embed], 
                components: [buttons] 
            });

            this.setupCollector(interaction, reply, emojis);
        } catch (error) {
            console.error('Error in emojiStealer:', error);
            await interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#8B0000')
                        .setTitle('❌ An error occurred.')
                        .setDescription('An error occurred while processing your request, please try again later.')
                        .setImage(process.env.RedLine)
                ]
            });
        }
    },

    // ===== الدوال المساعدة ===== //
    extractEmojis(messages) {
        const uniqueEmojis = new Map();
        messages.forEach(msg => {
            const matches = msg.content.matchAll(/<a?:(\w+):(\d+)>/g);
            for (const [full, name, id] of matches) {
                if (!uniqueEmojis.has(id)) {
                    uniqueEmojis.set(id, {
                        name,
                        id,
                        animated: full.startsWith('<a:'),
                        full,
                        url: `https://cdn.discordapp.com/emojis/${id}.${full.startsWith('<a:') ? 'gif' : 'png'}`
                    });
                }
            }
        });
        return Array.from(uniqueEmojis.values());
    },

    createEmojiDisplay(emojis, index) {
        const emoji = emojis[index];
        const embed = new EmbedBuilder()
            .setTitle('🖼️ The detected emoji/s are:')
            .setDescription([
                `**Page:** ${index + 1}/${emojis.length}`,
                `**Name:** \`${emoji.name}\``,
                `**ID:** \`${emoji.id}\``,
                `**Emoji Link:** [Press Here](${emoji.url})`
            ].join('\n'))
            .setColor(process.env.Bluecolor)
            .setImage(emoji.url)
            .setFooter({ text: 'You can steal the emoji using the button below.' });

        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('prev_emoji')
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index === 0),
            new ButtonBuilder()
                .setCustomId('steal_emoji')
                .setLabel(`🕵️‍♂️ Steal ${emoji.name}`)
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('next_emoji')
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(index >= emojis.length - 1)
        );

        return { embed, buttons };
    },

    setupCollector(interaction, reply, emojis) {
        let currentIndex = 0;
        const collector = reply.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ 
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#8B0000')
                            .setDescription('❌ You don\'t have permission to use these buttons.')
                            .setImage(process.env.RedLine)
                    ],
                    ephemeral: true 
                });
            }

            await i.deferUpdate();

            try {
                if (i.customId === 'steal_emoji') {
                    await this.handleEmojiSteal(i, emojis[currentIndex], interaction.guild);
                    return;
                }

                currentIndex = i.customId === 'prev_emoji' ? currentIndex - 1 : currentIndex + 1;
                const { embed, buttons } = this.createEmojiDisplay(emojis, currentIndex);
                await i.editReply({ embeds: [embed], components: [buttons] });

            } catch (error) {
                console.error('Error in collector:', error);
                await i.followUp({ 
                    embeds: [
                        new EmbedBuilder()
                            .setColor('#FFA500')
                            .setDescription(`⚠️ An error occurred: ${error.message}`)
                            .setImage(process.env.OrangeLine)
                    ],
                    ephemeral: true 
                });
            }
        });

        collector.on('end', () => {
            reply.edit({ components: [] }).catch(() => {});
        });
    },

    async handleEmojiSteal(interaction, emoji, guild) {
        try {
            // التحقق من صلاحيات البوت
            if (!guild.members.me.permissions.has('ManageEmojisAndStickers')) {
                throw new Error('The bot does not have the Manage Emojis permission!');
            }

            // التحقق من عدد الإيموجيات المتاحة
            const emojiCount = await guild.emojis.fetch();
            if (emojiCount.size >= 50) {
                throw new Error('The server has reached the maximum emoji limit (50).');
            }

            // إنشاء الإيموجي الجديد
            const created = await guild.emojis.create({
                attachment: emoji.url,
                name: emoji.name,
                reason: `Stolen by ${interaction.user.tag}`
            });

            // إرسال رسالة النجاح
            const successEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('✅ Emoji stolen successfully!')
                .setDescription(`Emoji added successfully ${created} to the server.`)
                .setImage(process.env.BlueLine)
                .addFields(
                    { name: 'Name', value: `\`${created.name}\``, inline: true },
                    { name: 'ID', value: `\`${created.id}\``, inline: true }
                )
                .setThumbnail(created.url);

            await interaction.followUp({ 
                embeds: [successEmbed],
                ephemeral: true 
            });

        } catch (error) {
            console.error('Error stealing emoji:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Failed to steal the emoji')
                .setImage(process.env.RedLine)
                .setDescription(this.getErrorMessage(error));

            await interaction.followUp({ 
                embeds: [errorEmbed],
                ephemeral: true 
            });
        }
    },

    getErrorMessage(error) {
        if (error.code === 50013) {
            return 'Reason: **The bot does not have sufficient permissions.**\n' + 
                   'The bot needs the "Manage Emojis and Stickers" permission.';
        } else if (error.code === 30008) {
            return 'Reason: **There is not enough space for more emojis.**\n' +
                   'The server has reached the maximum limit (50 emojis).';
        } else if (error.message.includes('Invalid Form Body')) {
            return 'Reason: The emoji name is invalid.\n' +
                   'Reason: The emoji name must be between 2 and 32 characters long.';
        } else {
            return `**Reason:** ${error.message}`;
        }
    }
};