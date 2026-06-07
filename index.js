/* ===============================
   PokeChaos — Full RPG Discord Bot
   CLEANED + FIXED + IMPROVED
   =============================== */

const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    PermissionsBitField, 
    EmbedBuilder 
} = require("discord.js");

const fetch = require("node-fetch");
const ms = require("ms");
const db = require("quick.db");

let userInventory = {};
let userAFK = {};
let userReminders = [];
let activeGiveaways = {};
let userPokemon = {}; // <-- FIXED

// ===============================
// UNIVERSAL EMBED STYLE
// ===============================

function chaosEmbed(title, description) {
    return new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle(title)
        .setDescription(description);
} // <-- THIS is the brace you were missing

// ===============================
// Quick.db Coin System
// ===============================

function getCoins(userId) {
  return db.get(`coins_${userId}`) || 100;
}

function addCoins(userId, amount) {
  db.add(`coins_${userId}`, amount);
}

function removeCoins(userId, amount) {
  const current = getCoins(userId);
  const newAmount = Math.max(0, current - amount);
  db.set(`coins_${userId}`, newAmount);
}

// ===============================
// KEYS (USE ENV VARIABLES)
// ===============================

const TOKEN = process.env.TOKEN;
const OWNER_ID = process.env.OWNER_ID;

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

let messageCount = 0;
const spawnThreshold = 15;

// ===============================
// HELPER FUNCTIONS
// ===============================

function getUserBalance(id) {
    if (!economy[id]) economy[id] = { coins: 100 };
    return economy[id].coins;
}

function addCoinsLocal(id, amount) {
    getUserBalance(id);
    economy[id].coins += amount;
}

function removeCoinsLocal(id, amount) {
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
        return message.reply({ 
            embeds: [chaosEmbed("❓ Unknown Command", "Use `>help` to see all commands.")] 
        });
    }
}

// ===============================
// MAIN MESSAGE HANDLER
// ===============================

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    if (aiChatEnabled[message.channel.id] && !message.content.startsWith(PREFIX)) {
        return;
    }

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
        message.reply({ embeds: [chaosEmbed("⚠️ Error", "Something went wrong running this command.")] });
    }
});

// ===============================
// BASIC COMMANDS
// ===============================

commands.ping = async (message) => {
    message.reply({ embeds: [chaosEmbed("🏓 Pong!", "Your latency is crisp.")] });
};

commands.help = async (message) => {
    const desc =
        "💰 Economy: `>balance`, `>daily`, `>give`, `>leaderboard`\n" +
        "🎰 Gambling: `>coinflip`, `>slots`, `>blackjack`, `>hit`, `>stand`\n" +
        "🎮 Games: `>uno`, `>hangman`, `>guess`, `>hangmanend`\n" +
        "⚔️ Pokémon: `>pokemon`, `>pokedex`, `>spawn`, `>ownerspawn`, `>catch`, `>catchwild`, `>team`, `>release`, `>trade`, `>fight`, `>boss`, `>fightboss`, `>gigantamax`, `>mega`, `>shop`, `>buy`, `>use`\n" +
        "🧭 Utility: `>ping`, `>uptime`";

    message.reply({ embeds: [chaosEmbed("📜 PokeChaos Command Menu", desc)] });
};

commands.uptime = async (message) => {
    const totalSeconds = Math.floor(process.uptime());
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    message.reply({ 
        embeds: [chaosEmbed("⏱️ Uptime", `${hours}h ${minutes}m ${seconds}s`)] 
    });
};

// ===============================
// MODERATION COMMANDS
// ===============================

