const { SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

// رسومات المشنقة كصور (بدل النصوص)
const hangmanStages = [
    // Stage 0: Empty
    { body: false, head: false, torso: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
    // Stage 1: Head
    { body: false, head: true, torso: false, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
    // Stage 2: Head + Torso
    { body: false, head: true, torso: true, leftArm: false, rightArm: false, leftLeg: false, rightLeg: false },
    // Stage 3: Head + Torso + Left Arm
    { body: false, head: true, torso: true, leftArm: true, rightArm: false, leftLeg: false, rightLeg: false },
    // Stage 4: Head + Torso + Both Arms
    { body: false, head: true, torso: true, leftArm: true, rightArm: true, leftLeg: false, rightLeg: false },
    // Stage 5: Head + Torso + Both Arms + Left Leg
    { body: false, head: true, torso: true, leftArm: true, rightArm: true, leftLeg: true, rightLeg: false },
    // Stage 6: Complete (Head + Torso + Both Arms + Both Legs)
    { body: false, head: true, torso: true, leftArm: true, rightArm: true, leftLeg: true, rightLeg: true }
];

// قائمة كلمات موسعة
const extendedWordCategories = {
    animals: ['lion', 'tiger', 'bear', 'wolf', 'fox', 'elephant', 'giraffe', 'zebra', 'kangaroo', 'penguin', 'crocodile', 'dolphin', 'eagle', 'butterfly', 'rhinoceros', 'octopus', 'cheetah', 'gorilla', 'hippopotamus', 'camel'],
    fruits: ['apple', 'banana', 'orange', 'mango', 'strawberry', 'grape', 'kiwi', 'pineapple', 'watermelon', 'blueberry', 'peach', 'pear', 'cherry', 'pomegranate', 'coconut', 'papaya', 'guava', 'raspberry', 'blackberry', 'avocado'],
    countries: ['egypt', 'canada', 'brazil', 'japan', 'australia', 'germany', 'italy', 'mexico', 'india', 'china', 'france', 'spain', 'russia', 'argentina', 'turkey', 'thailand', 'vietnam', 'indonesia', 'morocco', 'kenya'],
    movies: ['avatar', 'titanic', 'inception', 'jaws', 'frozen', 'gladiator', 'casablanca', 'psycho', 'godfather', 'matrix', 'avengers', 'superman', 'batman', 'spiderman', 'terminator', 'alien', 'rocky', 'rambo', 'superman', 'superman'],
    sports: ['soccer', 'basketball', 'tennis', 'swimming', 'volleyball', 'baseball', 'cricket', 'boxing', 'hockey', 'golf', 'rugby', 'badminton', 'cycling', 'wrestling', 'gymnastics', 'surfing', 'skiing', 'athletics', 'karate', 'judo'],
    games: ['minecraft', 'fortnite', 'roblox', 'amongus', 'leagueoflegends', 'counterstrike', 'valorant', 'overwatch', 'pokemon', 'tetris', 'pacman', 'skyrim', 'fallout', 'gta', 'fifa', 'nba', 'callofduty', 'assassinscreed', 'residentevil', 'finalfantasy'],
    technology: ['computer', 'keyboard', 'monitor', 'mouse', 'laptop', 'tablet', 'smartphone', 'processor', 'motherboard', 'graphics', 'internet', 'website', 'software', 'hardware', 'database', 'algorithm', 'javascript', 'python', 'robotics', 'blockchain']
};

class HangmanGame {
    constructor(category, difficulty) {
        this.category = category;
        this.difficulty = difficulty;
        this.guessedLetters = new Set();
        this.incorrectGuesses = 0;
        this.maxIncorrect = 6;
        this.gameOver = false;
        this.winner = null;
    }

    // تهيئة اللعبة
    async initialize() {
        const words = extendedWordCategories[this.category] || extendedWordCategories.animals;
        this.word = words[Math.floor(Math.random() * words.length)];
        this.addHintLetters();
    }

    // إضافة حروف تلميحية بناءً على مستوى الصعوبة
    addHintLetters() {
        const letters = this.word.split('');
        const totalLetters = letters.length;

        let lettersToShow = 0;
        switch(this.difficulty) {
            case 'easy': lettersToShow = Math.ceil(totalLetters * 0.6); break;
            case 'medium': lettersToShow = Math.ceil(totalLetters * 0.4); break;
            case 'hard': lettersToShow = Math.ceil(totalLetters * 0.2); break;
            default: lettersToShow = Math.ceil(totalLetters * 0.4);
        }

        lettersToShow = Math.min(lettersToShow, totalLetters);
        const indices = Array.from({length: totalLetters}, (_, i) => i);

        for (let i = 0; i < lettersToShow; i++) {
            if (indices.length === 0) break;
            const randomIndex = Math.floor(Math.random() * indices.length);
            const letterIndex = indices.splice(randomIndex, 1)[0];
            this.guessedLetters.add(letters[letterIndex]);
        }
    }

    // عرض الكلمة مع الأحرف التي تم تخمينها
    getDisplayWord() {
        return this.word
            .split('')
            .map(letter => this.guessedLetters.has(letter) ? letter : '_')
            .join(' ');
    }

    // تخمين حرف
    guessLetter(letter) {
        if (this.gameOver || this.guessedLetters.has(letter)) {
            return false;
        }

        this.guessedLetters.add(letter);

        if (this.word.includes(letter)) {
            if (this.getDisplayWord().replace(/\s/g, '') === this.word) {
                this.gameOver = true;
                this.winner = true;
            }
            return true;
        } else {
            this.incorrectGuesses++;
            if (this.incorrectGuesses >= this.maxIncorrect) {
                this.gameOver = true;
                this.winner = false;
            }
            return false;
        }
    }

    // الحصول على الرسم الحالي للمشنقة
    getHangmanStage() {
        return hangmanStages[this.incorrectGuesses];
    }

    // الحصول على الأحرف المتاحة للتخمين
    getAvailableLetters() {
        const allLetters = 'abcdefghijklmnopqrstuvwxyz';
        return allLetters
            .split('')
            .filter(letter => !this.guessedLetters.has(letter))
            .slice(0, 25);
    }
}

// دالة لإنشاء صورة اللعبة
async function createHangmanImage(game, category, difficulty, lastGuess = null) {
    const width = 600; // تصغير العرض
    const height = 500; // تصغير الإرتفاع
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // خلفية متدرجة
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0f0f0f');
    bgGradient.addColorStop(1, '#1a1a1a');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // إطار متدرج ذهبي للشهرة - على الجانبين فقط
    const borderPadding = 0; // المسافة من الحواف
    ctx.strokeStyle = '#0073ff'; // لون الإطار ذهبي
    ctx.lineWidth = 5;           // سمك الإطار

    // رسم خطوط على الجانبين فقط
    ctx.beginPath();
    // الجانب الأيسر
    ctx.moveTo(borderPadding, borderPadding);
    ctx.lineTo(borderPadding, height - borderPadding);
    ctx.stroke();

    // العنوان
    ctx.fillStyle = '#0073ff';
    ctx.font = 'bold 32px Arial'; // تصغير خط العنوان
    ctx.textAlign = 'center';
    ctx.fillText('Hangman Game', width / 2, 40);

    // معلومات اللعبة - Category على الشمال (تحت العنوان)
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial'; // تصغير الخط
    ctx.textAlign = 'left';
    ctx.fillText(`Category: ${category.charAt(0).toUpperCase() + category.slice(1)}`, 20, 480);

    // Difficulty على اليمين (تحت العنوان)
    ctx.textAlign = 'right';
    ctx.fillText(`Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`, width - 20, 480);

    // Incorrect في المنتصف (تحت العنوان) - يتم عرضها فقط إذا لم تنته اللعبة
    if (!game.gameOver) {
        ctx.textAlign = 'center';
        ctx.fillText(`Incorrect: ${game.incorrectGuesses}/${game.maxIncorrect}`, width / 2, 70);
    }

    // رسم المشنقة (بقياس أصغر)
    drawHangman(ctx, game.getHangmanStage(), width / 2, 220);

    // حالة اللعبة - إذا انتهت اللعبة وخسر، نعرض Game Over في الأعلى
    if (game.gameOver && !game.winner) {
        ctx.fillStyle = '#FF4444';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Game Over', width / 2, 110);
    }

    // الكلمة المطلوبة
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px Arial'; // تصغير الخط
    ctx.textAlign = 'center';
    ctx.fillText(game.getDisplayWord(), width / 2, 350);

    // معلومات إضافية
    ctx.fillStyle = '#CCCCCC';
    ctx.font = '16px Arial'; // تصغير الخط

    // إذا انتهت اللعبة وخسر، نعرض Word length ثم The word was تحتها
    if (game.gameOver && !game.winner) {
        ctx.fillText(`Word length: ${game.word.length} letters`, width / 2, 390);
        ctx.fillStyle = '#0073ff';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`The word was: ${game.word.toUpperCase()}`, width / 2, 430);
    } else {
        // إذا اللعبة مستمرة أو فاز، نعرض Word length فقط
        ctx.fillText(`Word length: ${game.word.length} letters`, width / 2, 390);
    }

    // آخر تخمين
    if (lastGuess) {
        ctx.fillStyle = lastGuess.correct ? '#00FF88' : '#FF4444';
        ctx.font = 'bold 12px Arial'; // تصغير الخط
        ctx.fillText(`Last guess: ${lastGuess.user} - ${lastGuess.letter.toUpperCase()} (${lastGuess.correct ? 'Correct!' : 'Incorrect!'})`, width / 2, 455);
    }

    // حالة الفوز
    if (game.gameOver && game.winner) {
        ctx.fillStyle = '#00FF88';
        ctx.font = 'bold 28px Arial'; // تصغير الخط
        ctx.fillText('You Win!', width / 2, 110);
    }

    return canvas.toBuffer('image/png');
}

// دالة لرسم المشنقة (بقياس أصغر)
function drawHangman(ctx, stage, centerX, centerY) {
    // رسم المشنقة الأساسية
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 3; // تقليل سمك الخط

    // القاعدة
    ctx.beginPath();
    ctx.moveTo(centerX - 80, centerY + 80); // تصغير
    ctx.lineTo(centerX + 80, centerY + 80);
    ctx.stroke();

    // العمود
    ctx.beginPath();
    ctx.moveTo(centerX - 60, centerY + 80); // تصغير
    ctx.lineTo(centerX - 60, centerY - 60); // تصغير
    ctx.stroke();

    // العارضة العلوية
    ctx.beginPath();
    ctx.moveTo(centerX - 60, centerY - 60); // تصغير
    ctx.lineTo(centerX, centerY - 60); // تصغير
    ctx.stroke();

    // الحبل
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - 60); // تصغير
    ctx.lineTo(centerX, centerY - 40); // تصغير
    ctx.stroke();

    // رسم الجسم إذا كانت اللعبة مستمرة
    ctx.strokeStyle = '#FF4444';
    ctx.lineWidth = 4; // تقليل سمك الخط

    // الرأس
    if (stage.head) {
        ctx.beginPath();
        ctx.arc(centerX, centerY - 25, 20, 0, Math.PI * 2); // تصغير الرأس
        ctx.stroke();
    }

    // الجذع
    if (stage.torso) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY - 5); // تصغير
        ctx.lineTo(centerX, centerY + 25); // تصغير
        ctx.stroke();
    }

    // الذراع الأيسر
    if (stage.leftArm) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY); // تصغير
        ctx.lineTo(centerX - 25, centerY + 15); // تصغير
        ctx.stroke();
    }

    // الذراع الأيمن
    if (stage.rightArm) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY); // تصغير
        ctx.lineTo(centerX + 25, centerY + 15); // تصغير
        ctx.stroke();
    }

    // الرجل اليسرى
    if (stage.leftLeg) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + 25); // تصغير
        ctx.lineTo(centerX - 25, centerY + 55); // تصغير
        ctx.stroke();
    }

    // الرجل اليمنى
    if (stage.rightLeg) {
        ctx.beginPath();
        ctx.moveTo(centerX, centerY + 25); // تصغير
        ctx.lineTo(centerX + 25, centerY + 55); // تصغير
        ctx.stroke();
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hangman')
        .setDescription('Play a game of hangman!')
        .addStringOption(option =>
            option
                .setName('category')
                .setDescription('Select a word category')
                .setRequired(true)
                .addChoices(
                    { name: 'Animals', value: 'animals' },
                    { name: 'Fruits', value: 'fruits' },
                    { name: 'Countries', value: 'countries' },
                    { name: 'Movies', value: 'movies' },
                    { name: 'Sports', value: 'sports' },
                    { name: 'Games', value: 'games' },
                    { name: 'Technology', value: 'technology' }
                ))
        .addStringOption(option =>
            option
                .setName('difficulty')
                .setDescription('Select game difficulty')
                .setRequired(false)
                .addChoices(
                    { name: 'Easy', value: 'easy' },
                    { name: 'Medium', value: 'medium' },
                    { name: 'Hard', value: 'hard' }
                )),

    async execute(interaction) {
        await interaction.deferReply();

        const category = interaction.options.getString('category');
        const difficulty = interaction.options.getString('difficulty') || 'medium';

        const game = new HangmanGame(category, difficulty);
        await game.initialize();

        // إنشاء الصورة الأولى
        const buffer = await createHangmanImage(game, category, difficulty);
        const attachment = new AttachmentBuilder(buffer, { name: 'hangman.png' });

        // إنشاء أزرار الأحرف
        const availableLetters = game.getAvailableLetters();
        const letterRows = [];

        // تقسيم الأحرف إلى صفوف (5 أزرار في كل صف)
        const rowsCount = Math.min(5, Math.ceil(availableLetters.length / 5));
        for (let i = 0; i < rowsCount; i++) {
            const rowLetters = availableLetters.slice(i * 5, (i + 1) * 5);
            const row = new ActionRowBuilder();

            rowLetters.forEach(letter => {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`letter_${letter}`)
                        .setLabel(letter.toUpperCase())
                        .setStyle(ButtonStyle.Primary)
                );
            });

            letterRows.push(row);
        }

        // إرسال الرسالة الأولى
        const message = await interaction.editReply({ 
            files: [attachment],
            components: letterRows 
        });

        // إنشاء مجمع للتفاعلات
        const filter = i => i.customId.startsWith('letter_') && !i.user.bot;
        const collector = message.createMessageComponentCollector({ filter, time: 300000 }); // 5 دقائق

        collector.on('collect', async i => {
            if (game.gameOver) {
                await i.reply({ content: 'This game has already ended!', ephemeral: true });
                return;
            }

            const letter = i.customId.split('_')[1];
            const isCorrect = game.guessLetter(letter);

            // تحديث الأحرف المتاحة
            const newAvailableLetters = game.getAvailableLetters();
            const newLetterRows = [];

            const newRowsCount = Math.min(5, Math.ceil(newAvailableLetters.length / 5));
            for (let i = 0; i < newRowsCount; i++) {
                const rowLetters = newAvailableLetters.slice(i * 5, (i + 1) * 5);
                const row = new ActionRowBuilder();

                rowLetters.forEach(ltr => {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`letter_${ltr}`)
                            .setLabel(ltr.toUpperCase())
                            .setStyle(ButtonStyle.Primary)
                    );
                });

                newLetterRows.push(row);
            }

            // إنشاء الصورة المحدثة
            const newBuffer = await createHangmanImage(
                game, 
                category, 
                difficulty, 
                { user: i.user.username, letter, correct: isCorrect }
            );
            const newAttachment = new AttachmentBuilder(newBuffer, { name: 'hangman.png' });

            // إذا انتهت اللعبة
            if (game.gameOver) {
                // تعطيل جميع الأزرار
                const disabledRows = [];
                for (let i = 0; i < newRowsCount; i++) {
                    const rowLetters = newAvailableLetters.slice(i * 5, (i + 1) * 5);
                    const row = new ActionRowBuilder();

                    rowLetters.forEach(ltr => {
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`letter_${ltr}`)
                                .setLabel(ltr.toUpperCase())
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );
                    });

                    disabledRows.push(row);
                }

                await i.update({ 
                    files: [newAttachment],
                    components: disabledRows 
                });

                collector.stop();
            } else {
                await i.update({ 
                    files: [newAttachment],
                    components: newLetterRows 
                });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time' && !game.gameOver) {
                // إنشاء صورة النهاية بسبب الوقت
                createHangmanImage(game, category, difficulty).then(timeoutBuffer => {
                    const timeoutAttachment = new AttachmentBuilder(timeoutBuffer, { name: 'hangman_timeout.png' });

                    // تعطيل جميع الأزرار
                    const disabledRows = [];
                    const availableLetters = game.getAvailableLetters();
                    const rowsCount = Math.min(5, Math.ceil(availableLetters.length / 5));

                    for (let i = 0; i < rowsCount; i++) {
                        const rowLetters = availableLetters.slice(i * 5, (i + 1) * 5);
                        const row = new ActionRowBuilder();

                        rowLetters.forEach(letter => {
                            row.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`letter_${letter}`)
                                    .setLabel(letter.toUpperCase())
                                    .setStyle(ButtonStyle.Secondary)
                                    .setDisabled(true)
                            );
                        });

                        disabledRows.push(row);
                    }

                    interaction.editReply({ 
                        files: [timeoutAttachment],
                        components: disabledRows 
                    });
                });
            }
        });
    }
};