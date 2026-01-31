const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const dbManager = require('../Data/database');
const axios = require('axios');

// نفس الدوال اللي في testerpanel.js
function extractAppId(steamUrl) {
    const match = steamUrl.match(/app\/(\d+)/);
    return match ? match[1] : null;
}

async function getPanelInfo() {
    const result = await dbManager.get(
        'SELECT panel_channel_id, panel_message_id, current_game_link FROM tester_panel_settings WHERE id = 1'
    );
    return result;
}

async function updateGameLink(gameLink) {
    await dbManager.run(
        'UPDATE tester_panel_settings SET current_game_link = $1, updated_at = CURRENT_TIMESTAMP WHERE id = 1',
        [gameLink]
    );
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('updatetesterpanel')
        .setDescription('Update the game link in tester panel')
        .addStringOption(option =>
            option.setName('game_link')
                .setDescription('New Steam game link')
                .setRequired(true)),

    async execute(interaction) {
        try {
            // التحقق من Moderate Role
            const moderateRoleData = await dbManager.getBotSetting('moderateRole');

            if (!moderateRoleData) {
                const embed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Moderate Role Not Set')
                    .setImage(process.env.RedLine)
                    .setDescription('Moderation role not assigned, Please configure the role to enable moderation features by `/setrole`.');
                return await interaction.reply({ embeds: [embed], flags: 64 });
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
                    .setDescription(`This command is available only for <@&${roleInfo.id}>`);
                return await interaction.reply({ embeds: [embed], flags: 64 });
            }

            await interaction.deferReply({ flags: 64 });

            const gameLink = interaction.options.getString('game_link');

            // تحقق من أن اللينك steam
            if (!gameLink.includes('store.steampowered.com/app/')) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ Invalid Steam Link')
                    .setDescription('Please provide a valid Steam store link (should contain `store.steampowered.com/app/`)')
                    .setImage(process.env.RedLine);
                return await interaction.editReply({ embeds: [errorEmbed] });
            }

            // حدث الـ game link في الجدول
            await updateGameLink(gameLink);

            // جيب معلومات الـ panel
            const panelInfo = await getPanelInfo();

            if (panelInfo && panelInfo.panel_channel_id && panelInfo.panel_message_id) {
                try {
                    const channel = await interaction.client.channels.fetch(panelInfo.panel_channel_id);
                    const message = await channel.messages.fetch(panelInfo.panel_message_id);

                    const appId = extractAppId(gameLink);
                    let gameHeaderImage = process.env.BlueLine;

                    try {
                        const appDetailsResponse = await axios.get(
                            `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=US&l=en`
                        );

                        const details = appDetailsResponse.data[appId];
                        if (details && details.success) {
                            gameHeaderImage = details.data.header_image;
                        }
                    } catch (error) {
                        console.error('Error fetching game details:', error);
                    }

                    // أنشئ embed جديد
                    const oldEmbed = message.embeds[0];
                    const newEmbed = EmbedBuilder.from(oldEmbed)
                        .setImage(gameHeaderImage)
                        .spliceFields(4, 1, { 
                            name: '🎮 Game Link', 
                            value: gameLink, 
                            inline: false 
                        });

                    // عدل الرسالة
                    await message.edit({ 
                        embeds: [newEmbed]
                    });

                    const successEmbed = new EmbedBuilder()
                        .setColor(process.env.Bluecolor)
                        .setTitle('✅ Tester Panel Updated')
                        .setDescription(`Game link has been updated successfully!`)
                        .addFields(
                            { name: 'New Game', value: gameLink, inline: false },
                            { name: 'Updated By', value: interaction.user.toString(), inline: true }
                        )
                        .setImage(process.env.BlueLine);

                    await interaction.editReply({ 
                        embeds: [successEmbed] 
                    });

                } catch (error) {
                    console.error('Error updating panel message:', error);

                    const warningEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⚠️ Partial Update')
                        .setDescription('Game link saved in database, but could not update the existing panel message.')
                        .addFields(
                            { name: 'New Link', value: gameLink, inline: false },
                            { name: 'Note', value: 'Use `/testerspanel` to refresh the panel display.', inline: false }
                        )
                        .setImage(process.env.OrangeLine);

                    await interaction.editReply({ 
                        embeds: [warningEmbed] 
                    });
                }
            } else {
                const infoEmbed = new EmbedBuilder()
                    .setColor(process.env.Bluecolor)
                    .setTitle('✅ Game Link Saved')
                    .setDescription('Game link has been saved to database!')
                    .addFields(
                        { name: 'New Link', value: gameLink, inline: false },
                        { name: 'Next Step', value: 'Use `/testerspanel` to create or update the panel display.', inline: false }
                    )
                    .setImage(process.env.BlueLine);

                await interaction.editReply({ 
                    embeds: [infoEmbed] 
                });
            }

        } catch (error) {
            console.error('Error updating tester panel:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error Updating Panel')
                .setDescription('An error occurred while updating the tester panel. Please try again.')
                .setImage(process.env.RedLine);

            await interaction.editReply({ 
                embeds: [errorEmbed] 
            });
        }
    }
};