commands.kick = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot kick members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to kick.")] });

    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
        await target.kick(reason);
        message.reply({ embeds: [chaosEmbed("🦵 User Kicked", `${target.user.tag} was kicked.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not kick this user.")] });
    }
};

commands.ban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot ban members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to ban.")] });

    const reason = args.slice(1).join(" ") || "No reason provided";

    try {
        await target.ban({ reason });
        message.reply({ embeds: [chaosEmbed("🔨 User Banned", `${target.user.tag} was banned.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not ban this user.")] });
    }
};

commands.unban = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot unban members.")] });

    const userId = args[0];
    if (!userId) return message.reply({ embeds: [chaosEmbed("🆔 Missing ID", "Provide a user ID to unban.")] });

    try {
        await message.guild.members.unban(userId);
        message.reply({ embeds: [chaosEmbed("🔓 User Unbanned", `Unbanned ID: ${userId}`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not unban this user.")] });
    }
};

commands.mute = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot mute members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to mute.")] });

    const duration = args[1] || "10m";

    try {
        await target.timeout(ms(duration));
        message.reply({ embeds: [chaosEmbed("🔇 User Muted", `${target.user.tag} muted for ${duration}.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not mute this user.")] });
    }
};

commands.unmute = async (message) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot unmute members.")] });

    const target = message.mentions.members.first();
    if (!target) return message.reply({ embeds: [chaosEmbed("👤 Missing Target", "Mention someone to unmute.")] });

    try {
        await target.timeout(null);
        message.reply({ embeds: [chaosEmbed("🔊 User Unmuted", `${target.user.tag} is now unmuted.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not unmute this user.")] });
    }
};

commands.clear = async (message, args) => {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
        return message.reply({ embeds: [chaosEmbed("🚫 No Permission", "You cannot clear messages.")] });

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100)
        return message.reply({ embeds: [chaosEmbed("🔢 Invalid Number", "Choose between 1 and 100.")] });

    try {
        await message.channel.bulkDelete(amount, true);
        message.reply({ embeds: [chaosEmbed("🧹 Messages Deleted", `${amount} messages removed.`)] });
    } catch {
        message.reply({ embeds: [chaosEmbed("⚠️ Failed", "Could not delete messages.")] });
    }
};
// ===============================
// OWNER SPAWN SYSTEM
// ===============================

const fs = require("fs");
const path = require("path");

// Simple data file for saving spawned Pokémon
const DATA_PATH = path.join(__dirname, "pokedata.json");

function loadData() {
    try {
        const raw = fs.readFileSync(DATA_PATH, "utf8");
        return JSON.parse(raw);
    } catch {
        return { userPokemon: {} };
    }
}

function saveData(data) {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

let persistentData = loadData();
if (!persistentData.userPokemon) persistentData.userPokemon = {};
const savedUserPokemon = persistentData.userPokemon;

// ===============================
// OWNERSPAWN COMMAND
// ===============================

commands.ownerspawn = async (message, args) => {
    // Only bot owner can use this
    const ownerId = "YOUR_OWNER_ID_HERE";
    if (message.author.id !== ownerId) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Access", "Only the bot owner can spawn special Pokémon.")]
        });
    }

    const targetUser = message.mentions.users.first() || message.author;
    const pokemonName = (args[0] || "").toLowerCase();

    if (!pokemonName) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing Name", "You must specify a Pokémon name to spawn.")]
        });
    }

    // Initialize user storage
    if (!savedUserPokemon[targetUser.id]) {
        savedUserPokemon[targetUser.id] = [];
    }

    // Add Pokémon to user
    savedUserPokemon[targetUser.id].push(pokemonName);
    saveData(persistentData);

    const spawnEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("✨ OWNER SPAWN")
        .setDescription(
            `👑 **Owner Spawned:** \`${pokemonName}\`\n` +
            `🎟 **Given To:** ${targetUser}\n\n` +
            `📦 This Pokémon has been **saved** to their collection.`
        )
        .setFooter({ text: "PokeChaos • Special Spawn" })
    return message.reply({ embeds: [spawnEmbed] });
};


// ===============================
// SYNC OWNERSPAWN WITH RUNTIME userPokemon
// ===============================

function syncSavedToRuntime() {
    Object.keys(savedUserPokemon).forEach((id) => {
        if (!userPokemon[id]) userPokemon[id] = [];
        savedUserPokemon[id].forEach((p) => {
            if (!userPokemon[id].includes(p)) {
                userPokemon[id].push(p);
            }
        });
    });
}

// Call once on startup after userPokemon is defined
syncSavedToRuntime();

// ===============================
// CATCH (FIXED)
// ===============================

commands.catch = async (message) => {
    if (!global.activeSpawn) {
        return message.reply({ embeds: [chaosEmbed("❌ No Pokémon", "There is nothing to catch.")] });
    }

    if (global.activeSpawn.channel !== message.channel.id) {
        return message.reply({ embeds: [chaosEmbed("❌ Wrong Channel", "The Pokémon is not here.")] });
    }

    const caught = global.activeSpawn.name;
    delete global.activeSpawn;

    return message.reply({ embeds: [chaosEmbed("🎉 Pokémon Caught!", `You caught **${caught}**!`)] });
};

// ===============================
// UNO GAME
// ===============================

commands.uno = async (message, args) => {
    const sub = args[0];
    const guildId = message.guild.id;

    if (!sub) {
        return message.reply({
            embeds: [
                chaosEmbed("🟥 UNO Commands",
                "`>uno start`\n`>uno join`\n`>uno hand`\n`>uno draw`\n`>uno play <card>`\n`>uno end`")
            ]
        });
    }

    if (sub === "start") {
        if (unoGames[guildId])
            return message.reply({ embeds: [chaosEmbed("🟥 Already Running", "An UNO game is already active.")] });

        unoGames[guildId] = {
            players: {},
            order: [],
            topCard: drawUnoCard(),
            started: true
        };

        return message.reply({
            embeds: [
                chaosEmbed("🟥 UNO Started!", `Top card: \`${unoGames[guildId].topCard}\``)
            ]
        });
    }

    if (sub === "join") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        if (game.players[message.author.id])
            return message.reply({ embeds: [chaosEmbed("🟥 Already Joined", "You are already in the game.")] });

        game.players[message.author.id] = [
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard(),
            drawUnoCard()
        ];

        game.order.push(message.author.id);

        return message.reply({ embeds: [chaosEmbed("🟥 Joined UNO", `${message.author.username} joined the game.`)] });
    }

    if (sub === "hand") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        const hand = game.players[message.author.id];
        if (!hand) return message.reply({ embeds: [chaosEmbed("🟥 Not Playing", "You are not in the game.")] });

        try {
            await message.author.send(`🟥 **Your Uno hand:** ${hand.join(", ")}`);
            message.reply({ embeds: [chaosEmbed("📩 Sent", "Your hand was sent in DMs.")] });
        } catch {
            message.reply({ embeds: [chaosEmbed("⚠️ DM Blocked", "Enable DMs to receive your hand.")] });
        }
    }

    if (sub === "draw") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        const hand = game.players[message.author.id];
        if (!hand) return message.reply({ embeds: [chaosEmbed("🟥 Not Playing", "You are not in the game.")] });

        const card = drawUnoCard();
        hand.push(card);

        return message.reply({ embeds: [chaosEmbed("🟥 Card Drawn", `${message.author.username} drew a card.`)] });
    }

    if (sub === "play") {
        const game = unoGames[guildId];
        if (!game) return message.reply({ embeds: [chaosEmbed("🟥 No Game", "Start a game with `>uno start`.")] });

        const hand = game.players[message.author.id];
        if (!hand) return message.reply({ embeds: [chaosEmbed("🟥 Not Playing", "You are not in the game.")] });

        const card = args[1];
        if (!card) return message.reply({ embeds: [chaosEmbed("🟥 Missing Card", "Example: `>uno play R5`")] });

        if (!hand.includes(card))
            return message.reply({ embeds: [chaosEmbed("🟥 Invalid Card", "You don't have that card.")] });

        const top = game.topCard;
        if (card[0] !== top[0] && card[1] !== top[1])
            return message.reply({ embeds: [chaosEmbed("🟥 No Match", "Card does not match color or number.")] });

        game.topCard = card;
                game.players[message.author.id] = hand.filter(c => c !== card);

        return message.reply({
            embeds: [
                chaosEmbed(
                    "🟥 Card Played",
                    `${message.author.username} played \`${card}\`.\nNew top card: \`${card}\``
                )
            ]
        });
    }

    if (sub === "end") {
        if (!unoGames[guildId])
            return message.reply({
                embeds: [chaosEmbed("🟥 No Game", "There is no UNO game running.")]
            });

        delete unoGames[guildId];

        return message.reply({
            embeds: [chaosEmbed("🟥 UNO Ended", "The UNO game has been closed.")]
        });
    }
};

// ===============================
// HANGMAN GAME
// ===============================
commands.hangman = async (message, args) => {
    const guildId = message.guild.id;

    if (hangmanGames[guildId]) {
        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎮 Hangman Already Running",
                    "A game is already active! Use `>guess <letter>` to play."
                )
            ]
        });
    }

    const word = hangmanWords[Math.floor(Math.random() * hangmanWords.length)];
    hangmanGames[guildId] = {
        word,
        guessed: [],
        wrong: 0
    };

    const display = formatHangmanWord(word, []);

    return message.reply({
        embeds: [
            chaosEmbed(
                "🎮 Hangman Started!",
                `Word: \`${display}\`\nWrong guesses: **0/6**`
            )
        ]
    });
};

