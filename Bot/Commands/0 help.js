const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

// دالة لإنشاء البيانات ديناميكياً علشان نتجنب التكرار
function getCategories() {
    return {
        moderation: {
            name: '<:Moderationbg:1412839158958919691> Moderation',
            description: 'Administrative commands for server management',
            color: process.env.Bluecolor,
            commands: {
                '<:Invites:1412839239812648990> Invites Management': [
                    { name: 'fixinviter', description: 'Fix missing inviter for a member and update statistics' },
                    { name: 'inviteadd', description: 'Add invites to a user' },
                    { name: 'inviteremove', description: 'Remove invites from a user' },
                    { name: 'resetinviter', description: 'Completely reset all invite statistics and records for a user' },
                ],
                '<:Fame:1412839233852538900> Fame Management': [
                    { name: 'fameadd', description: 'Add fame points to a user' },
                    { name: 'fameremove', description: 'Remove fame points from a user' },
                ],
                '<:Shame:1412839253544534087> Shame Management': [
                    { name: 'shameadd', description: 'Add shame points to a user' },
                    { name: 'shameremove', description: 'Remove shame points from a user' },
                ],
                '<:Leaderboardbg:1412839148947247187> Leaderboards': [
                    { name: 'livefame', description: 'Setup live fame updates in a channel (Admins)' },
                    { name: 'liveshame', description: 'Setup live shame updates in a channel (Admins)' },
                    { name: 'livemessage', description: 'Setup live message updates in a channel (Admins)' }
                ],
                '<:Role:1412843255795810484> Role Management': [
                    { name: 'showrole', description: 'Show configured moderation role' },
                    { name: 'giverole', description: 'Assign a role to a user' },
                    { name: 'removerole', description: 'Remove a role from a user' },
                    { name: 'temprole', description: 'Assign a temprole from a user' },
                    { name: 'temproleremove', description: 'Remove a temprole from a user' }
                ],
                '🧪 Testers Panel': [
                    { name: 'testerspanel', description: 'Sign up to become a game tester panel' },
                    { name: 'updatetesterpanel', description: 'Update the game link in tester panel' }, // ⭐ موجود هنا
                    { name: 'cleartesters', description: 'Clear aLL testers applications data from database' },
                ],
                '<:Steam:1395464198301024296> Verify System': [
                    { name: 'verifyadd', description: 'Manually add a verified account' },
                    { name: 'verifylist', description: 'List all verified accounts' },
                    { name: 'verifysearch', description: 'Search for veriifed accounts' },
                    { name: 'verify me', description: 'Start the self verification process' },
                    { name: 'verify panel', description: 'Create verification panel' },
                ],
                '<:Settings:1412839247513391154> Setup': [
                    { name: 'setrole', description: 'Set moderation role for the server' },
                    { name: 'logchannel', description: 'Set the log channel for moderation actions' },
                ],
                '<:Stars:1416171237390028951> Wishlist Add': [
                    { name: 'giveawayentry', description: 'Add user to wishlist' },
                ],
                'Chat Core': [
                    { name: 'reset', description: 'Reset Sky Coins and daily limits' },
                    { name: 'shopedit', description: 'Manage server shop items' },
                    { name: 'giftwallet', description: 'Add coins, crystals, or XP to a user' },
                    { name: 'giftcrate', description: 'Add crates to a user' },
                ]
            }
        },
        leaderboards: {
            name: '<:Community:1431350272558632970> Community',
            description: 'Awesome commands for our amazing community',
            color: process.env.Bluecolor,
            commands: {
                '<:Leaderboard:1412843835318599810> Leaderboards': [
                    { name: 'inviteleaderboard', description: 'Show invites leaderboard' },
                    { name: 'messageleader', description: 'Show message leaderboard' },
                    { name: 'wishlistleader', description: 'Show wishlist leaderboard' },
                    { name: 'gameleaderboard', description: 'Show games leaderboard' },
                    { name: 'fameleaderboard', description: 'Show fame leaderboard' },
                    { name: 'shameleaderboard', description: 'Show shame leaderboard' },
                ],
                '<:InfoAccount:1416157704929546353> Statistics': [
                    { name: 'invitestats', description: 'Check user invites stats' },
                    { name: 'messages', description: 'Check user fame stats' },
                    { name: 'famestats', description: 'Check user fame stats' },
                    { name: 'shamestats', description: 'Check user shame stats' },
                ],
                '<:Steam:1395464198301024296> Steam Tools': [
                    { name: 'game', description: 'Search for Steam games' },
                    { name: 'steamrandom', description: 'Get a random Steam game' }
                ],
                '<:Alarm:1429538046986158220> TempRole': [
                    { name: 'temproleinfo', description: 'Check your temporary roles or specific user roles' },
                ],
                'Chat Core': [
                    { name: 'daily', description: 'Claim your daily rewards' },
                    { name: 'weekly', description: 'Claim your weekly rewards' },
                    { name: 'exchange', description: 'Exchange Sky Crystals for Coins' },
                    { name: 'drops', description: 'View and open your drop crates' },
                    { name: 'goals', description: 'View your daily and weekly missions' },
                    { name: 'progress', description: 'View Sever/Your progress in different reward systems' },
                    { name: 'rank', description: 'Show user statistics' },
                    { name: 'rates', description: 'View all reward rates and probabilities' },
                    { name: 'setwallpaper', description: 'Set wallpaper for your rank card' },
                    { name: 'shop', description: 'Check server shop items' },
                    { name: 'makeawish', description: 'Throw coins or crystals into the Skywell' },
                    { name: 'voice-status', description: 'Check current voice system status' },
                ],
            }
        },
        fun: {
            name: '<:Gamesbg:1412839132836921344> Fun & Games',
            description: 'Entertainment and game commands',
            color: process.env.Bluecolor,
            commands: {
                '<:Games:1412844095289823273> Games': [
                    { name: 'dailyqa', description: 'Daily quiz' },
                    { name: 'hangman', description: 'Play hangman game' },
                    { name: 'littlegame', description: 'Play a little game' },
                    { name: 'quickmath', description: 'Quick math challenge' },
                    { name: 'lair', description: 'Lair minigame' }
                ]
            }
        },
        utilities: {
            name: '<:Utliesbg:1412839166924030044> Utilities',
            description: 'Useful utility commands and tools',
            color: process.env.Bluecolor,
            commands: {
                '<:Toolbox:1412839264084951192> Utilities': [
                    { name: 'emojiStealer', description: 'Steal emojis from messages' },
                    { name: 'help', description: 'Show this help menu' },
                    { name: 'clear', description: 'Clear messages from channel' }
                ]
            }
        }
    };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Display all available commands with categories'),

    async execute(interaction, client) {
        // استخدام الدالة علشان نجيب البيانات
        const categories = getCategories();

        // إنشاء القائمة المنسدلة
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('Select a category')
            .addOptions([
                {
                    label: 'Moderation',
                    description: 'Administrative commands',
                    value: 'moderation',
                    emoji: '1412839158958919691'
                },
                {
                    label: 'Community',
                    description: 'View rankings and statistics',
                    value: 'leaderboards',
                    emoji: '1431350272558632970'
                },
                {
                    label: 'Fun & Games',
                    description: 'Entertainment commands',
                    value: 'fun',
                    emoji: '1412839132836921344'
                },
                {
                    label: 'Utilities',
                    description: 'Utility commands',
                    value: 'utilities',
                    emoji: '1412839166924030044'
                }
            ]);

        const row = new ActionRowBuilder()
            .addComponents(selectMenu);

        // Embed الافتراضي
        const mainEmbed = new EmbedBuilder()
            .setTitle('<:Infobg:1412839140407378062> Center Core')
            .setDescription('Welcome to the help menu! Select a category from the dropdown below to view available commands:\n\n')
            .setColor(process.env.Bluecolor)
            .setThumbnail(client.user.displayAvatarURL())
            .addFields(
                { name: '<:Moderation:1412853069603012638> Moderation', value: 'Administrative tools for server management', inline: false},
                { name: '<:Community:1431350272558632970> Community', value: 'Awesome commands for our amazing community', inline: false},
                { name: '<:Games:1412844095289823273> Fun & Games', value: 'Entertainment and game commands', inline: false},
                { name: '<:Toolbox:1412839264084951192> Utilities', value: 'Useful utility commands and tools', inline:false}
            )
            .setImage('https://i.ibb.co/7dHZB5x9/Helping-Banner.png')
            .setTimestamp()
            .setFooter({ 
                text: `Requested by ${interaction.user.username}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        await interaction.reply({ 
            embeds: [mainEmbed], 
            components: [row]
        });
    },

    // ⭐⭐ الـ handler المعدل ⭐⭐
    async selectMenuHandler(interaction) {
        if (interaction.customId === 'help_menu') {
            // استخدام نفس الدالة علشان نجيب البيانات المحدثة
            const categories = getCategories();
            const category = interaction.values[0];

            if (categories[category]) {
                const categoryData = categories[category];
                const embed = new EmbedBuilder()
                    .setTitle(`${categoryData.name} Commands`)
                    .setDescription(categoryData.description)
                    .setColor(categoryData.color)
                    .setThumbnail(interaction.client.user.displayAvatarURL())
                    .setImage(process.env.BlueLine);

                for (const [subcategoryName, commands] of Object.entries(categoryData.commands)) {
                    const commandsList = commands.map(cmd => 
                        `• **/${cmd.name}** - ${cmd.description}`
                    ).join('\n');

                    embed.addFields({
                        name: subcategoryName,
                        value: commandsList,
                        inline: false
                    });
                }

                // إعادة إنشاء القائمة المنسدلة للحفاظ على التفاعل
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('help_menu')
                    .setPlaceholder('Select a category')
                    .addOptions([
                        {
                            label: 'Moderation',
                            description: 'Administrative commands',
                            value: 'moderation',
                            emoji: '1412839158958919691'
                        },
                        {
                            label: 'Community',
                            description: 'View rankings and statistics',
                            value: 'leaderboards',
                            emoji: '1431350272558632970'
                        },
                        {
                            label: 'Fun & Games',
                            description: 'Entertainment commands',
                            value: 'fun',
                            emoji: '1412839132836921344'
                        },
                        {
                            label: 'Utilities',
                            description: 'Utility commands',
                            value: 'utilities',
                            emoji: '1412839166924030044'
                        }
                    ]);

                const row = new ActionRowBuilder()
                    .addComponents(selectMenu);

                await interaction.update({ embeds: [embed], components: [row] });
            }
        }
    }
};