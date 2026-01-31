const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// دالة محسنة لتوليد معادلات معقدة
function generateMathProblem(difficulty) {
    // إذا كانت الصعوبة عشوائية، نختار مستوى عشوائي
    if (difficulty === 'random') {
        const difficulties = ['easy', 'medium', 'hard', 'expert'];
        difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
    }

    let problem;
    let answer;

    switch(difficulty) {
        case 'easy':
            // مسائل أساسية مع عمليات مختلطة
            const easyOps = ['+', '-', '*'];
            const num1 = Math.floor(Math.random() * 20) + 1;
            const num2 = Math.floor(Math.random() * 20) + 1;
            const easyOp = easyOps[Math.floor(Math.random() * easyOps.length)];

            problem = `${num1} ${easyOp === '*' ? '×' : easyOp} ${num2}`;
            answer = eval(`${num1} ${easyOp} ${num2}`);
            break;

        case 'medium':
            // مسائل بثلاثة أرقام وعمليتين
            const medNum1 = Math.floor(Math.random() * 25) + 1;
            const medNum2 = Math.floor(Math.random() * 15) + 1;
            const medNum3 = Math.floor(Math.random() * 10) + 1;

            const medOps = ['+', '-', '*'];
            const op1 = medOps[Math.floor(Math.random() * medOps.length)];
            const op2 = medOps[Math.floor(Math.random() * medOps.length)];

            // نتأكد من عدم وجود أرقام سالبة
            if (op1 === '-' && op2 === '-') {
                problem = `${medNum1 + medNum2 + medNum3} - ${medNum2} - ${medNum3}`;
                answer = medNum1;
            } else {
                problem = `${medNum1} ${op1 === '*' ? '×' : op1} ${medNum2} ${op2 === '*' ? '×' : op2} ${medNum3}`;
                answer = eval(`${medNum1} ${op1} ${medNum2} ${op2} ${medNum3}`);
            }
            break;

        case 'hard':
            // مسائل معقدة بأقواس وأربع عمليات
            const hardTypes = [
                'nested_operations', 
                'mixed_operations', 
                'larger_calculations',
                'division_combinations'
            ];
            const hardType = hardTypes[Math.floor(Math.random() * hardTypes.length)];

            switch(hardType) {
                case 'nested_operations':
                    // عمليات متداخلة بأقواس متعددة
                    const a = Math.floor(Math.random() * 15) + 1;
                    const b = Math.floor(Math.random() * 12) + 1;
                    const c = Math.floor(Math.random() * 8) + 1;
                    const d = Math.floor(Math.random() * 6) + 1;

                    if (Math.random() > 0.5) {
                        problem = `(${a} × ${b}) + (${c} × ${d})`;
                        answer = (a * b) + (c * d);
                    } else {
                        problem = `(${a} + ${b}) × (${c} + ${d})`;
                        answer = (a + b) * (c + d);
                    }
                    break;

                case 'mixed_operations':
                    // خلط جميع العمليات
                    const x = Math.floor(Math.random() * 20) + 1;
                    const y = Math.floor(Math.random() * 15) + 1;
                    const z = Math.floor(Math.random() * 10) + 1;

                    problem = `${x} × ${y} + ${z}`;
                    answer = (x * y) + z;

                    if (Math.random() > 0.5) {
                        problem = `${x} + ${y} × ${z}`;
                        answer = x + (y * z);
                    }
                    break;

                case 'larger_calculations':
                    // حسابات بأرقام كبيرة
                    const big1 = Math.floor(Math.random() * 40) + 10;
                    const big2 = Math.floor(Math.random() * 20) + 5;
                    const big3 = Math.floor(Math.random() * 15) + 5;

                    problem = `${big1} × ${big2} - ${big3}`;
                    answer = (big1 * big2) - big3;
                    break;

                case 'division_combinations':
                    // مسائل قسمة مع عمليات أخرى
                    const div1 = Math.floor(Math.random() * 12) + 2;
                    const div2 = Math.floor(Math.random() * 8) + 2;
                    const mult = Math.floor(Math.random() * 10) + 1;
                    const add = Math.floor(Math.random() * 20) + 1;

                    const dividend = div1 * div2 * mult;
                    problem = `(${dividend} ÷ ${div1}) × ${mult} + ${add}`;
                    answer = (dividend / div1) * mult + add;
                    break;
            }
            break;

        case 'expert':
            // استخدام دالة Expert الموجودة
            const expertProblem = generateExpertProblem();
            problem = expertProblem.problem;
            answer = expertProblem.answer;
            break;
    }

    // توليد إجابات خاطئة ذكية
    const wrongAnswers = generateSmartWrongAnswers(answer, difficulty);

    // خلط الإجابات
    const allAnswers = [answer, ...wrongAnswers];
    for (let i = allAnswers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }

    return {
        problem: problem,
        answer: answer,
        allAnswers: allAnswers,
        correctIndex: allAnswers.indexOf(answer),
        actualDifficulty: difficulty // نخزن الصعوبة الفعلية
    };
}