commands.guess = async (message, args) => {
    const guildId = message.guild.id;
    const game = hangmanGames[guildId];

    if (!game) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ No Game", "Start a game with `>hangman`.")]
        });
    }

    const letter = args[0]?.toLowerCase();
    if (!letter || letter.length !== 1 || !/[a-z]/.test(letter)) {
        return message.reply({
            embeds: [
                chaosEmbed("⚠️ Invalid Guess", "Guess a single letter. Example: `>guess a`")
            ]
        });
    }

    if (game.guessed.includes(letter)) {
        return message.reply({
            embeds: [
                chaosEmbed("🔁 Already Guessed", `You've already guessed **${letter}**.`)
            ]
        });
    }

    game.guessed.push(letter);

    if (!game.word.includes(letter)) {
        game.wrong++;

        if (game.wrong >= 6) {
            delete hangmanGames[guildId];
            return message.reply({
                embeds: [
                    chaosEmbed(
                        "💀 Hangman Lost",
                        `The word was **${game.word}**.\nBetter luck next time!`
                    )
                ]
            });
        }
    }

    const display = formatHangmanWord(game.word, game.guessed);

    if (!display.includes("-")) {
        delete hangmanGames[guildId];
        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎉 Hangman Won!",
                    `You guessed the word: **${game.word}**!`
                )
            ]
        });
    }

    return message.reply({
        embeds: [
            chaosEmbed(
                "🎮 Hangman",
                `Word: \`${display}\`\nWrong guesses: **${game.wrong}/6**`
            )
        ]
    });
};

commands.hangmanend = async (message) => {
    const guildId = message.guild.id;

    if (!hangmanGames[guildId]) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ No Game", "There is no Hangman game running.")
            ]
        });
    }

    delete hangmanGames[guildId];

    return message.reply({
        embeds: [
            chaosEmbed("🛑 Hangman Ended", "The Hangman game has been stopped.")
        ]
    });
};

// ===============================
// POKÉMON SYSTEM (FULL POKÉDEX VIA POKÉAPI)
// ===============================

const pokemonDataCache = {};
const pokemonStatsCache = {};
let allPokemonNames = [];

// Load ALL Pokémon names from PokéAPI for random spawns
async function loadAllPokemon() {
    try {
        const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=20000");
        const data = await res.json();
        allPokemonNames = data.results.map(p => p.name);
        console.log(`Loaded ${allPokemonNames.length} Pokémon from PokéAPI.`);
    } catch (err) {
        console.error("Failed to load full Pokémon list:", err);
    }
}

// Call this once when the bot starts (add near client.ready or after client creation)
loadAllPokemon();

// Fetch full Pokémon data from PokéAPI
async function getPokemonData(name) {
    name = name.toLowerCase();

    if (pokemonDataCache[name]) return pokemonDataCache[name];

    try {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
        if (!res.ok) return null;

        const data = await res.json();

        const types = data.types.map(t => t.type.name);
        const abilities = data.abilities.map(a => a.ability.name);
        const moves = data.moves.map(m => m.move.name);
        const sprite = data.sprites.other?.["official-artwork"]?.front_default || data.sprites.front_default;

        const stats = {
            hp: data.stats[0].base_stat,
            atk: data.stats[1].base_stat,
            def: data.stats[2].base_stat,
            spAtk: data.stats[3].base_stat,
            spDef: data.stats[4].base_stat,
            speed: data.stats[5].base_stat
        };

        const result = { name, types, abilities, moves, sprite, stats };
        pokemonDataCache[name] = result;
        pokemonStatsCache[name] = stats;

        return result;
    } catch (err) {
        console.error("PokéAPI Error:", err);
        return null;
    }
}

// Get stats (from cache or PokéAPI)
async function getStats(name) {
    name = name.toLowerCase();

    if (pokemonStatsCache[name]) return pokemonStatsCache[name];

    const data = await getPokemonData(name);
    if (!data) return null;

    return data.stats;
}

// Random Pokémon generator using FULL Pokédex
function getRandomPokemon() {
    if (allPokemonNames.length === 0) return "pikachu"; // fallback if load failed
    return allPokemonNames[Math.floor(Math.random() * allPokemonNames.length)];
}

// Auto-spawn Pokémon in channel (with sprite, types)
async function spawnRandomPokemonChannel(channel) {
    const pokemon = getRandomPokemon();
    const data = await getPokemonData(pokemon);

    if (!data) {
        return channel.send({
            embeds: [chaosEmbed("⚠️ Error", `Could not load data for **${pokemon}**.`)]
        });
    }

    global.activeSpawn = {
        name: data.name.toLowerCase(),
        channel: channel.id
    };

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "✨ A Wild Pokémon Appeared!",
        `A wild **${data.name}** has spawned!\nTypes: ${typeText}\nUse \`>catch\` to try catching it!`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    await channel.send({ embeds: [embed] });
}

