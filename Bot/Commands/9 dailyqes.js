const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');

// دالة لفك تشفير النص HTML (لأن API يرجع النص مشفراً)
function decodeHtml(html) {
    return html
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&eacute;/g, 'é')
        .replace(/&ouml;/g, 'ö')
        .replace(/&uuml;/g, 'ü')
        .replace(/&auml;/g, 'ä')
        .replace(/&aring;/g, 'å')
        .replace(/&oslash;/g, 'ø')
        .replace(/&iacute;/g, 'í')
        .replace(/&ntilde;/g, 'ñ');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Start a daily trivia challenge')
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Select a category for the trivia')
                .setRequired(false)
                .addChoices(
                    { name: 'General Knowledge', value: '9' },
                    { name: 'Books', value: '10' },
                    { name: 'Film', value: '11' },
                    { name: 'Music', value: '12' },
                    { name: 'Video Games', value: '15' },
                    { name: 'Science & Nature', value: '17' },
                    { name: 'Computers', value: '18' },
                    { name: 'Mathematics', value: '19' },
                    { name: 'Mythology', value: '20' },
                    { name: 'Sports', value: '21' },
                    { name: 'Geography', value: '22' },
                    { name: 'History', value: '23' },
                    { name: 'Animals', value: '27' }
                ))
        .addStringOption(option =>
            option
                .setName('difficulty')
                .setDescription('Select difficulty level')
                .setRequired(false)
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const category = interaction.options.getString('category') || null;
        const difficulty = interaction.options.getString('difficulty') || null;

        try {
            // بناء رابط API مع الخيارات المحددة
            let apiUrl = 'https://opentdb.com/api.php?amount=1&type=multiple&encode=url3986';
            if (category) apiUrl += `&category=${category}`;
            if (difficulty) apiUrl += `&difficulty=${difficulty}`;

            // جلب سؤال من API
            const response = await axios.get(apiUrl);
            const questionData = response.data.results[0];

            if (!questionData) {
                const errorEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('❌ API Error')
                    .setImage(process.env.RedLine)
                    .setDescription('Could not fetch a trivia question. Please try again later.');
                return interaction.editReply({ embeds: [errorEmbed] });
            }

            // فك تشفير البيانات
            const question = decodeHtml(decodeURIComponent(questionData.question));
            const correctAnswer = decodeHtml(decodeURIComponent(questionData.correct_answer));
            const incorrectAnswers = questionData.incorrect_answers.map(ans => 
                decodeHtml(decodeURIComponent(ans))
            );

            // خلط الإجابات
            const allAnswers = [correctAnswer, ...incorrectAnswers];
            for (let i = allAnswers.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
            }

            // حفظ الفهرس الصحيح بعد الخلط
            const correctIndex = allAnswers.indexOf(correctAnswer);
            const answerLetters = ['A', 'B', 'C', 'D'];

            // إنشاء زرود للاختيارات
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('answer_0')
                        .setLabel('A')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('answer_1')
                        .setLabel('B')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('answer_2')
                        .setLabel('C')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('answer_3')
                        .setLabel('D')
                        .setStyle(ButtonStyle.Primary)
                );

            // إنشاء embed للسؤال
            const questionEmbed = new EmbedBuilder()
                .setColor(process.env.Bluecolor)
                .setTitle('🧠 Daily Trivia Challenge')
                .setDescription(`**Category:** ${decodeHtml(decodeURIComponent(questionData.category))}\n**Difficulty:** ${questionData.difficulty.charAt(0).toUpperCase() + questionData.difficulty.slice(1)}\n\n**${question}**`)
                .setImage(process.env.BlueLine)
                .addFields(
                    { name: 'Options', value: allAnswers.map((ans, i) => `${answerLetters[i]}. ${ans}`).join('\n') }
                )
                .setFooter({ text: 'You have 30 seconds to answer!' })
                .setTimestamp();

            // إرسال السؤال
            const message = await interaction.editReply({ 
                embeds: [questionEmbed], 
                components: [row] 
            });

            // إنشاء مجمع للتفاعلات
            const filter = i => i.customId.startsWith('answer_') && i.user.id === interaction.user.id;
            const collector = message.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                filter, 
                time: 30000 
            });

            let answered = false;

            collector.on('collect', async i => {
                if (answered) return;
                answered = true;

                const selectedIndex = parseInt(i.customId.split('_')[1]);
                const isCorrect = selectedIndex === correctIndex;

                // تحديث الأزرار لتظهر الإجابة الصحيحة
                const updatedRow = new ActionRowBuilder();
                for (let j = 0; j < 4; j++) {
                    let style = ButtonStyle.Secondary;
                    if (j === correctIndex) style = ButtonStyle.Success;
                    else if (j === selectedIndex && !isCorrect) style = ButtonStyle.Danger;

                    updatedRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`answer_${j}`)
                            .setLabel(answerLetters[j])
                            .setStyle(style)
                            .setDisabled(true)
                    );
                }

                // إنشاء embed للنتيجة
                const resultEmbed = new EmbedBuilder()
                    .setColor(isCorrect ? process.env.Bluecolor : '#ff0000')
                    .setTitle(isCorrect ? '✅ Correct!' : '❌ Incorrect!')
                    .setDescription(isCorrect 
                        ? `Well done, <@${i.user.id}>! You got it right.` 
                        : `Sorry, <@${i.user.id}>. The correct answer was **${correctAnswer}**.`)
                    .addFields(
                        { name: 'Question', value: question },
                        { name: 'Your Answer', value: allAnswers[selectedIndex] },
                        { name: 'Correct Answer', value: correctAnswer }
                    )
                    .setTimestamp();

                await i.update({ 
                    embeds: [questionEmbed, resultEmbed], 
                    components: [updatedRow] 
                });

                collector.stop();
            });

            collector.on('end', collected => {
                if (!answered) {
                    // تحديث الأزرار لتظهر الإجابة الصحيحة عند انتهاء الوقت
                    const updatedRow = new ActionRowBuilder();
                    for (let j = 0; j < 4; j++) {
                        let style = j === correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary;

                        updatedRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`answer_${j}`)
                                .setLabel(answerLetters[j])
                                .setStyle(style)
                                .setDisabled(true)
                        );
                    }

                    const timeoutEmbed = new EmbedBuilder()
                        .setColor('#FFA500')
                        .setTitle('⏰ Time\'s Up!')
                        .setDescription(`Time has run out! The correct answer was **${correctAnswer}**.`)
                        .setImage(process.env.OrangeLine)
                        .setTimestamp();

                    interaction.editReply({ 
                        embeds: [questionEmbed, timeoutEmbed], 
                        components: [updatedRow] 
                    });
                }
            });

        } catch (error) {
            console.error('Error in trivia command:', error);
            const errorEmbed = new EmbedBuilder()
                .setColor('#8B0000')
                .setTitle('❌ Error')
                .setDescription('An error occurred while fetching the trivia question.')
                .setImage(process.env.RedLine)
                .addFields(
                    { name: 'Details', value: error.message.substring(0, 1000) }
                );
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};