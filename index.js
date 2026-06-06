/* ===============================
   PokeChaos — Full RPG Discord Bot
   CLEANED + FIXED + IMPROVED
   =============================== */

const { Client, GatewayIntentBits, Partials, PermissionsBitField, EmbedBuilder } = require("discord.js");
const fetch = require("node-fetch");
const ms = require("ms");

// ===============================
// KEYS (USE ENV VARIABLES)
// ===============================

const TOKEN = process.env.TOKEN;

// ===============================
// DISCORD CLIENT
// ===============================

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

// SINGLE READY EVENT
client.once("ready", () => {
    console.log(`Bot is fully online as ${client.user.tag}`);
});

// ===============================
// GLOBALS
// ===============================

const PREFIX = ">";
const commands = {};

const aiChatEnabled = {};

const economy = {};
const dailyCooldown = {};

const unoGames = {};
const hangmanGames = {};
const hangmanWords = ["apple", "banana", "dragon", "pokemon", "discord", "chaos"];

const blackjackGames = {};

// auto-spawn (Pokétwo-style)
let messageCount = 0;
const spawnThreshold = 15;
const channelSpawns = {};

// OWNER ID (for owner-only spawn)
const OWNER_ID = "YOUR_USER_ID_HERE";

// HELPER FUNCTIONS
// ===============================

function getUserBalance(id) {
    if (!economy[id]) economy[id] = { coins: 100 };
    return economy[id].coins;
}

function addCoins(id, amount) {
    getUserBalance(id);
    economy[id].coins += amount;
}

function removeCoins(id, amount) {
    getUserBalance(id);
    economy[id].coins -= amount;
}

function formatHangmanWord(word, guessed) {
    return [...word].map(c => guessed.includes(c) ? c : "-").join("");
}

const unoDeck = [
    "R1","R2","R3","R4","R5","R6","R7","R8","R9",
    "G1","G2","G3","G4","G5","G6","G7","G8","G9",
    "B1","B2","B3","B4","B5","B6","B7","B8","B9",
    "Y1","Y2","Y3","Y4","Y5","Y6","Y7","Y8","Y9"
];

function drawUnoCard() {
    return unoDeck[Math.floor(Math.random() * unoDeck.length)];
}

function drawCard() {
    const cards = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
    return cards[Math.floor(Math.random() * cards.length)];
}

function calculateHand(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        if (card === "A") {
            aces++;
            total += 11;
        } else if (["J","Q","K"].includes(card)) {
            total += 10;
        } else {
            total += parseInt(card);
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }

    return total;
}

// ===============================
// COMMAND SYSTEM
// ===============================

async function handleCommand(message, commandName, args) {
    if (commands[commandName]) {
        return commands[commandName](message, args);
    } else {
        return message.reply("❓ **Unknown command.** Use `>help`.");
    }
}

// ===============================
// MAIN MESSAGE HANDLER
// ===============================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    // AI AUTO-CHAT DISABLED SAFELY
    if (aiChatEnabled[message.channel.id] && !message.content.startsWith(PREFIX)) {
        return; // do nothing, prevents crashes
    }

    // auto-spawn based on chat activity (Pokétwo-style)
    if (!message.content.startsWith(PREFIX)) {
        messageCount++;
        if (messageCount >= spawnThreshold) {
            messageCount = 0;
            if (Math.random() < 0.4) {
                await spawnRandomPokemonChannel(message.channel);
            }
        }
        return;
    }

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return;

    try {
        await handleCommand(message, commandName, args);
    } catch (err) {
        console.error(err);
        message.reply("⚠️ **Error running command.**");
    }
});
// ===============================
// BASIC COMMANDS
// ===============================

commands.ping = async (message) => {
    message.reply("🏓 **Pong!**");
};

commands.help = async (message) => {
    message.reply(
        "📜 **PokeChaos Command Menu**\n" +
        "🔧 Moderation: `>kick`, `>ban`, `>unban`, `>mute`, `>unmute`, `>clear`\n" +
        "💰 Economy: `>balance`, `>daily`, `>give`, `>leaderboard`\n" +
        "🎰 Gambling: `>coinflip`, `>slots`, `>blackjack`, `>hit`, `>stand`\n" +
        "🎮 Games: `>uno`, `>hangman`, `>guess`, `>hangmanend`\n" +
        "⚔️ Pokémon: `>pokemon`, `>pokedex`, `>spawn`, `>ownerspawn`, `>catch`, `>catchwild`, `>team`, `>release`, `>trade`, `>fight`, `>boss`, `>fightboss`, `>gigantamax`, `>mega`, `>shop`, `>buy`, `>use`\n" +
        "🤖 AI: `>chat on/off` (disabled)\n" +
        "🧭 Utility: `>ping`, `>uptime`"
    );
};

commands.uptime = async (message) => {
    const totalSeconds = Math.floor(process.uptime());
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    message.reply(`⏱️ **Uptime:** ${hours}h ${minutes}m ${seconds}s`);
};

// ===============================
// MODERATION COMMANDS
// ===============================

commands.kick = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
        return message.reply("🚫 **You don't have permission to kick.**");

    const target = message.mentions.members.first();
    if (!target) return message.reply("👤 **Mention someone to kick.**");

    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
        await target.kick(reason);
        message.reply(`🦵 **Kicked** ${target.user.tag}.`);
    } catch {
        message.reply("⚠️ **Failed to kick user.**");
    }
};

commands.ban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("🚫 **You don't have permission to ban.**");

    const target = message.mentions.members.first();
    if (!target) return message.reply("👤 **Mention someone to ban.**");

    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
        await target.ban({ reason });
        message.reply(`🔨 **Banned** ${target.user.tag}.`);
    } catch {
        message.reply("⚠️ **Failed to ban user.**");
    }
};