// Manual spawn command (random, with sprite)
commands.spawn = async (message) => {
    const pokemon = getRandomPokemon();
    const data = await getPokemonData(pokemon);

    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Could not load data for **${pokemon}**.`)]
        });
    }

    global.activeSpawn = {
        name: data.name.toLowerCase(),
        channel: message.channel.id
    };

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "✨ Pokémon Spawned!",
        `A wild **${data.name}** has appeared!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// OWNERSPAWN (UPDATED WITH POKÉAPI SPRITES/TYPES)
commands.ownerspawn = async (message, args) => {
    if (message.author.id !== OWNER_ID) {
        return message.reply({ embeds: [chaosEmbed("🚫 Restricted", "Only the bot owner can use this.")] });
    }

    const pokemonName = args[0];
    if (!pokemonName) {
        return message.reply({ embeds: [chaosEmbed("⚠️ Missing Pokémon", "Example: `>ownerspawn pikachu`")] });
    }

    const data = await getPokemonData(pokemonName);
    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `Could not find **${pokemonName}** in PokéAPI.`)]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "✨ Owner Spawned Pokémon!",
        `A wild **${data.name}** has appeared!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    try {
        global.activeSpawn = {
            name: data.name.toLowerCase(),
            channel: message.channel.id
        };

        await message.channel.send({ embeds: [embed] });
    } catch (err) {
        console.error(err);
        return message.reply({ embeds: [chaosEmbed("⚠️ Error", "Failed to spawn Pokémon.")] });
    }
};

// Pokédex lookup (with types, abilities, moves, sprite)
commands.pokedex = async (message, args) => {
    const name = args[0]?.toLowerCase();
    if (!name) {
        return message.reply({
            embeds: [chaosEmbed("📘 Pokédex", "Usage: `>pokedex <pokemon>`")]
        });
    }

    const data = await getPokemonData(name);
    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `**${name}** is not in the Pokédex.`)]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");
    const abilityText = data.abilities.slice(0, 3).map(a => `\`${a}\``).join(", ");
    const moveText = data.moves.slice(0, 5).map(m => `\`${m}\``).join(", ");

    const embed = chaosEmbed(
        `📘 Pokédex — ${data.name}`,
        `**Types:** ${typeText}\n**Abilities:** ${abilityText}\n**Sample Moves:** ${moveText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// Catch wild Pokémon (random, stored by name)
commands.catchwild = async (message) => {
    const pokemon = getRandomPokemon();
    const data = await getPokemonData(pokemon);

    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Could not load data for **${pokemon}**.`)]
        });
    }

    if (!userPokemon[message.author.id]) {
        userPokemon[message.author.id] = [];
    }

    userPokemon[message.author.id].push(data.name.toLowerCase());

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "🎉 Pokémon Caught!",
        `You caught a wild **${data.name}**!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// Show user's Pokémon team (names, with PokéAPI lookup per slot)
commands.team = async (message) => {
    const team = userPokemon[message.author.id];

    if (!team || team.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("⚔️ Your Team", "You have no Pokémon yet.")]
        });
    }

    const lines = [];
    for (let i = 0; i < team.length; i++) {
        const name = team[i];
        const data = await getPokemonData(name);
        if (!data) {
            lines.push(`**${i + 1}.** ${name}`);
            continue;
        }
        const typeText = data.types.join("/");
        lines.push(`**${i + 1}.** ${data.name} (${typeText})`);
    }

    return message.reply({
        embeds: [
            chaosEmbed("⚔️ Your Pokémon Team", lines.join("\n"))
        ]
    });
};

// Release a Pokémon
commands.release = async (message, args) => {
    const index = parseInt(args[0]) - 1;

    if (!userPokemon[message.author.id] || !userPokemon[message.author.id][index]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Invalid Slot", "Choose a valid Pokémon number.")]
        });
    }

    const released = userPokemon[message.author.id][index];
    userPokemon[message.author.id].splice(index, 1);

    return message.reply({
        embeds: [
            chaosEmbed("🕊️ Pokémon Released", `You released **${released}** back into the wild.`)
        ]
    });
};

// Trade Pokémon between users
commands.trade = async (message, args) => {
    const target = message.mentions.users.first();
    const index = parseInt(args[1]) - 1;

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("👥 Trade Error", "Usage: `>trade @user <slot>`")]
        });
    }

    if (!userPokemon[message.author.id] || !userPokemon[message.author.id][index]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Invalid Slot", "Choose a valid Pokémon number.")]
        });
    }

    const pokemon = userPokemon[message.author.id][index];

    if (!userPokemon[target.id]) {
        userPokemon[target.id] = [];
    }

    userPokemon[target.id].push(pokemon);
    userPokemon[message.author.id].splice(index, 1);

    return message.reply({
        embeds: [
            chaosEmbed("🔄 Trade Complete", `You traded **${pokemon}** to **${target.username}**.`)
        ]
    });
};

// ===============================
// CATCH (OWNERSPAWN / AUTO-SPAWN)
// ===============================

commands.catch = async (message) => {
    if (!global.activeSpawn) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Pokémon", "There is nothing to catch.")]
        });
    }

    if (global.activeSpawn.channel !== message.channel.id) {
        return message.reply({
            embeds: [chaosEmbed("❌ Wrong Channel", "The Pokémon is not here.")]
        });
    }

    const caughtName = global.activeSpawn.name;
    delete global.activeSpawn;

    if (!userPokemon[message.author.id]) {
        userPokemon[message.author.id] = [];
    }

    userPokemon[message.author.id].push(caughtName);

    const data = await getPokemonData(caughtName);
    const displayName = data?.name || caughtName;
    const typeText = data ? data.types.map(t => `\`${t}\``).join(", ") : "Unknown";

    const embed = chaosEmbed(
        "🎉 Pokémon Caught!",
        `You caught **${displayName}**!\nTypes: ${typeText}`
    );

    if (data?.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// ===============================
// BATTLE SYSTEM (USING POKÉAPI STATS)
// ===============================

commands.fight = async (message) => {
    const wild = getRandomPokemon();
    const wildStats = await getStats(wild);

    if (!wildStats) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Could not load stats for **${wild}**.`)]
        });
    }

    const userTeam = userPokemon[message.author.id];
    if (!userTeam || userTeam.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Pokémon", "You need at least one Pokémon to fight.")]
        });
    }

    const chosen = userTeam[0].toLowerCase();
    const chosenStats = await getStats(chosen);

    if (!chosenStats) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Stats missing for **${chosen}**.`)]
        });
    }

    // ⚔️ Battle Start Banner
    const startEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("⚔️ BATTLE     START")
        .setImage("https://copilot.microsoft.com/th/id/BCO.801afeaa-0d13-40ac-8df0-6639561f1e6c.png");

    await message.reply({ embeds: [startEmbed] });

    // ⚔️ Battle Result
const userPower = chosenStats.atk + Math.floor(Math.random() * 20);
const wildPower = wildStats.atk + Math.floor(Math.random() * 20);

const result = userPower >= wildPower
    ? `🎉 **You won!**\nYour **${chosen}** defeated the wild **${wild}**!`
    : `💀 **You lost...**\nThe wild **${wild}** overpowered your **${chosen}**.`;

// 🏆 Victory Banner
if (userPower >= wildPower) {
    const victoryEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🏆 VICTORY!")
        .setImage("https://copilot.microsoft.com/th/id/BCO.484f1cc6-ab7c-4161-81e9-89921d2b6a50.png");

    await message.channel.send({ embeds: [victoryEmbed] });
}

// 💀 Defeat Banner
else {
    const defeatEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💀 DEFEAT...")
        .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513175785513553992/ChatGPT_Image_Jun_7_2026_09_40_11_AM.png?ex=6a26c644&is=6a2574c4&hm=b18df6d27e63c62e05c0ca4e3c6e367e47da5bdf3e84855e3b63f4c25790fc72");

    await message.channel.send({ embeds: [defeatEmbed] });
}

return message.channel.send({
    embeds: [chaosEmbed("⚔️ Battle Result", result)]
});
};

commands.fightboss = async (message) => {

    if (!global.activeBoss) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Boss", "There is no active boss right now.")]
        });
    }

    if (global.activeBoss.channel !== message.channel.id) {
        return message.reply({
            embeds: [chaosEmbed("❌ Wrong Channel", "Fight the boss in the correct channel.")]
        });
    }

    const boss = global.activeBoss;
    const userTeam = userPokemon[message.author.id];

    if (!userTeam || userTeam.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Pokémon", "You need a Pokémon to fight the boss.")]
        });
    }

    const chosen = userTeam[0].toLowerCase();
    const stats = await getStats(chosen);

    if (!stats) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Error", `Stats missing for **${chosen}**.`)]
        });
    }

    const damage = stats.atk + Math.floor(Math.random() * 20);
    boss.hp -= damage;

    // 🏆 Victory Banner when boss dies
    if (boss.hp <= 0) {
        const defeated = boss.name;
        delete global.activeBoss;

        const victoryEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🏆 VICTORY!")
            .setImage("https://copilot.microsoft.com/th/id/BCO.484f1cc6-ab7c-4161-81e9-89921d2b6a50.png");

        await message.channel.send({ embeds: [victoryEmbed] });

        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎉 Boss Defeated!",
                    `Your **${chosen}** dealt **${damage}** damage and defeated **${defeated.toUpperCase()}**!`
                )
            ]
        });
    }

    return message.reply({
        embeds: [
            chaosEmbed(
                "⚔️ Boss Fight",
                `Your **${chosen}** dealt **${damage}** damage!\nBoss HP remaining: **${boss.hp}**`
            )
        ]
    });
};

