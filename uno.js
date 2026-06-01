// Simple in-memory UNO system per channel

const COLORS = ["red", "yellow", "green", "blue"];
const VALUES = ["0","1","2","3","4","5","6","7","8","9","skip","reverse","+2"];

function createDeck() {
    const deck = [];
    for (const color of COLORS) {
        for (const value of VALUES) {
            deck.push({ color, value });
            if (value !== "0") deck.push({ color, value }); // two of each except 0
        }
    }
    // No wilds for now to keep it simple
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
}

function cardToString(card) {
    return `${card.color.toUpperCase()} ${card.value.toUpperCase()}`;
}

const games = new Map(); // channelId -> game state

function getGame(channelId) {
    return games.get(channelId);
}

function createGame(channelId, hostId) {
    const game = {
        hostId,
        players: [],
        hands: new Map(), // userId -> [cards]
        deck: createDeck(),
        discard: [],
        currentPlayerIndex: 0,
        direction: 1,
        started: false
    };
    games.set(channelId, game);
    return game;
}

function dealInitialHands(game) {
    for (const playerId of game.players) {
        const hand = [];
        for (let i = 0; i < 7; i++) {
            hand.push(game.deck.pop());
        }
        game.hands.set(playerId, hand);
    }
    // Flip first card
    game.discard.push(game.deck.pop());
}

function getCurrentPlayerId(game) {
    return game.players[game.currentPlayerIndex];
}

function advanceTurn(game, skip = false) {
    let step = skip ? 2 : 1;
    game.currentPlayerIndex =
        (game.currentPlayerIndex + step * game.direction + game.players.length) %
        game.players.length;
}

function canPlay(card, top) {
    return card.color === top.color || card.value === top.value;
}

async function handleUnoCommand(msg) {
    const channelId = msg.channel.id;
    const args = msg.content.trim().split(/\s+/);
    const sub = args[1]?.toLowerCase();

    if (!sub) {
        return msg.reply("UNO commands: `!uno start`, `!uno join`, `!uno begin`, `!uno hand`, `!uno play <color> <value>`, `!uno draw`");
    }

    if (sub === "start") {
        if (getGame(channelId)) {
            return msg.reply("❌ A UNO game is already running in this channel.");
        }
        const game = createGame(channelId, msg.author.id);
        game.players.push(msg.author.id);
        return msg.reply("🎮 UNO game created! Others can `!uno join`.");
    }

    if (sub === "join") {
        const game = getGame(channelId);
        if (!game) return msg.reply("❌ No UNO game here. Use `!uno start`.");
        if (game.started) return msg.reply("❌ Game already started.");
        if (game.players.includes(msg.author.id)) {
            return msg.reply("❌ You are already in the game.");
        }
        game.players.push(msg.author.id);
        return msg.reply(`✅ ${msg.author.username} joined the UNO game.`);
    }

    if (sub === "begin") {
        const game = getGame(channelId);
        if (!game) return msg.reply("❌ No UNO game here. Use `!uno start`.");
        if (game.hostId !== msg.author.id) {
            return msg.reply("❌ Only the host can begin the game.");
        }
        if (game.players.length < 2) {
            return msg.reply("❌ Need at least 2 players to start UNO.");
        }
        if (game.started) return msg.reply("❌ Game already started.");

        dealInitialHands(game);
        game.started = true;

        const top = game.discard[game.discard.length - 1];
        let playersList = game.players
            .map((id) => `<@${id}>`)
            .join(", ");

        await msg.channel.send(`🃏 UNO has begun!\nPlayers: ${playersList}\nTop card: **${cardToString(top)}**\nIt's <@${getCurrentPlayerId(game)}>’s turn.`);

        return;
    }

    if (sub === "hand") {
        const game = getGame(channelId);
        if (!game || !game.started) {
            return msg.reply("❌ No active UNO game.");
        }
        const hand = game.hands.get(msg.author.id);
        if (!hand) return msg.reply("❌ You are not in this game.");

        const handStr = hand.map(cardToString).join(", ");
        return msg.author.send(`🃏 Your UNO hand:\n${handStr}`).then(() => {
            msg.reply("📨 I sent your hand in DMs.");
        }).catch(() => {
            msg.reply("❌ I couldn't DM you. Check your privacy settings.");
        });
    }

    if (sub === "play") {
        const game = getGame(channelId);
        if (!game || !game.started) {
            return msg.reply("❌ No active UNO game.");
        }
        if (getCurrentPlayerId(game) !== msg.author.id) {
            return msg.reply("❌ It's not your turn.");
        }

        const color = args[2]?.toLowerCase();
        const value = args[3]?.toLowerCase();
        if (!color || !value) {
            return msg.reply("Usage: `!uno play <color> <value>` (e.g. `!uno play red 5`)");
        }

        const hand = game.hands.get(msg.author.id) || [];
        const top = game.discard[game.discard.length - 1];

        const index = hand.findIndex(
            (c) => c.color === color && c.value === value
        );
        if (index === -1) {
            return msg.reply("❌ You don't have that card.");
        }

        const card = hand[index];
        if (!canPlay(card, top)) {
            return msg.reply(`❌ You can't play that on **${cardToString(top)}**.`);
        }

        // Play card
        hand.splice(index, 1);
        game.discard.push(card);

        let extraMsg = "";

        if (card.value === "skip") {
            extraMsg = "⏭️ Next player is skipped!";
            advanceTurn(game, true);
        } else if (card.value === "reverse") {
            game.direction *= -1;
            extraMsg = "🔁 Play direction reversed!";
            advanceTurn(game, false);
        } else if (card.value === "+2") {
            advanceTurn(game, false);
            const targetId = getCurrentPlayerId(game);
            const targetHand = game.hands.get(targetId) || [];
            for (let i = 0; i < 2; i++) {
                targetHand.push(game.deck.pop());
            }
            game.hands.set(targetId, targetHand);
            extraMsg = `➕ <@${targetId}> draws 2 cards!`;
        } else {
            advanceTurn(game, false);
        }

        if (hand.length === 0) {
            games.delete(channelId);
            return msg.channel.send(`🏆 **${msg.author.username}** has won UNO!`);
        }

        const nextId = getCurrentPlayerId(game);
        return msg.channel.send(
            `✅ ${msg.author.username} played **${cardToString(card)}**.\n${extraMsg}\nTop card: **${cardToString(card)}**\nIt's now <@${nextId}>’s turn.`
        );
    }

    if (sub === "draw") {
        const game = getGame(channelId);
        if (!game || !game.started) {
            return msg.reply("❌ No active UNO game.");
        }
        if (getCurrentPlayerId(game) !== msg.author.id) {
            return msg.reply("❌ It's not your turn.");
        }

        const hand = game.hands.get(msg.author.id) || [];
        if (game.deck.length === 0) {
            return msg.reply("❌ The deck is empty!");
        }

        const card = game.deck.pop();
        hand.push(card);
        game.hands.set(msg.author.id, hand);

        advanceTurn(game, false);

        const nextId = getCurrentPlayerId(game);
        return msg.channel.send(
            `🃏 ${msg.author.username} drew a card.\nIt's now <@${nextId}>’s turn.`
        );
    }

    if (sub === "end") {
        const game = getGame(channelId);
        if (!game) return msg.reply("❌ No UNO game to end.");
        if (game.hostId !== msg.author.id) {
            return msg.reply("❌ Only the host can end the game.");
        }
        games.delete(channelId);
        return msg.channel.send("🛑 UNO game ended.");
    }

    return msg.reply("Unknown UNO command.");
}

module.exports = {
    handleUnoCommand
};