commands.unban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("🚫 **You don't have permission to unban.**");

    const userId = args[0];
    if (!userId) return message.reply("🆔 **Provide a user ID to unban.**");

    try {
        await message.guild.members.unban(userId);
        message.reply(`🔓 **Unbanned** user ID: ${userId}`);
    } catch {
        message.reply("⚠️ **Failed to unban user.**");
    }
};

commands.mute = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("🚫 **You don't have permission to mute.**");

    const target = message.mentions.members.first();
    if (!target) return message.reply("👤 **Mention someone to mute.**");

    const duration = args[1] || "10m";

    try {
        await target.timeout(ms(duration));
        message.reply(`🔇 **Muted** ${target.user.tag} for ${duration}.`);
    } catch {
        message.reply("⚠️ **Failed to mute user.**");
    }
};

commands.unmute = async (message) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("🚫 **You don't have permission to unmute.**");

    const target = message.mentions.members.first();
    if (!target) return message.reply("👤 **Mention someone to unmute.**");

    try {
        await target.timeout(null);
        message.reply(`🔊 **Unmuted** ${target.user.tag}.`);
    } catch {
        message.reply("⚠️ **Failed to unmute user.**");
    }
};

commands.clear = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
        return message.reply("🚫 **You don't have permission to clear messages.**");

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100)
        return message.reply("🔢 **Provide a number between 1 and 100.**");

    try {
        await message.channel.bulkDelete(amount, true);
        message.reply(`🧹 **Deleted** ${amount} messages.`);
    } catch {
        message.reply("⚠️ **Failed to delete messages.**");
    }
};

// ===============================
// UNO GAME
// ===============================

commands.uno = async (message, args) => {
    const sub = args[0];
    const guildId = message.guild.id;

    if (!sub) return message.reply("🟥 **UNO Commands:** `>uno start`, `>uno join`, `>uno hand`, `>uno draw`, `>uno play <card>`, `>uno end`");

    if (sub === "start") {
        if (unoGames[guildId])
            return message.reply("🟥 **Uno game already running.**");

        unoGames[guildId] = {
            players: {},
            order: [],
            topCard: drawUnoCard(),
            started: true
        };

        return message.reply(`🟥 **Uno game started!** Top card: \`${unoGames[guildId].topCard}\``);
    }

    if (sub === "join") {
        const game = unoGames[guildId];
        if (!game) return message.reply("🟥 **No Uno game running.**");

        if (game.players[message.author.id])
            return message.reply("🟥 **You already joined Uno.**");

        game.players[message.author.id] = [
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard()
        ];

        game.order.push(message.author.id);

        return message.reply(`🟥 **${message.author.username} joined Uno.**`);
    }

    if (sub === "hand") {
        const game = unoGames[guildId];
        if (!game) return message.reply("🟥 **No Uno game running.**");

        const hand = game.players[message.author.id];
        if (!hand) return message.reply("🟥 **You are not in the game.**");

        try {
            await message.author.send(`🟥 **Your Uno hand:** ${hand.join(", ")}`);
            message.reply("📩 **I sent your hand in DMs.**");
        } catch {
            message.reply("⚠️ **I couldn't DM you your hand. Enable DMs and try again.**");
        }
    }

    if (sub === "draw") {
        const game = unoGames[guildId];
        if (!game) return message.reply("🟥 **No Uno game running.**");

        const hand = game.players[message.author.id];
        if (!hand) return message.reply("🟥 **You are not in the game.**");

        const card = drawUnoCard();
        hand.push(card);

        return message.reply(`🟥 **${message.author.username} drew a card.**`);
    }

    if (sub === "play") {
        const game = unoGames[guildId];
        if (!game) return message.reply("🟥 **No Uno game running.**");

        const hand = game.players[message.author.id];
        if (!hand) return message.reply("🟥 **You are not in the game.**");

        const card = args[1];
        if (!card) return message.reply("🟥 **Specify a card to play.** Example: `>uno play R5`");

        if (!hand.includes(card))
            return message.reply("🟥 **You don't have that card.**");

        const top = game.topCard;
        if (card[0] !== top[0] && card[1] !== top[1])
            return message.reply("🟥 **Card does not match color or number.**");

        game.topCard = card;
        game.players[message.author.id] = hand.filter(c => c !== card);

        return message.reply(`🟥 **${message.author.username} played \`${card}\`.** New top card: \`${card}\``);
    }

    if (sub === "end") {
        if (!unoGames[guildId])
            return message.reply("🟥 **No Uno game running.**");

        delete unoGames[guildId];
        return message.reply("🟥 **Uno game ended.**");
    }
};

// ===============================
// HANGMAN GAME
// ===============================

commands.hangman = async (message) => {
    const guildId = message.guild.id;

    if (hangmanGames[guildId])
        return message.reply("🪓 **A Hangman game is already running.**");

    const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
    hangmanGames[guildId] = {
        word,
        guessed: [],
        wrong: 0
    };

    const display = formatHangmanWord(word, []);
    message.reply(`🪓 **Hangman started!**\nWord: \`${display}\`\nGuess letters with \`>guess a\``);
};

commands.guess = async (message, args) => {
    const guildId = message.guild.id;
    const game = hangmanGames[guildId];

    if (!game) return message.reply("🪓 **No Hangman game running.**");

    const letter = args[0]?.toLowerCase();
    if (!letter || letter.length !== 1)
        return message.reply("🪓 **Guess one letter.** Example: `>guess a`");

    if (game.guessed.includes(letter))
        return message.reply("🪓 **You already guessed that letter.**");

    game.guessed.push(letter);

    if (!game.word.includes(letter)) {
        game.wrong++;
        if (game.wrong >= 6) {
            delete hangmanGames[guildId];
            return message.reply(`💀 Wrong! You lost. The word was: ${game.word}`);
        }
        const display = formatHangmanWord(game.word, game.guessed);
        return message.reply(`🪓 Wrong guess! Mistakes: ${game.wrong}/6\nWord: ${display}`);
    }

    const display = formatHangmanWord(game.word, game.guessed);
    const won = !display.includes("-");

    if (won) {
        delete hangmanGames[guildId];
        return message.reply(`🎉 You won! The word was: ${game.word}`);
    }

    return message.reply(`✅ Correct!\nWord: ${display}`);
};

