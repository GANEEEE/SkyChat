const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { google } = require('googleapis');

// إعداد الاتصال بجوجل شيت
const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_CREDS),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.WISHLIST_SHEET;

// إعدادات الألوان (HEX)
const COLORS = {
    DISCORD_TEXT: '#113961',    // كحلي غامق
    STEAM_TEXT: '#457BD5',      // أزرق فاتح
    BORDER: '#E0E0E0',          // رمادي فاتح للحدود
    SUCCESS: '#0073ff',         // أزرق للنجاح
    ERROR: '#8B0000',           // أحمر للخطأ
    WARNING: '#FFA500'          // برتقالي للتحذير
};

// دالة لتحويل HEX إلى RGB للجوجل شيت
function hexToRgb(hex) {
    hex = hex.replace('#', '');

    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    return { red: r, green: g, blue: b };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('giveawayentry')
        .setDescription('Add user to wishlist')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Discord user to add')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('steam')
                .setDescription('Steam account username')
                .setRequired(true)
                .setMaxLength(100)
        ),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: false });

        const user = interaction.options.getUser('user');
        const steam = interaction.options.getString('steam');

        // صلاحية ADMINISTRATOR فقط
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            const noPermEmbed = new EmbedBuilder()
                .setColor(COLORS.WARNING)
                .setTitle('⛔ Access Restricted')
                .setDescription('**Administrator permission required**\nOnly server administrators can use this command')

            return await interaction.editReply({ embeds: [noPermEmbed] });
        }

        try {
            const sheets = google.sheets({ version: 'v4', auth });

            // التحقق من وجود المستخدم
            const checkResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: 'A3:A',
            });

            const existingUsers = checkResponse.data.values || [];
            const exists = existingUsers.some(row => 
                row[0] && row[0].toString().trim().toLowerCase() === user.username.toLowerCase()
            );

            if (exists) {
                const existsEmbed = new EmbedBuilder()
                    .setColor(COLORS.ERROR)
                    .setTitle('⚠️ User Already Exists')
                    .setDescription(`**${user.username}** is already registered in the wishlist.`)
                    .addFields(
                        { name: 'Discord', value: user.username, inline: true },
                        { name: 'Status', value: 'Already exists', inline: true }
                    )
                    .setThumbnail(user.displayAvatarURL())
                    .setFooter({ text: 'Use /wishlistleaderboard to view all entries' })

                return await interaction.editReply({ embeds: [existsEmbed] });
            }

            // البحث عن صف فارغ
            let targetRow = 3;
            for (let i = 0; i < existingUsers.length; i++) {
                if (!existingUsers[i] || !existingUsers[i][0] || existingUsers[i][0].toString().trim() === '') {
                    targetRow = i + 3;
                    break;
                }
                if (i === existingUsers.length - 1) {
                    targetRow = existingUsers.length + 3;
                }
            }

            // إضافة البيانات
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: `A${targetRow}:B${targetRow}`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [[user.username, steam]]
                }
            });

            // تنسيق الخلايا
            const borderColor = hexToRgb(COLORS.BORDER);
            const discordColor = hexToRgb(COLORS.DISCORD_TEXT);
            const steamColor = hexToRgb(COLORS.STEAM_TEXT);

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SPREADSHEET_ID,
                resource: {
                    requests: [
                        // العمود A - Discord
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: targetRow - 1,
                                    endRowIndex: targetRow,
                                    startColumnIndex: 0,
                                    endColumnIndex: 1
                                },
                                cell: {
                                    userEnteredFormat: {
                                        horizontalAlignment: "CENTER",
                                        verticalAlignment: "MIDDLE",
                                        textFormat: {
                                            fontSize: 15,
                                            bold: true,
                                            foregroundColor: discordColor
                                        },
                                        backgroundColor: { red: 1, green: 1, blue: 1}
                                    }
                                },
                                fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat,backgroundColor)"
                            }
                        },
                        // العمود B - Steam
                        {
                            repeatCell: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: targetRow - 1,
                                    endRowIndex: targetRow,
                                    startColumnIndex: 1,
                                    endColumnIndex: 2
                                },
                                cell: {
                                    userEnteredFormat: {
                                        horizontalAlignment: "CENTER",
                                        verticalAlignment: "MIDDLE",
                                        textFormat: {
                                            fontSize: 15,
                                            bold: true,
                                            foregroundColor: steamColor
                                        },
                                        backgroundColor: { red: 1, green: 1, blue: 1 }
                                    }
                                },
                                fields: "userEnteredFormat(horizontalAlignment,verticalAlignment,textFormat,backgroundColor)"
                            }
                        },
                        // حدود
                        {
                            updateBorders: {
                                range: {
                                    sheetId: 0,
                                    startRowIndex: targetRow - 1,
                                    endRowIndex: targetRow,
                                    startColumnIndex: 0,
                                    endColumnIndex: 2
                                },
                                top: { style: "SOLID", width: 1, color: borderColor },
                                bottom: { style: "SOLID", width: 1, color: borderColor },
                                left: { style: "SOLID", width: 1, color: borderColor },
                                right: { style: "SOLID", width: 1, color: borderColor }
                            }
                        }
                    ]
                }
            });

            // إنشاء الـ Embed
            const successEmbed = new EmbedBuilder()
                .setColor(COLORS.SUCCESS)
                .setImage(process.env.BlueLine)
                .setDescription(`**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**\n` +
                                `> **Thank you for being a valued member of our community!**\n> **We truly appreciate you! <:MinecraftHeart:1395837661951819847>**\n\n` +
                                `> **Thank you for wishlisting!<:Stars:1416171237390028951> **\n> ***Your entry has been officially registered sucessfully in the list <:Milo_Notes:1416571523262709771>***\n\n` +
                                `> **Important Notice:**\n> We kindly request that you keep the game wishlisted even after the giveaway concludes.\n> This allows us to provide you with more exciting giveaways and updates in the future! <:Milo_Fire:1425580990889332836>\n\n` +
                                `> **Leaderboard Access:**\n> You can always check your status and view all participants using the **\`/wishlistleaderboard\`** command.\n> This feature remains available even after the giveaway ticket closes! <:Milo_Wink:1416559414109798481>\n\n` +
                                `> **Have an amazing day bud! <:MinecraftHeart:1395837661951819847>**\n` +
                                `> **Much appreciated for adding our game to your wishlist! <:Milo_Yeahh:1421940697862508654>**\n` +
                                `**━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━**`)
                .addFields(
                    { 
                        name: 'Discord', 
                        value: `${user.username}`, 
                        inline: true 
                    },
                    {
                        name: 'Row',
                        value: `${targetRow - 2}`,
                        inline: true
                    },
                    {
                        name: 'Status',
                        value: 'Successfully Added',
                        inline: true
                    }
                )

            await interaction.editReply({
                content: `<@${user.id}>`,
                embeds: [successEmbed],
                ephemeral: false
            });

        } catch (error) {
            console.error('Error:', error);

            const errorEmbed = new EmbedBuilder()
                .setColor(COLORS.ERROR)
                .setTitle('❌ Database Error')
                .setDescription('Unable to process your request')
                .addFields(
                    { name: 'Details', value: `\`${error.message.substring(0, 200)}\`` }
                )
                .setFooter({ text: 'Please try again or contact support' })

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};