// دالة محسنة لتوليد إجابات خاطئة ذكية
function generateSmartWrongAnswers(correctAnswer, difficulty) {
    const wrongAnswers = [];

    while (wrongAnswers.length < 3) {
        let wrongOption;
        const baseAnswer = correctAnswer;

        switch(difficulty) {
            case 'easy':
                // أخطاء شائعة في العمليات البسيطة
                const easyMistakes = [
                    baseAnswer + Math.floor(Math.random() * 5) + 1,
                    baseAnswer - Math.floor(Math.random() * 5) - 1,
                    Math.floor(baseAnswer * 1.5),
                    Math.floor(baseAnswer * 0.8)
                ];
                wrongOption = easyMistakes[Math.floor(Math.random() * easyMistakes.length)];
                break;

            case 'medium':
                // أخطاء في أولوية العمليات
                const mediumMistakes = [
                    baseAnswer + (Math.random() > 0.5 ? 2 : -2),
                    baseAnswer + (Math.random() > 0.5 ? 5 : -5),
                    Math.floor(baseAnswer * 1.2),
                    Math.floor(baseAnswer * 0.9),
                    baseAnswer + 10 * (Math.random() > 0.5 ? 1 : -1)
                ];
                wrongOption = mediumMistakes[Math.floor(Math.random() * mediumMistakes.length)];
                break;

            case 'hard':
            case 'expert':
                // أخطاء مخادعة جداً
                const hardMistakes = [
                    baseAnswer + (Math.random() > 0.5 ? 1 : -1), // فرق 1 فقط
                    baseAnswer + (Math.floor(Math.random() * 3) - 1), // فرق -1, 0, 1
                    Math.floor(baseAnswer + baseAnswer * 0.1), // زيادة 10%
                    Math.floor(baseAnswer - baseAnswer * 0.1), // نقصان 10%
                    baseAnswer + (correctAnswer % 10), // إضافة أو طرح آخر رقم
                    baseAnswer - (correctAnswer % 10)
                ];
                wrongOption = hardMistakes[Math.floor(Math.random() * hardMistakes.length)];
                break;
        }

        // التأكد من أن الإجابة الخاطئة مقبولة
        if (wrongOption !== correctAnswer && 
            wrongOption > 0 && 
            !wrongAnswers.includes(wrongOption) &&
            Math.abs(wrongOption - correctAnswer) < correctAnswer * 0.5) {

            wrongAnswers.push(Math.floor(wrongOption));
        }

        // منع التكرار اللانهائي
        if (wrongAnswers.length === 0 && Math.random() > 0.8) {
            wrongAnswers.push(correctAnswer + 1);
            wrongAnswers.push(correctAnswer - 1);
            wrongAnswers.push(correctAnswer + 2);
        }
    }

    return wrongAnswers;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quickmath')
        .setDescription('Start a quick math challenge! Test your calculation speed.')
        .addStringOption(option =>
            option
                .setName('difficulty')
                .setDescription('Select difficulty level')
                .setRequired(false)
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' },
                    { name: 'Expert', value: 'expert' },
                    { name: 'Random', value: 'random' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const difficulty = interaction.options.getString('difficulty') || 'random';

        // تحديد الوقت
        let timeLimit;
        let actualDifficulty = difficulty;

        if (difficulty === 'random') {
            const difficulties = [
                { level: 'easy', time: 15000 },
                { level: 'medium', time: 12000 },
                { level: 'hard', time: 15000 },
                { level: 'expert', time: 20000 }
            ];
            const randomDiff = difficulties[Math.floor(Math.random() * difficulties.length)];
            timeLimit = randomDiff.time;
            actualDifficulty = randomDiff.level;
        } else {
            switch(difficulty) {
                case 'easy': timeLimit = 15000; break;
                case 'medium': timeLimit = 12000; break;
                case 'hard': timeLimit = 15000; break;
                case 'expert': timeLimit = 20000; break;
            }
        }

        // توليد المسألة
        const problem = generateMathProblem(difficulty);
        const finalDifficulty = problem.actualDifficulty || actualDifficulty;

        // إنشاء أزرار تحتوي على الأرقام مباشرة
        const row = new ActionRowBuilder();

        problem.allAnswers.forEach((answer, index) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`answer_${index}`)
                    .setLabel(answer.toString())
                    .setStyle(ButtonStyle.Primary)
            );
        });

        // إنشاء embed للمسألة بدون عرض الخيارات
        const difficultyEmojis = {
            'easy': '🟢',
            'medium': '🟡', 
            'hard': '🔴',
            'expert': '💀'
        };

        const difficultyNames = {
            'easy': 'Easy',
            'medium': 'Medium', 
            'hard': 'Hard',
            'expert': 'Expert'
        };

        const problemEmbed = new EmbedBuilder()
            .setColor(getDifficultyColor(finalDifficulty))
            .setTitle('🧠 Quick Math Challenge')
            .setDescription(`${difficultyEmojis[finalDifficulty]} **Difficulty:** ${difficultyNames[finalDifficulty]}\n⏱️ **Time Limit:** ${timeLimit/1000} seconds\n\n**Solve this equation:**\n# ${problem.problem} = ?\n\n**Click on the correct answer below!**`)
            .setImage(process.env.BlueLine)
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })

        // إرسال المسألة
        const message = await interaction.editReply({ 
            embeds: [problemEmbed], 
            components: [row] 
        });

        // إنشاء مجمع للتفاعلات
        const filter = i => i.customId.startsWith('answer_') && i.user.id === interaction.user.id;
        const collector = message.createMessageComponentCollector({ 
            filter, 
            time: timeLimit 
        });

        let answered = false;
        let winner = null;

        collector.on('collect', async i => {
            if (answered) return;
            answered = true;

            const selectedIndex = parseInt(i.customId.split('_')[1]);
            const isCorrect = selectedIndex === problem.correctIndex;
            const selectedAnswer = problem.allAnswers[selectedIndex];

            winner = i.user;

            // تحديث الأزرار لتظهر النتيجة
            const updatedRow = new ActionRowBuilder();

            problem.allAnswers.forEach((answer, index) => {
                let style = ButtonStyle.Secondary;
                if (index === problem.correctIndex) {
                    style = ButtonStyle.Success;
                } else if (index === selectedIndex && !isCorrect) {
                    style = ButtonStyle.Danger;
                }

                updatedRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`answer_${index}`)
                        .setLabel(answer.toString())
                        .setStyle(style)
                        .setDisabled(true)
                );
            });

            const resultEmbed = new EmbedBuilder()
                .setColor(isCorrect ? getDifficultyColor(finalDifficulty) : '#8B0000')
                .setTitle(isCorrect ? '✅ Correct Answer!' : '❌ Incorrect Answer!')
                .setDescription(isCorrect 
                    ? `**${winner.tag}** solved the ${finalDifficulty} problem correctly! 🎉\n\`${problem.problem} = ${problem.answer}\`` 
                    : `**${winner.tag}** selected **${selectedAnswer}** which is incorrect!\nThe correct answer was **${problem.answer}**\n\`${problem.problem} = ${problem.answer}\``)
                .setTimestamp();

            await i.update({ 
                embeds: [problemEmbed, resultEmbed], 
                components: [updatedRow] 
            });

            collector.stop();
        });

        collector.on('end', collected => {
            if (!answered) {
                // تحديث الأزرار عند انتهاء الوقت
                const updatedRow = new ActionRowBuilder();

                problem.allAnswers.forEach((answer, index) => {
                    let style = index === problem.correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary;

                    updatedRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`answer_${index}`)
                            .setLabel(answer.toString())
                            .setStyle(style)
                            .setDisabled(true)
                    );
                });

                const timeoutEmbed = new EmbedBuilder()
                    .setColor('#8B0000')
                    .setTitle('⏰ Time\'s Up!')
                    .setImage(process.env.RedLine)
                    .setDescription(`No one solved the problem in time!\nThe correct answer was **${problem.answer}**\n\`${problem.problem} = ${problem.answer}\``)
                    .setTimestamp();

                interaction.editReply({ 
                    embeds: [problemEmbed, timeoutEmbed], 
                    components: [updatedRow] 
                });
            }
        });
    }
};