commands.hangmanend = async (message) => {
    const guildId = message.guild.id;

    if (!hangmanGames[guildId])
        return message.reply("🪓 No Hangman game running.");

    delete hangmanGames[guildId];
    return message.reply("🪓 Hangman game ended.");
};

// ===============================
// ECONOMY + GAMBLING
// ===============================

commands.balance = async (message) => {
    const coins = getUserBalance(message.author.id);
    await message.reply(`💰 You have ${coins} coins.`);
};

commands.daily = async (message) => {
    const id = message.author.id;
    const now = Date.now();

    if (dailyCooldown[id] && now - dailyCooldown[id] < 86400000) {
        return message.reply("⏳ You already claimed your daily reward today.");
    }

    dailyCooldown[id] = now;
    addCoins(id, 200);

    await message.reply("🎁 You claimed your daily reward of 200 coins!");
};

commands.give = async (message, args) => {
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target) return message.reply("👤 Mention someone to give coins to.");
    if (!amount || amount <= 0) return message.reply("🔢 Enter a valid amount.");

    const senderCoins = getUserBalance(message.author.id);
    if (senderCoins < amount) return message.reply("💸 You don't have enough coins.");

    removeCoins(message.author.id, amount);
    addCoins(target.id, amount);

    await message.reply(`💸 You gave ${amount} coins to ${target.username}.`);
};

commands.leaderboard = async (message) => {
    const sorted = Object.entries(economy)
        .sort((a, b) => b[1].coins - a[1].coins)
        .slice(0, 10);

    let text = "🏆 Top 10 Richest Users:\n";

    for (let i = 0; i < sorted.length; i++) {
        const [id, data] = sorted[i];
        const user = await message.guild.members.fetch(id).catch(() => null);
        if (user) {
            text += `${i + 1}. ${user.user.username} — ${data.coins} coins\n`;
        }
    }

    await message.reply(text);
};

const coinImages = {
    heads: "https://i.imgur.com/2WZtODK.png",
    tails: "https://i.imgur.com/8fFQZtT.png"
};

commands.coinflip = async (message, args) => {
    const bet = parseInt(args[0]);
    const choice = args[1]?.toLowerCase();

    if (!bet || bet <= 0) return message.reply("🔢 Enter a valid bet amount.");
    if (!choice || !["heads", "tails"].includes(choice))
        return message.reply("🪙 Choose heads or tails.");

    const coins = getUserBalance(message.author.id);
    if (coins < bet) return message.reply("💸 You don't have enough coins.");

    const result = Math.random() < 0.5 ? "heads" : "tails";

    let replyText = `🪙 Coinflip Result: ${result}\n`;
    replyText += result === choice ? "🎉 You won!" : "💀 You lost.";

    if (result === choice) addCoins(message.author.id, bet);
    else removeCoins(message.author.id, bet);

    await message.reply({
        content: replyText,
        files: [coinImages[result]]
    });
};

const slotIcons = ["🍒", "🍋", "⭐", "💎", "7️⃣"];

commands.slots = async (message, args) => {
    const bet = parseInt(args[0]);
    if (!bet || bet <= 0) return message.reply("🔢 Enter a valid bet amount.");

    const coins = getUserBalance(message.author.id);
    if (coins < bet) return message.reply("💸 You don't have enough coins.");

    const roll = [
        slotIcons[Math.floor(Math.random() * slotIcons.length)],
        slotIcons[Math.floor(Math.random() * slotIcons.length)],
        slotIcons[Math.floor(Math.random() * slotIcons.length)]
    ];

    let resultText = `🎰 Slots:\n[ ${roll[0]} | ${roll[1]} | ${roll[2]} ]\n`;

    if (roll[0] === roll[1] && roll[1] === roll[2]) {
        addCoins(message.author.id, bet * 5);
        resultText += "💎 JACKPOT! You won 5x your bet!";
    } else if (roll[0] === roll[1] || roll[1] === roll[2] || roll[0] === roll[2]) {
        addCoins(message.author.id, bet * 2);
        resultText += "⭐ Nice! You won 2x your bet!";
    } else {
        removeCoins(message.author.id, bet);
        resultText += "💀 You lost.";
    }

    await message.reply(resultText);
};

commands.blackjack = async (message, args) => {
    const bet = parseInt(args[0]);
    if (!bet || bet <= 0) return message.reply("🔢 Enter a valid bet amount.");

    const coins = getUserBalance(message.author.id);
    if (coins < bet) return message.reply("💸 You don't have enough coins.");

    blackjackGames[message.author.id] = {
        bet,
        player: [drawCard(), drawCard()],
        dealer: [drawCard(), drawCard()]
    };

    const game = blackjackGames[message.author.id];
    const playerTotal = calculateHand(game.player);

    await message.reply(
        "🃠 Blackjack Started!\n" +
        `Your cards: ${game.player.join(", ")} (Total: ${playerTotal})\n` +
        `Dealer shows: ${game.dealer[0]}\n` +
        "Use >hit or >stand"
    );
};

commands.hit = async (message) => {
    const game = blackjackGames[message.author.id];
    if (!game) return message.reply("🃠 You are not in a blackjack game.");

    game.player.push(drawCard());
    const total = calculateHand(game.player);

    if (total > 21) {
        removeCoins(message.author.id, game.bet);
        delete blackjackGames[message.author.id];
        return message.reply(`💀 You busted with ${total}. You lost ${game.bet} coins.`);
    }

    await message.reply(`🃠 Your cards: ${game.player.join(", ")} (Total: ${total})`);
};