// ===============================
// MEGA EVOLUTION & GIGANTAMAX
// ===============================

// Mega stones & G-Max items (expand later)
const megaStones = {
    charizard: "charizard-mega-x",
    mewtwo: "mewtwo-mega-x",
    lucario: "lucario-mega",
    gengar: "gengar-mega"
};

const gigantamaxForms = {
    pikachu: "pikachu-gmax",
    charizard: "charizard-gmax",
    gengar: "gengar-gmax",
    snorlax: "snorlax-gmax"
};

// MEGA EVOLUTION
commands.mega = async (message, args) => {
    const pokemonName = args[0]?.toLowerCase();
    if (!pokemonName) {
        return message.reply({
            embeds: [
                chaosEmbed("✨ Mega Evolution", "Usage: `>mega <pokemon>`")
            ]
        });
    }

    if (!megaStones[pokemonName]) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ Cannot Mega Evolve", `**${pokemonName}** has no Mega Evolution.`)
            ]
        });
    }

    const megaForm = megaStones[pokemonName];
    const data = await getPokemonData(megaForm);

    if (!data) {
        return message.reply({
            embeds: [
                chaosEmbed("⚠️ Error", `Could not load Mega Evolution data for **${pokemonName}**.`)
            ]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "🔥 Mega Evolution!",
        `Your **${pokemonName}** Mega Evolved into **${data.name}**!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// GIGANTAMAX
commands.gigantamax = async (message, args) => {
    const pokemonName = args[0]?.toLowerCase();
    if (!pokemonName) {
        return message.reply({
            embeds: [
                chaosEmbed("🌩️ Gigantamax", "Usage: `>gigantamax <pokemon>`")
            ]
        });
    }

    if (!gigantamaxForms[pokemonName]) {
        return message.reply({
            embeds: [
                chaosEmbed("❌ Cannot Gigantamax", `**${pokemonName}** has no Gigantamax form.`)
            ]
        });
    }

    const gmaxForm = gigantamaxForms[pokemonName];
    const data = await getPokemonData(gmaxForm);

    if (!data) {
        return message.reply({
            embeds: [
                chaosEmbed("⚠️ Error", `Could not load Gigantamax data for **${pokemonName}**.`)
            ]
        });
    }

    const typeText = data.types.map(t => `\`${t}\``).join(", ");

    const embed = chaosEmbed(
        "🌩️ Gigantamax Transformation!",
        `Your **${pokemonName}** transformed into **${data.name}**!\nTypes: ${typeText}`
    );

    if (data.sprite) embed.setThumbnail(data.sprite);

    return message.reply({ embeds: [embed] });
};

// ===============================
// SHOP SYSTEM (PAGINATED + BUTTONS)
// ===============================

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

// Shop inventory (expandable)
const shopItems = [
    { name: "Pokéball", price: 50, desc: "Basic ball for catching Pokémon." },
    { name: "Great Ball", price: 100, desc: "Better catch rate than a Pokéball." },
    { name: "Ultra Ball", price: 200, desc: "High catch rate for tough Pokémon." },
    { name: "Mega Stone", price: 500, desc: "Required for Mega Evolution." },
    { name: "G-Max Candy", price: 500, desc: "Required for Gigantamax forms." },
    { name: "Rare Candy", price: 300, desc: "Instant level-up candy." },
    { name: "Potion", price: 50, desc: "Heals 20 HP." },
    { name: "Super Potion", price: 100, desc: "Heals 50 HP." },
    { name: "Hyper Potion", price: 200, desc: "Heals 120 HP." }
];

// Pagination helper
function getShopPage(page) {
    const itemsPerPage = 3;
    const start = page * itemsPerPage;
    const end = start + itemsPerPage;
    return shopItems.slice(start, end);
}

// SHOP COMMAND (with pagination)
commands.shop = async (message, args) => {
    let page = 0;
    const totalPages = Math.ceil(shopItems.length / 3);

    const renderPage = () => {
        const items = getShopPage(page);

        const desc = items
            .map((item, i) => 
                `**${item.name}** — ${item.price} coins\n*${item.desc}*\nUse: \`>buy ${item.name.toLowerCase()}\`\n`
            )
            .join("\n");

        const embed = chaosEmbed(
            "🛒 PokeChaos Shop",
            desc + `\nPage **${page + 1}** of **${totalPages}**`
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("shop_prev")
                .setLabel("⬅ Previous")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === 0),

            new ButtonBuilder()
                .setCustomId("shop_next")
                .setLabel("Next ➡")
                .setStyle(ButtonStyle.Primary)
                .setDisabled(page === totalPages - 1)
        );

        return { embed, row };
    };

    const { embed, row } = renderPage();

    const shopMsg = await message.reply({
        embeds: [embed],
        components: [row]
    });

    // Button collector
    const collector = shopMsg.createMessageComponentCollector({
        time: 120000
    });

    collector.on("collect", async (interaction) => {
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({
                content: "❌ This shop menu isn't yours.",
                ephemeral: true
            });
        }

        if (interaction.customId === "shop_prev") page--;
        if (interaction.customId === "shop_next") page++;

        const { embed, row } = renderPage();

        await interaction.update({
            embeds: [embed],
            components: [row]
        });
    });

    collector.on("end", () => {
        shopMsg.edit({ components: [] }).catch(() => {});
    });
};

// BUY COMMAND
commands.buy = async (message, args) => {
    const itemName = args.join(" ").toLowerCase();
    if (!itemName) {
        return message.reply({
            embeds: [chaosEmbed("🛒 Buy Item", "Usage: `>buy <item>`")]
        });
    }

    const item = shopItems.find(i => i.name.toLowerCase() === itemName);
    if (!item) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `Item **${itemName}** does not exist.`)]
        });
    }

    const balance = getCoins(message.author.id);
    if (balance < item.price) {
        return message.reply({
            embeds: [
                chaosEmbed(
                    "❌ Not Enough Coins",
                    `You need **${item.price}** coins but only have **${balance}**.`
                )
            ]
        });
    }

    removeCoins(message.author.id, item.price);

    return message.reply({
        embeds: [
            chaosEmbed(
                "🛒 Purchase Complete",
                `You bought **${item.name}** for **${item.price}** coins!`
            )
        ]
    });
};

// USE COMMAND (placeholder for future items)
commands.use = async (message, args) => {
    const itemName = args.join(" ").toLowerCase();
    if (!itemName) {
        return message.reply({
            embeds: [chaosEmbed("🎒 Use Item", "Usage: `>use <item>`")]
        });
    }

    return message.reply({
        embeds: [
            chaosEmbed(
                "🎒 Item Use",
                `Using **${itemName}** currently has no effect.\n(Feature coming soon!)`
            )
        ]
    });
};

// ===============================
// END OF SHOP SYSTEM
// ===============================

// ===============================
// POKÉDEX + INFO SYSTEM
// ===============================