// دالة مساعدة للألوان حسب الصعوبة
function getDifficultyColor(difficulty) {
    switch(difficulty) {
        case 'easy': return '#00FF00';
        case 'medium': return '#FFFF00'; 
        case 'hard': return '#FF0000';
        case 'expert': return '#800080';
        default: return process.env.Bluecolor;
    }
}

// دالة خاصة لمستوى Expert
function generateExpertProblem() {
    const expertTypes = [
        'triple_operations',
        'nested_parentheses', 
        'fraction_operations',
        'complex_division'
    ];

    const expertType = expertTypes[Math.floor(Math.random() * expertTypes.length)];
    let problem, answer;

    switch(expertType) {
        case 'triple_operations':
            const a = Math.floor(Math.random() * 12) + 1;
            const b = Math.floor(Math.random() * 10) + 1;
            const c = Math.floor(Math.random() * 8) + 1;
            const d = Math.floor(Math.random() * 6) + 1;

            problem = `(${a} × ${b}) + (${c} × ${d}) - ${Math.floor((a+b)/2)}`;
            answer = (a * b) + (c * d) - Math.floor((a+b)/2);
            break;

        case 'nested_parentheses':
            const x = Math.floor(Math.random() * 10) + 1;
            const y = Math.floor(Math.random() * 8) + 1;
            const z = Math.floor(Math.random() * 6) + 1;

            problem = `((${x} + ${y}) × ${z}) ÷ 2`;
            answer = ((x + y) * z) / 2;
            break;

        case 'fraction_operations':
            const num1 = Math.floor(Math.random() * 8) + 2;
            const num2 = Math.floor(Math.random() * 6) + 2;
            const num3 = Math.floor(Math.random() * 10) + 1;

            problem = `(${num1 * num3} ÷ ${num1}) × ${num2}`;
            answer = num3 * num2;
            break;

        case 'complex_division':
            const div1 = Math.floor(Math.random() * 15) + 5;
            const div2 = Math.floor(Math.random() * 10) + 2;
            const add = Math.floor(Math.random() * 20) + 5;

            problem = `((${div1 * div2} ÷ ${div1}) + ${add}) × 2`;
            answer = (div2 + add) * 2;
            break;
    }

    const wrongAnswers = generateSmartWrongAnswers(answer, 'expert');
    const allAnswers = [answer, ...wrongAnswers];

    for (let i = allAnswers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allAnswers[i], allAnswers[j]] = [allAnswers[j], allAnswers[i]];
    }

    return {
        problem: problem,
        answer: answer,
        allAnswers: allAnswers,
        correctIndex: allAnswers.indexOf(answer)
    };
}