commands.stand = async (message) => {
    const game = blackjackGames[message.author.id];
    if (!game) return message.reply("🃠 You are not in a blackjack game.");

    let dealerTotal = calculateHand(game.dealer);

    while (dealerTotal < 17) {
        game.dealer.push(drawCard());
        dealerTotal = calculateHand(game.dealer);
    }

    const playerTotal = calculateHand(game.player);

    let result = "";

    if (dealerTotal > 21 || playerTotal > dealerTotal) {
        addCoins(message.author.id, game.bet);
        result = `🎉 You win! Dealer had ${dealerTotal}.`;
    } else if (playerTotal < dealerTotal) {
        removeCoins(message.author.id, game.bet);
        result = `💀 You lose. Dealer had ${dealerTotal}.`;
    } else {
        result = `🤝 It's a tie.`;
    }

    delete blackjackGames[message.author.id];

    await message.reply(
        `🃠 Dealer's cards: ${game.dealer.join(", ")} (Total: ${dealerTotal})\n` +
        result
    );
};
// ===============================
// POKEMON SYSTEM
// ===============================

commands.pokemon = async (message) => {
    const id = Math.floor(Math.random() * 151) + 1;
    const poke = await getPokemon(id);

    if (!poke) return message.reply("⚠️ Failed to fetch Pokémon.");

    if (poke.image) {
        await message.reply({
            content: `🐾 Random Pokémon: ${poke.name.toUpperCase()}\nType: ${poke.types.join(", ")}`,
            files: [poke.image]
        });
    } else {
        await message.reply(`🐾 Random Pokémon: ${poke.name.toUpperCase()}\nType: ${poke.types.join(", ")}\n(No image available)`);
    }
};

commands.pokedex = async (message, args) => {
    const query = args[0];
    if (!query) return message.reply("📖 Provide a Pokémon name or ID.");

    const poke = await getPokemon(query.toLowerCase());
    if (!poke) return message.reply("📖 Pokémon not found.");

    if (poke.image) {
        await message.reply({
            content: `📖 Pokédex: ${poke.name.toUpperCase()} (#${poke.id})\nType: ${poke.types.join(", ")}`,
            files: [poke.image]
        });
    } else {
        await message.reply(`📖 Pokédex: ${poke.name.toUpperCase()} (#${poke.id})\nType: ${poke.types.join(", ")}\n(No image available)`);
    }
};

// legacy player spawn (kept)
commands.spawn = async (message) => {
    ensurePlayer(message.author.id);

    const id = Math.floor(Math.random() * 151) + 1;
    const poke = await getPokemon(id);

    if (!poke) return message.reply("⚠️ Failed to spawn Pokémon.");

    const instance = createPokemonInstance(poke);
    pokemonPlayers[message.author.id].spawn = instance;

    if (instance.image) {
        await message.reply({
            content: `🌿 A wild ${instance.name.toUpperCase()} appeared!\nUse >catch to try catching it.`,
            files: [instance.image]
        });
    } else {
        await message.reply(`🌿 A wild ${instance.name.toUpperCase()} appeared!\nUse >catch to try catching it.\n(No image available)`);
    }
};

// OWNER-ONLY SPAWN (any Pokémon by name or ID)
commands.ownerspawn = async (message, args) => {
    if (message.author.id !== OWNER_ID) {
        return message.reply("Only the owner can use this command.");
    }

    const query = args.join(" ").toLowerCase();
    if (!query) return message.reply("Specify a Pokémon name or ID.");

    const poke = await getPokemon(query);
    if (!poke) return message.reply("⚠️ Failed to fetch Pokémon.");

    const instance = createPokemonInstance(poke);
    channelSpawns[message.channel.id] = instance;

    if (instance.image) {
        await message.channel.send({
            content: `🌿 A wild ${instance.name.toUpperCase()} appeared! (Owner Spawn)\nUse >catchwild to try catching it.`,
            files: [instance.image]
        });
    } else {
        await message.channel.send(`🌿 A wild ${instance.name.toUpperCase()} appeared! (Owner Spawn)\nUse >catchwild to try catching it.\n(No image available)`);
    }
};

// auto-spawn helper (Pokétwo-style)
async function spawnRandomPokemonChannel(channel) {
    const id = Math.floor(Math.random() * 151) + 1;
    const poke = await getPokemon(id);
    if (!poke) return;

    const instance = createPokemonInstance(poke);
    channelSpawns[channel.id] = instance;

    if (instance.image) {
        await channel.send({
            content: `🌿 A wild ${instance.name.toUpperCase()} appeared!\nUse >catchwild to try catching it.`,
            files: [instance.image]
        });
    } else {
        await channel.send(`🌿 A wild ${instance.name.toUpperCase()} appeared!\nUse >catchwild to try catching it.\n(No image available)`);
    }
}

commands.catch = async (message) => {
    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    if (!player.spawn) return message.reply("🎯 No Pokémon to catch. Use >spawn first.");

    if (player.items.pokeball <= 0 && player.items.greatball <= 0 && player.items.ultraball <= 0 && player.items.masterball <= 0)
        return message.reply("🎯 You have no Pokéballs! Buy some with >shop.");

    let ball = "pokeball";
    let catchBonus = 0;

    if (player.items.masterball > 0) {
        ball = "masterball";
        catchBonus = 1.0;
    } else if (player.items.ultraball > 0) {
        ball = "ultraball";
        catchBonus = 0.3;
    } else if (player.items.greatball > 0) {
        ball = "greatball";
        catchBonus = 0.15;
    }

    player.items[ball]--;

    const baseChance = 0.4;
    const chance = baseChance + catchBonus;

    if (Math.random() > chance) {
        player.spawn = null;
        return message.reply(`💨 The Pokémon escaped! Your ${ball} was used.`);
    }

    player.team.push(player.spawn);
    const caught = player.spawn;
    player.spawn = null;

    gainXp(player, 10);

    await message.reply(`🎉 You caught ${caught.name.toUpperCase()}! (+10 XP)\nUse >team to view your Pokémon.`);
};