commands.pokedex = async (message, args) => {
    const name = (args[0] || "").toLowerCase();
    if (!name) {
        return message.reply({
            embeds: [chaosEmbed("📘 Pokédex", "You must enter a Pokémon name.")]
        });
    }

    const data = await getStats(name);
    if (!data) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `No data found for **${name}**.`)]
        });
    }

    const dexEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle(`📘 Pokédex — ${name.toUpperCase()}`)
        .setDescription(
            `**HP:** ${data.hp}\n` +
            `**ATK:** ${data.atk}\n` +
            `**DEF:** ${data.def}\n` +
            `**SPD:** ${data.spd}`
        )
        .setFooter({ text: "PokeChaos • Pokédex Entry" });

    return message.reply({ embeds: [dexEmbed] });
};

// ===============================
// POKÉMON LIST SYSTEM
// ===============================

commands.mypokemon = async (message) => {
    const list = userPokemon[message.author.id];

    if (!list || list.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("📦 Empty Box", "You have no Pokémon yet.")]
        });
    }

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("📦 Your Pokémon")
        .setDescription(list.map((p, i) => `**${i + 1}.** ${p}`).join("\n"))
        .setFooter({ text: "PokeChaos • Storage Box" });

    return message.reply({ embeds: [embed] });
};

// ===============================
// RELEASE SYSTEM
// ===============================

commands.release = async (message, args) => {
    const index = parseInt(args[0]);
    const list = userPokemon[message.author.id];

    if (!list || list.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("📦 Empty Box", "You have no Pokémon to release.")]
        });
    }

    if (isNaN(index) || index < 1 || index > list.length) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Invalid Number", "Choose a valid Pokémon index.")]
        });
    }

    const removed = list.splice(index - 1, 1)[0];

    const releaseEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🕊️ Pokémon Released")
        .setDescription(`You released **${removed}** into the wild.`)
        .setFooter({ text: "PokeChaos • Release System" });

    return message.reply({ embeds: [releaseEmbed] });
};

// ===============================
// TRADE SYSTEM
// ===============================

commands.trade = async (message, args) => {
    const target = message.mentions.users.first();
    const giveIndex = parseInt(args[1]);
    const takeIndex = parseInt(args[2]);

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to trade with.")]
        });
    }

    const yourList = userPokemon[message.author.id] || [];
    const theirList = userPokemon[target.id] || [];

    if (!yourList[giveIndex - 1] || !theirList[takeIndex - 1]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Invalid Trade", "One of the Pokémon does not exist.")]
        });
    }

    const yours = yourList[giveIndex - 1];
    const theirs = theirList[takeIndex - 1];

    yourList[giveIndex - 1] = theirs;
    theirList[takeIndex - 1] = yours;

    const tradeEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔄 Trade Complete")
        .setDescription(
            `🤝 **${message.author.username}** traded **${yours}**\n` +
            `↔️ **${target.username}** traded **${theirs}**`
        )
        .setFooter({ text: "PokeChaos • Trading System" });

    return message.reply({ embeds: [tradeEmbed] });
};

// ===============================
// LEVEL SYSTEM (AUTO-LEVEL ON FIGHT)
// ===============================

function addXP(userId, amount) {
    if (!userXP[userId]) userXP[userId] = 0;
    userXP[userId] += amount;

    if (userXP[userId] >= 100) {
        userXP[userId] -= 100;
        userLevel[userId] = (userLevel[userId] || 1) + 1;
        return true;
    }
    return false;
}

commands.level = async (message) => {
    const lvl = userLevel[message.author.id] || 1;
    const xp = userXP[message.author.id] || 0;

    const lvlEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("📈 Your Level")
        .setDescription(`**Level:** ${lvl}\n**XP:** ${xp}/100`)
        .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513172787752075304/154efff0-fb3a-4262-9f50-833bd4a04bcb.png?ex=6a26c379&is=6a2571f9&hm=ff7acb9408067549290bcb175c58328c220b98ab44117e29d2b75824b5f2f52a") // placeholder
        .setFooter({ text: "PokeChaos • Level System" });

    return message.reply({ embeds: [lvlEmbed] });
};
// ===============================
// INVENTORY + ITEM SYSTEM
// ===============================

if (!userInventory) userInventory = {};

function getInventory(id) {
    if (!userInventory[id]) userInventory[id] = {};
    return userInventory[id];
}

function addItem(id, item, amount = 1) {
    const inv = getInventory(id);
    if (!inv[item]) inv[item] = 0;
    inv[item] += amount;
}

function removeItem(id, item, amount = 1) {
    const inv = getInventory(id);
    if (!inv[item] || inv[item] < amount) return false;
    inv[item] -= amount;
    if (inv[item] <= 0) delete inv[item];
    return true;
}

// ===============================
// INVENTORY COMMAND
// ===============================

commands.inventory = async (message) => {
    const inv = getInventory(message.author.id);
    const keys = Object.keys(inv);

    if (keys.length === 0) {
        return message.reply({
            embeds: [chaosEmbed("🎒 Empty Inventory", "You have no items yet.")]
        });
    }

    const invEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🎒 Your Inventory")
        .setDescription(
            keys.map(k => `**${k}:** ${inv[k]}`).join("\n")
        )
        .setFooter({ text: "PokeChaos • Inventory System" });

    return message.reply({ embeds: [invEmbed] });
};

// ===============================
// USE ITEM COMMAND
// ===============================

commands.use = async (message, args) => {
    const item = (args[0] || "").toLowerCase();
    if (!item) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing Item", "You must specify an item to use.")]
        });
    }

    const inv = getInventory(message.author.id);

    if (!inv[item]) {
        return message.reply({
            embeds: [chaosEmbed("❌ Not Found", `You don't have any **${item}**.`)]
        });
    }

    // Example effects
    let effectText = "";

    if (item === "potion") {
        effectText = "Your Pokémon feel refreshed!";
    } else if (item === "rare_candy") {
        const leveled = addXP(message.author.id, 100);
        effectText = leveled
            ? "🎉 Your level increased!"
            : "You gained XP!";
    } else {
        effectText = "This item has no effect yet.";
    }

    removeItem(message.author.id, item, 1);

    const useEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🧪 Item Used")
        .setDescription(
            `You used **${item}**.\n\n${effectText}`
        )
        .setFooter({ text: "PokeChaos • Item System" });

    return message.reply({ embeds: [useEmbed] });
};
// ===============================
// DAILY REWARD SYSTEM
// ===============================

if (!dailyCooldown) dailyCooldown = {};

commands.daily = async (message) => {
    const id = message.author.id;
    const now = Date.now();

    // 24 hours = 86400000 ms
    if (dailyCooldown[id] && now - dailyCooldown[id] < 86400000) {
        const remaining = 86400000 - (now - dailyCooldown[id]);
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);

        return message.reply({
            embeds: [
                chaosEmbed(
                    "⏳ Not Yet",
                    `You already claimed your daily reward.\nCome back in **${hours}h ${minutes}m**.`
                )
            ]
        });
    }

    // Reward
    const coins = Math.floor(Math.random() * 200) + 100;
    userCoins[id] = (userCoins[id] || 0) + coins;

    dailyCooldown[id] = now;

    const dailyEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🎁 Daily Reward")
        .setDescription(
            `You received **${coins} coins**!\n` +
            `Come back tomorrow for more rewards.`
        )
        .setFooter({ text: "PokeChaos • Daily System" });

    return message.reply({ embeds: [dailyEmbed] });
};