// catch from channel auto-spawn / owner spawn
commands.catchwild = async (message) => {
    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    const wild = channelSpawns[message.channel.id];
    if (!wild) return message.reply("🎯 No wild Pokémon in this channel.");

    if (player.items.pokeball <= 0 && player.items.greatball <= 0 && player.items.ultraball <= 0 && player.items.masterball <= 0)
        return message.reply("🎯 You have no Pokéballs! Buy some with >shop.");

    let ball = "pokeball";
    let catchBonus = 0;

    if (player.items.masterball > 0) {
        ball = "masterball";
        catchBonus = 1.0;
    } else if (player.items.ultraball > 0) {
        ball = "ultraball";
        catchBonus = 0.3;
    } else if (player.items.greatball > 0) {
        ball = "greatball";
        catchBonus = 0.15;
    }

    player.items[ball]--;

    const baseChance = 0.4;
    const chance = baseChance + catchBonus;

    if (Math.random() > chance) {
        channelSpawns[message.channel.id] = null;
        return message.reply(`💨 The wild Pokémon escaped! Your ${ball} was used.`);
    }

    player.team.push(wild);
    channelSpawns[message.channel.id] = null;

    gainXp(player, 15);

    await message.reply(`🎉 You caught ${wild.name.toUpperCase()} from the channel! (+15 XP)\nUse >team to view your Pokémon.`);
};

commands.team = async (message) => {
    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    if (!player.team.length) return message.reply("👥 Your team is empty. Use >spawn and >catch.");

    let text = "👥 Your Pokémon team:\n";
    for (let i = 0; i < player.team.length; i++) {
        const p = player.team[i];
        text += `${i + 1}. ${p.name.toUpperCase()} — Lv.${p.level} — HP ${p.hp}/${p.maxHp} — Type: ${p.types.join(", ")}\n`;
    }
    text += `\n⭐ Trainer XP: ${player.xp}`;

    await message.reply(text);
};

commands.release = async (message, args) => {
    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    const index = parseInt(args[0]);
    if (!index || index < 1 || index > player.team.length)
        return message.reply("🗑️ Provide a valid team slot number. Example: >release 1");

    const removed = player.team.splice(index - 1, 1)[0];
    await message.reply(`🗑️ You released ${removed.name.toUpperCase()} from your team.`);
};

commands.trade = async (message, args) => {
    const sub = args[0];
    ensurePlayer(message.author.id);

    if (!sub) return message.reply("🔁 Trade Commands: >trade request @user slot, >trade accept, >trade cancel");

    const player = pokemonPlayers[message.author.id];

    if (sub === "request") {
        const target = message.mentions.users.first();
        const slot = parseInt(args[2]);

        if (!target) return message.reply("🔁 Mention a user to trade with.");
        if (!slot || slot < 1 || slot > player.team.length)
            return message.reply("🔁 Provide a valid team slot to offer.");

        ensurePlayer(target.id);

        player.trade = {
            targetId: target.id,
            offerIndex: slot - 1
        };

        return message.reply(`🔁 Trade request sent to ${target.username}. They can use >trade accept.`);
    }

    if (sub === "accept") {
        const trade = player.trade;
        if (!trade) return message.reply("🔁 You have no incoming trade to accept.");

        const fromId = trade.targetId;
        ensurePlayer(fromId);
        const fromPlayer = pokemonPlayers[fromId];

        const offered = fromPlayer.team[trade.offerIndex];
        if (!offered) return message.reply("🔁 The offered Pokémon no longer exists.");

        player.team.push(offered);
        fromPlayer.team.splice(trade.offerIndex, 1);

        player.trade = null;

        return message.reply(`🔁 You accepted the trade and received ${offered.name.toUpperCase()}!`);
    }

    if (sub === "cancel") {
        player.trade = null;
        return message.reply("🔁 Your trade request was cancelled.");
    }

    return message.reply("🔁 Trade Commands: >trade request @user slot, >trade accept, >trade cancel");
};

commands.fight = async (message, args) => {
    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    if (!player.team.length) return message.reply("⚔️ You have no Pokémon to fight with. Use >catch first.");

    const slot = parseInt(args[0]) || 1;
    if (slot < 1 || slot > player.team.length)
        return message.reply("⚔️ Provide a valid team slot. Example: >fight 1");

    let ally = player.team[slot - 1];

    const id = Math.floor(Math.random() * 151) + 1;
    const wildData = await getPokemon(id);
    if (!wildData) return message.reply("⚔️ Failed to find a wild Pokémon.");

    const wild = createPokemonInstance(wildData);

    const allyDamage = Math.max(5, ally.attack - wild.defense / 2);
    const wildDamage = Math.max(5, wild.attack - ally.defense / 2);

    wild.hp -= allyDamage;
    let battleText = `⚔️ Battle!\nYou sent out ${ally.name.toUpperCase()} (Lv.${ally.level})\nWild ${wild.name.toUpperCase()} appears!\n\n`;

    battleText += `🗡️ ${ally.name.toUpperCase()} dealt ${Math.round(allyDamage)} damage.\n`;

    if (wild.hp <= 0) {
        gainXp(player, 20);
        ally.level += 1;
        ally = await tryEvolve(ally);
        battleText += `💥 Wild ${wild.name.toUpperCase()} fainted!\n⭐ ${ally.name.toUpperCase()} gained a level! (+20 XP)\n`;
        return message.reply(battleText);
    }

    ally.hp -= wildDamage;
    battleText += `🗡️ Wild ${wild.name.toUpperCase()} dealt ${Math.round(wildDamage)} damage.\n`;

    if (ally.hp <= 0) {
        ally.hp = Math.max(1, Math.floor(ally.maxHp * 0.2));
        battleText += `💀 Your ${ally.name.toUpperCase()} fainted! It recovers to ${ally.hp} HP after the battle.`;
    } else {
        battleText += `❤️ ${ally.name.toUpperCase()} HP: ${ally.hp}/${ally.maxHp}\n`;
    }

    await message.reply(battleText);
};

commands.boss = async (message) => {
    const guildId = message.guild.id;

    if (bossSpawns[guildId])
        return message.reply("👑 A boss is already present! Use >fightboss to battle.");

    const id = 150;
    const bossData = await getPokemon(id);
    if (!bossData) return message.reply("⚠️ Failed to spawn boss.");

    const boss = createPokemonInstance(bossData);
    boss.level = 50;
    boss.hp = boss.maxHp * 5;

    bossSpawns[guildId] = boss;

    if (boss.image) {
        await message.reply({
            content: `👑 A Legendary Boss Appeared: ${boss.name.toUpperCase()} (Lv.${boss.level})!\nUse >fightboss to battle!`,
            files: [boss.image]
        });
    } else {
        await message.reply(`👑 A Legendary Boss Appeared: ${boss.name.toUpperCase()} (Lv.${boss.level})!\nUse >fightboss to battle!`);
    }
};

commands.fightboss = async (message, args) => {
    const guildId = message.guild.id;
    const boss = bossSpawns[guildId];
    if (!boss) return message.reply("👑 No boss present. Use >boss to spawn one.");

    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    if (!player.team.length) return message.reply("⚔️ You have no Pokémon to fight with.");

    const slot = parseInt(args[0]) || 1;
    if (slot < 1 || slot > player.team.length)
        return message.reply("⚔️ Provide a valid team slot. Example: >fightboss 1");

    const ally = player.team[slot - 1];

    const allyDamage = Math.max(10, ally.attack * 1.5);
    const bossDamage = Math.max(15, boss.attack * 1.2);

    boss.hp -= allyDamage;
    let text = `👑 Boss Battle!\nYou sent out ${ally.name.toUpperCase()} (Lv.${ally.level})\nBoss ${boss.name.toUpperCase()} HP: ${boss.hp + allyDamage}/${boss.maxHp * 5}\n\n`;
    text += `🗡️ ${ally.name.toUpperCase()} dealt ${Math.round(allyDamage)} damage.\n`;

    if (boss.hp <= 0) {
        gainXp(player, 100);
        ally.level += 3;
        bossSpawns[guildId] = null;
        text += `💥 Boss ${boss.name.toUpperCase()} was defeated!\n⭐ ${ally.name.toUpperCase()} gained 3 levels! (+100 XP)\n💰 You earned 500 coins!`;
        addCoins(message.author.id, 500);
        return message.reply(text);
    }

    ally.hp -= bossDamage;
    text += `🗡️ Boss ${boss.name.toUpperCase()} dealt ${Math.round(bossDamage)} damage.\n`;

    if (ally.hp <= 0) {
        ally.hp = Math.max(1, Math.floor(ally.maxHp * 0.2));
        text += `💀 Your ${ally.name.toUpperCase()} fainted! It recovers to ${ally.hp} HP after the battle.\n`;
    } else {
        text += `❤️ ${ally.name.toUpperCase()} HP: ${ally.hp}/${ally.maxHp}\n`;
    }

    text += `👑 Boss HP: ${boss.hp}/${boss.maxHp * 5}`;

    await message.reply(text);
};
// ===============================
// SHOP (5-page embed layout)
// ===============================

const shopPages = [
    {
        title: "Pokéballs",
        description:
            "🔸 **Pokéball** — 50 coins\n" +
            "🔹 **Great Ball** — 150 coins\n" +
            "🔶 **Ultra Ball** — 300 coins\n" +
            "💎 **Master Ball** — 1000 coins"
    },
    {
        title: "Battle Items",
        description:
            "🛡️ **Potion** — 100 coins (heal 30 HP)\n" +
            "💊 **Super Potion** — 200 coins (heal 60 HP)\n" +
            "💉 **Hyper Potion** — 400 coins (heal 120 HP)\n" +
            "☀️ **Revive** — 500 coins (revive fainted Pokémon)\n" +
            "✨ **Max Revive** — 800 coins (full revive)"
    },
    {
        title: "Mega Stones",
        description:
            "⚜️ **Charizardite X** — 1000 coins\n" +
            "⚜️ **Charizardite Y** — 1000 coins\n" +
            "⚜️ **Mewtwonite X** — 1200 coins\n" +
            "⚜️ **Mewtwonite Y** — 1200 coins\n" +
            "⚜️ **Gengarite** — 900 coins\n" +
            "⚜️ **Lucarionite** — 900 coins"
    },
    {
        title: "Gigantamax Items",
        description:
            "✨ **Dynamax Band** — 1500 coins\n" +
            "✨ **G-Max Candy** — 700 coins\n" +
            "🍲 **Max Soup** — 900 coins"
    },
    {
        title: "TMs",
        description:
            "📀 **TM01** — 300 coins\n" +
            "📀 **TM02** — 300 coins\n" +
            "📀 **TM03** — 300 coins\n" +
            "📀 **TM Random** — 500 coins"
    }
];

commands.shop = async (message, args) => {
    const page = parseInt(args[0]) || 1;
    const index = page - 1;

    if (index < 0 || index >= shopPages.length) {
        return message.reply(`🛒 Invalid page. Choose 1–${shopPages.length}.`);
    }

    const data = shopPages[index];

    const embed = new EmbedBuilder()
        .setTitle(`🛒 PokéShop — Page ${page}/${shopPages.length} (${data.title})`)
        .setDescription(data.description)
        .setColor(0xff99cc);

    await message.reply({ embeds: [embed] });
};