// ===============================
// COIN BALANCE SYSTEM
// ===============================

commands.balance = async (message) => {
    const id = message.author.id;
    const coins = userCoins[id] || 0;

    const balEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💰 Your Balance")
        .setDescription(`You currently have **${coins} coins**.`)
        .setFooter({ text: "PokeChaos • Economy System" });

    return message.reply({ embeds: [balEmbed] });
};

// ===============================
// GIVE COINS (OWNER ONLY)
// ===============================

commands.givecoins = async (message, args) => {
    const ownerId = "YOUR_OWNER_ID_HERE";
    if (message.author.id !== ownerId) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Access", "Only the owner can give coins.")]
        });
    }

    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!target || isNaN(amount) || amount <= 0) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Invalid Usage", "Use: `>givecoins @user amount`")]
        });
    }

    userCoins[target.id] = (userCoins[target.id] || 0) + amount;

    const giveEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💸 Coins Granted")
        .setDescription(
            `👑 **Owner Granted:** ${amount} coins\n` +
            `🎟 **To:** ${target}`
        )
        .setFooter({ text: "PokeChaos • Economy Control" });

    return message.reply({ embeds: [giveEmbed] });
};
// ===============================
// AFK SYSTEM
// ===============================

if (!userAFK) userAFK = {};