commands.buy = async (message, args) => {
    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    const item = args[0]?.toLowerCase();
    const amount = parseInt(args[1]) || 1;

    if (!item) return message.reply("🛒 Specify an item to buy. Example: >buy pokeball 3");

    const prices = {
        pokeball: 50,
        greatball: 150,
        ultraball: 300,
        masterball: 1000,
        potion: 100,
        superpotion: 200,
        hyperpotion: 400,
        revive: 500,
        maxrevive: 800,
        charizarditex: 1000,
        charizarditey: 1000,
        mewtwonitex: 1200,
        mewtwonitey: 1200,
        gengarite: 900,
        lucarionite: 900,
        dynamaxband: 1500,
        gmaxcandy: 700,
        maxsoup: 900,
        tm01: 300,
        tm02: 300,
        tm03: 300,
        tmrandom: 500
    };

    if (!prices[item]) return message.reply("🛒 That item does not exist. Use >shop.");

    const cost = prices[item] * amount;
    const coins = getUserBalance(message.author.id);

    if (coins < cost) return message.reply("💸 You don't have enough coins.");

    removeCoins(message.author.id, cost);
    player.items[item] = (player.items[item] || 0) + amount;

    await message.reply(`🛒 You bought ${amount} ${item}(s) for ${cost} coins.`);
};

commands.use = async (message, args) => {
    ensurePlayer(message.author.id);
    const player = pokemonPlayers[message.author.id];

    const item = args[0]?.toLowerCase();
    const slot = parseInt(args[1]) || 1;

    if (!item) return message.reply("🧪 Specify an item to use. Example: >use potion 1");

    if (!player.items[item] || player.items[item] <= 0)
        return message.reply("🧪 You don't have that item.");

    if (!player.team.length) return message.reply("🧪 You have no Pokémon.");

    if (slot < 1 || slot > player.team.length)
        return message.reply("🧪 Provide a valid team slot.");

    let p = player.team[slot - 1];

    // healing items
    if (item === "potion") {
        p.hp = Math.min(p.maxHp, p.hp + 30);
        player.items[item]--;
        return message.reply(`🧪 Potion used on ${p.name.toUpperCase()}! HP is now ${p.hp}/${p.maxHp}.`);
    }

    if (item === "superpotion") {
        p.hp = Math.min(p.maxHp, p.hp + 60);
        player.items[item]--;
        return message.reply(`🧪 Super Potion used on ${p.name.toUpperCase()}! HP is now ${p.hp}/${p.maxHp}.`);
    }

    if (item === "hyperpotion") {
        p.hp = Math.min(p.maxHp, p.hp + 120);
        player.items[item]--;
        return message.reply(`🧪 Hyper Potion used on ${p.name.toUpperCase()}! HP is now ${p.hp}/${p.maxHp}.`);
    }

    if (item === "revive") {
        if (p.hp > 0) return message.reply("🧪 That Pokémon is not fainted.");
        p.hp = Math.floor(p.maxHp * 0.5);
        player.items[item]--;
        return message.reply(`☀️ Revive used! ${p.name.toUpperCase()} is back with ${p.hp}/${p.maxHp} HP.`);
    }

    if (item === "maxrevive") {
        if (p.hp > 0) return message.reply("🧪 That Pokémon is not fainted.");
        p.hp = p.maxHp;
        player.items[item]--;
        return message.reply(`✨ Max Revive used! ${p.name.toUpperCase()} is fully restored.`);
    }

    // rare candy (legacy)
    if (item === "rarecandy") {
        p.level += 1;
        player.items[item]--;
        p = await tryEvolve(p);
        player.team[slot - 1] = p;
        return message.reply(`🍬 Rare Candy used! ${p.name.toUpperCase()} is now Lv.${p.level}.`);
    }

    // mega stones (simple mega buff)
    if (["charizarditex", "charizarditey", "mewtwonitex", "mewtwonitey", "gengarite", "lucarionite"].includes(item)) {
        player.items[item]--;
        p.attack = Math.floor(p.attack * 1.5);
        p.defense = Math.floor(p.defense * 1.5);
        p.name = `Mega ${p.name}`;
        return message.reply(`⚜️ ${item} used! ${p.name.toUpperCase()} has mega evolved and gained boosted stats.`);
    }

    // gigantamax items
    if (item === "gmaxcandy") {
        player.items[item]--;
        p.maxHp = Math.floor(p.maxHp * 1.3);
        p.hp = p.maxHp;
        return message.reply(`✨ G-Max Candy used! ${p.name.toUpperCase()} has increased HP and is ready to Gigantamax.`);
    }

    if (item === "dynamaxband") {
        player.items[item]--;
        p.attack = Math.floor(p.attack * 1.2);
        return message.reply(`✨ Dynamax Band used! ${p.name.toUpperCase()}'s attack has increased.`);
    }

    if (item === "maxsoup") {
        player.items[item]--;
        p.maxHp = Math.floor(p.maxHp * 1.2);
        p.attack = Math.floor(p.attack * 1.2);
        return message.reply(`🍲 Max Soup used! ${p.name.toUpperCase()} feels stronger and bulkier.`);
    }

    // TMs (simple flavor)
    if (["tm01", "tm02", "tm03", "tmrandom"].includes(item)) {
        player.items[item]--;
        return message.reply(`📀 TM used on ${p.name.toUpperCase()}! It learned a powerful move (flavor).`);
    }

    return message.reply("🧪 That item cannot be used this way.");
};

// quick commands for mega/gmax flavor
commands.mega = async (message, args) => {
    return message.reply("⚜️ Use your specific mega stone with `>use <stone> <slot>` to mega evolve.");
};

commands.gigantamax = async (message, args) => {
    return message.reply("✨ Use `>use gmaxcandy <slot>` or `>use dynamaxband <slot>` to power up for Gigantamax.");
};

/* ===============================
   POKEMON ENGINE (REQUIRED)
   =============================== */

const pokemonPlayers = {};
const bossSpawns = {};