commands.afk = async (message, args) => {
    const reason = args.join(" ") || "AFK";

    userAFK[message.author.id] = reason;

    const afkEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("💤 AFK Enabled")
        .setDescription(
            `You are now marked as **AFK**.\n` +
            `📌 **Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • AFK System" });

    return message.reply({ embeds: [afkEmbed] });
};

// ===============================
// REMOVE AFK ON MESSAGE
// ===============================

client.on("messageCreate", async (msg) => {
    if (msg.author.bot) return;

    if (userAFK[msg.author.id]) {
        delete userAFK[msg.author.id];

        const backEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🔔 Welcome Back")
            .setDescription("You are no longer AFK.")
            .setFooter({ text: "PokeChaos • AFK System" });

        return msg.reply({ embeds: [backEmbed] });
    }

    // Notify if tagging AFK user
    if (msg.mentions.users.size > 0) {
        msg.mentions.users.forEach((u) => {
            if (userAFK[u.id]) {
                msg.reply({
                    embeds: [
                        chaosEmbed(
                            "💤 User AFK",
                            `${u.username} is AFK.\n📌 **Reason:** ${userAFK[u.id]}`
                        )
                    ]
                });
            }
        });
    }
});

// ===============================
// REMINDER SYSTEM
// ===============================

if (!userReminders) userReminders = [];

commands.remind = async (message, args) => {
    const time = parseInt(args[0]);
    const text = args.slice(1).join(" ");

    if (!time || !text) {
        return message.reply({
            embeds: [
                chaosEmbed(
                    "⏰ Invalid Usage",
                    "Use: `>remind <seconds> <message>`"
                )
            ]
        });
    }

    const remindEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("⏰ Reminder Set")
        .setDescription(
            `I will remind you in **${time} seconds**.\n` +
            `📌 **Message:** ${text}`
        )
        .setFooter({ text: "PokeChaos • Reminder System" });

    message.reply({ embeds: [remindEmbed] });

    setTimeout(() => {
        const doneEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🔔 Reminder")
            .setDescription(text)
            .setFooter({ text: "PokeChaos • Reminder System" });

        message.author.send({ embeds: [doneEmbed] }).catch(() => {});
    }, time * 1000);
};

// ===============================
// WELCOME SYSTEM
// ===============================

client.on("guildMemberAdd", async (member) => {
    const channel = member.guild.systemChannel;
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🌟 Welcome!")
        .setDescription(
            `Welcome to **${member.guild.name}**, ${member}!\n` +
            `Enjoy your stay!`
        )
        .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513171346421715079/standard_1.gif?ex=6a26c222&is=6a2570a2&hm=a693772ecd22fe94ffb29c22ad2ed99115abee36ec72672109e379643002f1fd")
        .setFooter({ text: "PokeChaos • Welcome System" });

    channel.send({ embeds: [welcomeEmbed] });
});
// ===============================
// GIVEAWAY SYSTEM
// ===============================

if (!activeGiveaways) activeGiveaways = {};

commands.giveaway = async (message, args) => {
    const duration = parseInt(args[0]);
    const prize = args.slice(1).join(" ");

    if (!duration || !prize) {
        return message.reply({
            embeds: [
                chaosEmbed(
                    "🎉 Giveaway Setup",
                    "Use: `>giveaway <seconds> <prize>`"
                )
            ]
        });
    }

    const id = Date.now().toString();
    activeGiveaways[id] = {
        host: message.author.id,
        prize,
        entrants: [],
        channel: message.channel.id
    };

    const gEmbed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🎉 GIVEAWAY STARTED")
        .setDescription(
            `🎁 **Prize:** ${prize}\n` +
            `⏳ **Duration:** ${duration} seconds\n` +
            `👑 **Host:** ${message.author}`
        )
        .setImage("https://cdn.discordapp.com/attachments/1479684491927748678/1512242134886125760/lv_0_20260604191428.jpg?ex=6a26ac7d&is=6a255afd&hm=e7259d513605b0a690cd4fe14baeb569d3425e6b2260a9aff8f206926210ca22")
        .setFooter({ text: "React with 🎉 to enter!" });

    const msg = await message.reply({ embeds: [gEmbed] });
    await msg.react("🎉");

    // Collect reactions
    const filter = (reaction, user) =>
        reaction.emoji.name === "🎉" && !user.bot;

    const collector = msg.createReactionCollector({ filter, time: duration * 1000 });

    collector.on("collect", (reaction, user) => {
        if (!activeGiveaways[id].entrants.includes(user.id)) {
            activeGiveaways[id].entrants.push(user.id);
        }
    });

    collector.on("end", async () => {
        const g = activeGiveaways[id];
        if (!g) return;

        const entrants = g.entrants;
        delete activeGiveaways[id];

        if (entrants.length === 0) {
            return message.channel.send({
                embeds: [
                    chaosEmbed(
                        "😔 No Entries",
                        "Nobody entered the giveaway."
                    )
                ]
            });
        }

        const winner = entrants[Math.floor(Math.random() * entrants.length)];

        const winEmbed = new EmbedBuilder()
            .setColor(0x0f859d)
            .setTitle("🎉 GIVEAWAY WINNER")
            .setDescription(
                `🏆 **Winner:** <@${winner}>\n` +
                `🎁 **Prize:** ${prize}\n` +
                `👑 **Hosted By:** <@${g.host}>`
            )
            .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513177264412430406/ChatGPT_Image_Jun_7_2026_09_46_02_AM.png?ex=6a26c7a5&is=6a257625&hm=7edb3fa8062d9ddf6d0343dc75e55a930490b13ba5d890be0ad64618577a60f5")
            .setFooter({ text: "Congratulations!" });

        return message.channel.send({ embeds: [winEmbed] });
    });
};
// ===============================
// MODERATION SYSTEM
// ===============================

commands.kick = async (message, args) => {
    if (!message.member.permissions.has("KickMembers")) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot kick members.")]
        });
    }

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason provided.";

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to kick.")]
        });
    }

    await target.kick(reason).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("👢 Member Kicked")
        .setDescription(
            `**User:** ${target.user.tag}\n` +
            `**Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.ban = async (message, args) => {
    if (!message.member.permissions.has("BanMembers")) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot ban members.")]
        });
    }

    const target = message.mentions.members.first();
    const reason = args.slice(1).join(" ") || "No reason provided.";

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to ban.")]
        });
    }

    await target.ban({ reason }).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔨 Member Banned")
        .setDescription(
            `**User:** ${target.user.tag}\n` +
            `**Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.unban = async (message, args) => {
    if (!message.member.permissions.has("BanMembers")) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot unban members.")]
        });
    }

    const userId = args[0];
    if (!userId) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing ID", "Provide a user ID to unban.")]
        });
    }

    message.guild.members.unban(userId).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔓 Member Unbanned")
        .setDescription(`User with ID **${userId}** has been unbanned.`)
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.mute = async (message, args) => {
    if (!message.member.permissions.has("ModerateMembers")) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot mute members.")]
        });
    }

    const target = message.mentions.members.first();
    const duration = parseInt(args[1]) || 10; // minutes
    const reason = args.slice(2).join(" ") || "No reason provided.";

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to mute.")]
        });
    }

    await target.timeout(duration * 60 * 1000, reason).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔇 Member Muted")
        .setDescription(
            `**User:** ${target.user.tag}\n` +
            `**Duration:** ${duration} minutes\n` +
            `**Reason:** ${reason}`
        )
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.unmute = async (message, args) => {
    if (!message.member.permissions.has("ModerateMembers")) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot unmute members.")]
        });
    }

    const target = message.mentions.members.first();

    if (!target) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Missing User", "Mention someone to unmute.")]
        });
    }

    await target.timeout(null).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🔊 Member Unmuted")
        .setDescription(`**User:** ${target.user.tag} has been unmuted.`)
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};

commands.clear = async (message, args) => {
    if (!message.member.permissions.has("ManageMessages")) {
        return message.reply({
            embeds: [chaosEmbed("❌ No Permission", "You cannot clear messages.")]
        });
    }

    const amount = parseInt(args[0]);
    if (!amount || amount < 1 || amount > 100) {
        return message.reply({
            embeds: [chaosEmbed("⚠️ Invalid Number", "Choose a number between 1 and 100.")]
        });
    }

    await message.channel.bulkDelete(amount, true).catch(() => {});

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🧹 Messages Cleared")
        .setDescription(`Deleted **${amount}** messages.`)
        .setFooter({ text: "PokeChaos • Moderation" });

    return message.reply({ embeds: [embed] });
};
// ===============================
// UTILITY COMMANDS
// ===============================

commands.ping = async (message) => {
    const ping = Date.now() - message.createdTimestamp;

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("🏓 Pong!")
        .setDescription(`Latency: **${ping}ms**`)
        .setFooter({ text: "PokeChaos • Utility" });

    return message.reply({ embeds: [embed] });
};

commands.uptime = async (message) => {
    const totalSeconds = Math.floor(process.uptime());
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("⏱️ Bot Uptime")
        .setDescription(
            `**${hours}h ${minutes}m ${seconds}s**`
        )

    return message.reply({ embeds: [embed] });
};

// ===============================
// HELP COMMAND
// ===============================

commands.help = async (message) => {
    const embed = new EmbedBuilder()
        .setColor(0x0f859d)
        .setTitle("📜 Command List")
        .setDescription(
            "**Pokémon Commands**\n" +
            ">spawn, >catch, >catchwild, >pokedex, >pokemon, >team, >release, >trade, >fight, >boss, >fightboss, >mega, >gigantamax\n\n" +
            "**Economy Commands**\n" +
            ">balance, >daily, >givecoins, >shop, >buy, >inventory, >use\n\n" +
            "**Gambling Commands**\n" +
            ">coinflip, >slots, >blackjack, >hit, >stand\n\n" +
            "**Games**\n" +
            ">uno, >hangman, >guess\n\n" +
            "**Moderation**\n" +
            ">kick, >ban, >unban, >mute, >unmute, >clear\n\n" +
            "**Utility**\n" +
            ">ping, >uptime\n\n" +
            "**Owner**\n" +
            ">ownerspawn"
        )
        .setImage("https://cdn.discordapp.com/attachments/1506335068312965150/1513173721529978900/f235b0cd-7480-4424-bf60-df4e329311de.png?ex=6a26c458&is=6a2572d8&hm=88c264bb0157b7fead3100604e8d49231336c3b82eba6a0e91051f56db3e4bd5")

    return message.reply({ embeds: [embed] });
};

// ===============================
// BOT READY MESSAGE
// ===============================

client.on("ready", () => {
    console.log(`Bot logged in as ${client.user.tag}`);
});
// ===============================
// DATA SAVE + LOAD SYSTEM
// ===============================

const SAVE_PATH = path.join(__dirname, "chaosdata.json");

function loadAllData() {
    try {
        const raw = fs.readFileSync(SAVE_PATH, "utf8");
        const parsed = JSON.parse(raw);

        userPokemon = parsed.userPokemon || {};
        userCoins = parsed.userCoins || {};
        userInventory = parsed.userInventory || {};
        userXP = parsed.userXP || {};
        userLevel = parsed.userLevel || {};
        ownerspawnData = parsed.ownerspawnData || {};

    } catch {
        userPokemon = {};
        userCoins = {};
        userInventory = {};
        userXP = {};
        userLevel = {};
        ownerspawnData = {};
    }
}

function saveAllData() {
    const data = {
        userPokemon,
        userCoins,
        userInventory,
        userXP,
        userLevel,
        ownerspawnData
    };

    fs.writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2), "utf8");
}

// Auto‑save every 30 seconds
setInterval(() => {
    saveAllData();
}, 30000);

// Load on startup
loadAllData();

// ===============================
// EXPORT COMMANDS
// ===============================

module.exports = {
    commands
};
// ===============================
// BOT ONLINE + LOGIN
// ===============================

client.once("ready", () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

// Make sure this is the LAST line in the entire file
client.login(process.env.TOKEN);