function ensurePlayer(id) {
    if (!pokemonPlayers[id]) {
        pokemonPlayers[id] = {
            xp: 0,
            items: {
                pokeball: 5,
                greatball: 0,
                ultraball: 0,
                masterball: 0,
                potion: 0,
                superpotion: 0,
                hyperpotion: 0,
                revive: 0,
                maxrevive: 0,
                rarecandy: 0,
                charizarditex: 0,
                charizarditey: 0,
                mewtwonitex: 0,
                mewtwonitey: 0,
                gengarite: 0,
                lucarionite: 0,
                dynamaxband: 0,
                gmaxcandy: 0,
                maxsoup: 0,
                tm01: 0,
                tm02: 0,
                tm03: 0,
                tmrandom: 0
            },
            team: [],
            spawn: null,
            trade: null
        };
    }
}

async function getPokemon(id) {
    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        if (!res.ok) return null;

        const data = await res.json();

        return {
            id: data.id,
            name: data.name,
            types: data.types.map(t => t.type.name),
            image: data.sprites.other["official-artwork"].front_default,
            stats: data.stats
        };
    } catch {
        return null;
    }
}

function createPokemonInstance(p) {
    const hp = p.stats.find(s => s.stat.name === "hp").base_stat;
    const attack = p.stats.find(s => s.stat.name === "attack").base_stat;
    const defense = p.stats.find(s => s.stat.name === "defense").base_stat;

    return {
        id: p.id,
        name: p.name,
        level: 5,
        maxHp: hp,
        hp: hp,
        attack: attack,
        defense: defense,
        types: p.types,
        image: p.image
    };
}

function gainXp(player, amount) {
    player.xp += amount;
}

async function tryEvolve(p) {
    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${p.id}`);
        if (!res.ok) return p;

        const data = await res.json();
        const evo = data.evolution_chain?.url;
        if (!evo) return p;

        const evoRes = await fetch(evo);
        const evoData = await evoRes.json();

        const chain = evoData.chain;
        let current = chain;

        while (current) {
            if (current.species.name === p.name) {
                if (current.evolves_to.length > 0) {
                    const next = current.evolves_to[0].species.name;
                    const evoPoke = await getPokemon(next);
                    if (evoPoke) {
                        const newP = createPokemonInstance(evoPoke);
                        newP.level = p.level;
                        return newP;
                    }
                }
            }
            current = current.evolves_to[0];
        }

        return p;
    } catch {
        return p;
    }
}

// ===============================
// GIVEAWAY SYSTEM (FIXED + GIF)
// ===============================

const giveaways = {};

commands.giveaway = async (message, args) => {
    const sub = args[0];

    if (!sub) {
        return message.reply(
            "🎉 **Giveaway Commands:**\n" +
            "• `>giveaway start <time> <prize>`\n" +
            "• `>giveaway end`\n" +
            "• `>giveaway reroll`"
        );
    }

    // START GIVEAWAY
    if (sub === "start") {
        const time = args[1];
        const prize = args.slice(2).join(" ");

        if (!time || !prize) {
            return message.reply("🎉 **Usage:** `>giveaway start 1m Nitro`");
        }

        if (giveaways[message.channel.id]) {
            return message.reply("🎉 A giveaway is already running in this channel.");
        }

        const duration = ms(time);
        if (!duration) return message.reply("⏳ Invalid time format.");

        const embedMsg = await message.channel.send({
            content:
                `🎉 **GIVEAWAY STARTED!** 🎉\n` +
                `Prize: **${prize}**\n` +
                `React with 🎉 to enter!\n` +
                `Ends in **${time}**`,
            files: [
                "https://cdn.discordapp.com/attachments/1512149506076967035/1512233267233951896/lv_0_20260604191428.jpg?ex=6a23587a&is=6a2206fa&hm=606f56dc85540d539e280eed5b22765cc29ad5c40ba998974e2fbfd3af1dce0f"
            ]
        });

        await embedMsg.react("🎉");

        giveaways[message.channel.id] = {
            msgId: embedMsg.id,
            prize,
            endTime: Date.now() + duration
        };

        setTimeout(async () => {
            const data = giveaways[message.channel.id];
            if (!data) return;

            const msg = await message.channel.messages.fetch(data.msgId).catch(() => null);
            if (!msg) return;

            const reaction = msg.reactions.cache.get("🎉");
            if (!reaction) return;

            const users = await reaction.users.fetch();
            const entries = users.filter(u => !u.bot).map(u => u);

            if (entries.length === 0) {
                message.channel.send("❌ **No valid entries. Giveaway cancelled.**");
                delete giveaways[message.channel.id];
                return;
            }

            const winner = entries[Math.floor(Math.random() * entries.length)];

            message.channel.send(
                `🎉 **GIVEAWAY ENDED!** 🎉\n` +
                `Winner: <@${winner.id}> 🎊\n` +
                `Prize: **${data.prize}**`
            );

            delete giveaways[message.channel.id];
        }, duration);

        return;
    }

    if (sub === "end") {
        const data = giveaways[message.channel.id];
        if (!data) return message.reply("❌ No giveaway running.");

        giveaways[message.channel.id].endTime = Date.now();
        return message.reply("🛑 **Giveaway will end momentarily.**");
    }

    if (sub === "reroll") {
        const data = giveaways[message.channel.id];
        if (!data) return message.reply("❌ No giveaway to reroll.");

        const msg = await message.channel.messages.fetch(data.msgId).catch(() => null);
        if (!msg) return message.reply("❌ Giveaway message not found.");

        const reaction = msg.reactions.cache.get("🎉");
        if (!reaction) return message.reply("❌ No entries found.");

        const users = await reaction.users.fetch();
        const entries = users.filter(u => !u.bot).map(u => u);

        if (entries.length === 0) {
            return message.reply("❌ No valid entries to reroll.");
        }

        const winner = entries[Math.floor(Math.random() * entries.length)];

        return message.reply(
            `🔄 **REROLL!**\nNew Winner: <@${winner.id}> 🎉\nPrize: **${data.prize}**`
        );
    }
};

// ===============================
// READY + LOGIN
// ===============================

client.login(TOKEN);
