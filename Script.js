// Game variables
let gameMode = null; // 'ai' or 'friend'
let currentScreen = 'welcome';
let difficulty = 'easy'; // Default difficulty
let gameState = {
    deck: [],
    discardPile: [],
    playerHand: [],
    opponentHand: [],
    currentPlayer: 'player', // 'player' or 'opponent'
    direction: 1, // 1 for clockwise, -1 for counter-clockwise
    currentColor: null,
    currentNumber: null,
    gameOver: false,
    winner: null
};
// Analytics tracking
let analytics = {
    gameStart: null,
    gameEnd: null,
    turnCount: 0,
    playerTurns: [],
    specialCardsUsed: 0,
    colorCounts: {
        purple: 0,
        teal: 0,
        amber: 0,
        coral: 0
    },
    wildColorChoices: {
        purple: 0,
        teal: 0,
        amber: 0,
        coral: 0
    },
    drawCount: 0,
    unoButtonPressed: false
};
// Player stats (persisted between games)
let playerStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    totalTurnTime: 0,
    totalTurns: 0,
    specialCardsUsed: 0,
    currentStreak: 0,
    bestStreak: 0,
    unosCalled: 0,
    unosMissed: 0,
    colorCounts: {
        purple: 0,
        teal: 0,
        amber: 0,
        coral: 0
    },
    difficultyWins: {
        easy: 0,
        medium: 0,
        hard: 0
    }
};

// Load player stats from localStorage if available
function loadPlayerStats() {
    const savedStats = localStorage.getItem('spectrumClashStats');
    if (savedStats) {
        playerStats = JSON.parse(savedStats);

        // Add new fields if they don't exist (for backwards compatibility)
        if (!playerStats.currentStreak) playerStats.currentStreak = 0;
        if (!playerStats.bestStreak) playerStats.bestStreak = 0;
        if (!playerStats.unosCalled) playerStats.unosCalled = 0;
        if (!playerStats.unosMissed) playerStats.unosMissed = 0;
        if (!playerStats.difficultyWins) {
            playerStats.difficultyWins = {
                easy: 0,
                medium: 0,
                hard: 0
            };
        }
    }
}

// Save player stats to localStorage
function savePlayerStats() {
    localStorage.setItem('spectrumClashStats', JSON.stringify(playerStats));
}

// Initialize game
document.addEventListener('DOMContentLoaded', function () {
    // Load player stats
    loadPlayerStats();
    updateStatsScreen();

    // Add event listeners to buttons
    document.getElementById('play-ai-btn').addEventListener('click', () => startGame('ai'));
    document.getElementById('stats-btn').addEventListener('click', () => showScreen('stats'));
    document.getElementById('rules-btn').addEventListener('click', () => showScreen('rules'));
    document.getElementById('rules-back-btn').addEventListener('click', () => showScreen('welcome'));
    document.getElementById('stats-back-btn').addEventListener('click', () => showScreen('welcome'));
    document.getElementById('menu-btn').addEventListener('click', confirmExitGame);
    document.getElementById('play-again-btn').addEventListener('click', () => {
        gameMode === 'ai' ? startGame('ai') : startGame('friend');
    });
    document.getElementById('main-menu-btn').addEventListener('click', () => showScreen('welcome'));
    document.getElementById('draw-pile').addEventListener('click', drawCard);
    document.getElementById('uno-button').addEventListener('click', pressUnoButton);

    // Add event listeners for color selection
    const colorOptions = document.querySelectorAll('.color-option');
    colorOptions.forEach(option => {
        option.addEventListener('click', () => selectWildColor(option.dataset.color));
    });

    // Add event listeners for difficulty selection
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => selectDifficulty(button.dataset.difficulty));
    });

    // Setup fullscreen button
    setupFullscreenButton();
});

// CARD GENERATION AND GAME SETUP FUNCTIONS

// Select difficulty
function selectDifficulty(selectedDifficulty) {
    difficulty = selectedDifficulty;

    // Update UI
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    difficultyButtons.forEach(button => {
        button.classList.remove('selected');
        if (button.dataset.difficulty === selectedDifficulty) {
            button.classList.add('selected');
        }
    });

    document.getElementById('difficulty-level').textContent = selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1);
}

// Create a new card object
function createCard(color, value, type) {
    return {
        color: color,
        value: value,
        type: type
    };
}

// Create a complete deck of cards
function createDeck() {
    const colors = ['purple', 'teal', 'amber', 'coral'];
    const values = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const specialTypes = ['skip', 'reverse', 'draw-two'];
    let deck = [];

    // Add number cards (0-9) - one zero and two of each 1-9 per color
    colors.forEach(color => {
        // Add one zero card per color
        deck.push(createCard(color, 0, 'number'));

        // Add two of each number 1-9 per color
        values.slice(1).forEach(value => {
            deck.push(createCard(color, value, 'number'));
            deck.push(createCard(color, value, 'number'));
        });

        // Add special cards (skip, reverse, draw-two) - two of each per color
        specialTypes.forEach(type => {
            deck.push(createCard(color, null, type));
            deck.push(createCard(color, null, type));
        });
    });

    // Add wild cards and wild draw four cards
    for (let i = 0; i < 4; i++) {
        deck.push(createCard('wild', null, 'wild'));
        deck.push(createCard('wild', null, 'wild-draw-four'));
    }

    return deck;
}

// Shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Deal cards to players
function dealCards(numCards = 7) {
    for (let i = 0; i < numCards; i++) {
        gameState.playerHand.push(gameState.deck.pop());
        gameState.opponentHand.push(gameState.deck.pop());
    }
}

// Initialize game state
function initGameState() {
    // Create and shuffle deck
    gameState.deck = shuffleArray(createDeck());
    gameState.discardPile = [];
    gameState.playerHand = [];
    gameState.opponentHand = [];
    gameState.currentPlayer = 'player';
    gameState.direction = 1;
    gameState.gameOver = false;
    gameState.winner = null;

    // Deal cards
    dealCards();

    // Place first card on discard pile (not a wild card)
    let firstCard;
    do {
        firstCard = gameState.deck.pop();
        // If it's a wild card, put it back in the deck and shuffle again
        if (firstCard.type === 'wild' || firstCard.type === 'wild-draw-four') {
            gameState.deck.push(firstCard);
            shuffleArray(gameState.deck);
        } else {
            break;
        }
    } while (true);

    gameState.discardPile.push(firstCard);
    gameState.currentColor = firstCard.color;
    gameState.currentNumber = firstCard.value;

    // Reset analytics
    analytics = {
        gameStart: new Date(),
        gameEnd: null,
        turnCount: 0,
        playerTurns: [],
        specialCardsUsed: 0,
        colorCounts: {
            purple: 0,
            teal: 0,
            amber: 0,
            coral: 0
        },
        wildColorChoices: {
            purple: 0,
            teal: 0,
            amber: 0,
            coral: 0
        },
        drawCount: 0,
        unoButtonPressed: false
    };

    // Apply effects of first card if it's special
    applySpecialCardEffect(firstCard);
}

// GAMEPLAY FUNCTIONS

// Start a new game
function startGame(mode) {
    gameMode = mode;
    initGameState();
    showScreen('game');
    renderGame();

    // Update player stats
    playerStats.gamesPlayed++;
    savePlayerStats();

    // Show notification
    showNotification(`Game started! ${gameMode === 'ai' ? 'Playing against AI' : 'Playing against a friend'}`);
}

// Setup fullscreen button
function setupFullscreenButton() {
    // Create fullscreen button if it doesn't exist
    if (!document.getElementById('fullscreen-btn')) {
        const fullscreenBtn = document.createElement('button');
        fullscreenBtn.id = 'fullscreen-btn';
        fullscreenBtn.innerHTML = '⛶';
        fullscreenBtn.className = 'game-control-btn';
        fullscreenBtn.addEventListener('click', toggleFullscreen);

        // Add fullscreen button to top right corner of welcome screen
        const welcomeScreen = document.getElementById('welcome-screen');
        const fullscreenContainer = document.createElement('div');
        fullscreenContainer.id = 'fullscreen-container';
        fullscreenContainer.className = 'fullscreen-container';
        fullscreenContainer.appendChild(fullscreenBtn);
        welcomeScreen.appendChild(fullscreenContainer);

        // Also add fullscreen button next to menu button in game screen
        const menuBtn = document.getElementById('menu-btn');
        if (menuBtn && menuBtn.parentElement) {
            // Create another fullscreen button for game screen
            const gameFullscreenBtn = fullscreenBtn.cloneNode(true);
            gameFullscreenBtn.id = 'game-fullscreen-btn';
            gameFullscreenBtn.addEventListener('click', toggleFullscreen);
            menuBtn.parentElement.insertBefore(gameFullscreenBtn, menuBtn);
        }
    }
}

// Switch between screens
function showScreen(screen) {
    currentScreen = screen;

    // Hide all screens
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('rules-screen').classList.add('hidden');
    document.getElementById('stats-screen').classList.add('hidden');

    // Show selected screen
    document.getElementById(`${screen}-screen`).classList.remove('hidden');

    // Additional actions per screen
    if (screen === 'stats') {
        updateStatsScreen();
    } else if (screen === 'game') {
        // Ensure fullscreen button is properly set up when entering game screen
        setupFullscreenButton();
    }
}

// Confirm exit game
function confirmExitGame() {
    if (confirm('Are you sure you want to exit the current game?')) {
        showScreen('welcome');
    }
}

// Update the stats screen with player stats
function updateStatsScreen() {
    document.getElementById('games-played').textContent = playerStats.gamesPlayed;
    document.getElementById('games-won').textContent = playerStats.gamesWon;
    document.getElementById('win-rate').textContent =
        playerStats.gamesPlayed > 0
            ? `${Math.round((playerStats.gamesWon / playerStats.gamesPlayed) * 100)}%`
            : '0%';

    document.getElementById('avg-turn-time').textContent =
        playerStats.totalTurns > 0
            ? `${(playerStats.totalTurnTime / playerStats.totalTurns).toFixed(1)}s`
            : '0.0s';

    // Update streaks
    document.getElementById('current-streak').textContent = playerStats.currentStreak;
    document.getElementById('best-streak').textContent = playerStats.bestStreak;

    // Update UNO stats
    document.getElementById('unos-called').textContent = playerStats.unosCalled;
    document.getElementById('unos-missed').textContent = playerStats.unosMissed;

    // Update difficulty wins
    document.getElementById('easy-wins').textContent = playerStats.difficultyWins.easy;
    document.getElementById('medium-wins').textContent = playerStats.difficultyWins.medium;
    document.getElementById('hard-wins').textContent = playerStats.difficultyWins.hard;

    // Determine favorite color
    const colorCounts = playerStats.colorCounts;
    const maxColor = Object.keys(colorCounts).reduce((a, b) =>
        colorCounts[a] > colorCounts[b] ? a : b, 'purple');

    document.getElementById('favorite-color').textContent =
        colorCounts[maxColor] > 0 ? maxColor.charAt(0).toUpperCase() + maxColor.slice(1) : 'None';

    document.getElementById('special-cards-used').textContent = playerStats.specialCardsUsed;

    // Generate performance insights based on stats
    let insightText = '';
    if (playerStats.gamesPlayed === 0) {
        insightText = 'Complete a game to receive insights!';
    } else if (playerStats.gamesPlayed < 5) {
        insightText = 'Play more games to unlock detailed insights!';
    } else {
        if (playerStats.unosMissed > playerStats.unosCalled) {
            insightText = "Don't forget to call UNO when you have one card left!";
        } else if (playerStats.totalTurns > 0 && (playerStats.totalTurnTime / playerStats.totalTurns) > 5) {
            insightText = 'Try to make decisions faster to improve your gameplay.';
        } else if (playerStats.gamesWon / playerStats.gamesPlayed < 0.4) {
            insightText = 'Try to save special cards for strategic moments!';
        } else if (playerStats.difficultyWins.hard === 0 && playerStats.gamesPlayed > 10) {
            insightText = 'Challenge yourself with hard difficulty!';
        } else {
            insightText = 'Great job! You\'re becoming a Spectrum Clash master!';
        }
    }
    document.getElementById('insight-text').textContent = insightText;
}

// Render the game state
function renderGame() {
    // Update card counts
    document.getElementById('player-card-count').textContent = gameState.playerHand.length;
    document.getElementById('opponent-card-count').textContent = gameState.opponentHand.length;

    // Render player hand
    const playerHandElement = document.getElementById('player-hand');
    playerHandElement.innerHTML = '';
    gameState.playerHand.forEach((card, index) => {
        const cardElement = createCardElement(card);
        cardElement.dataset.index = index;
        cardElement.addEventListener('click', () => playCard(index));
        playerHandElement.appendChild(cardElement);
    });

    // Render opponent hand (face down)
    const opponentHandElement = document.getElementById('opponent-hand');
    opponentHandElement.innerHTML = '';
    gameState.opponentHand.forEach(() => {
        const cardElement = document.createElement('div');
        cardElement.className = 'card card-back';
        opponentHandElement.appendChild(cardElement);
    });

    // Render discard pile
    const discardPileElement = document.getElementById('discard-pile');
    discardPileElement.innerHTML = '';
    if (gameState.discardPile.length > 0) {
        const topCard = gameState.discardPile[gameState.discardPile.length - 1];
        const cardElement = createCardElement(topCard);
        discardPileElement.appendChild(cardElement);
    }

    // Update turn indicator
    document.getElementById('current-player').textContent =
        gameState.currentPlayer === 'player' ? 'Your Turn' : 'Opponent\'s Turn';
    document.getElementById('turn-direction').textContent =
        gameState.direction === 1 ? '➡️' : '⬅️';

    // Show/hide AI thinking indicator
    const aiThinking = document.getElementById('ai-thinking');
    if (gameState.currentPlayer === 'opponent' && gameMode === 'ai' && !gameState.gameOver) {
        aiThinking.classList.remove('hidden');
    } else {
        aiThinking.classList.add('hidden');
    }

    // Show UNO button if player has only one card
    const unoButton = document.getElementById('uno-button');
    if (gameState.playerHand.length === 1 && !analytics.unoButtonPressed) {
        unoButton.classList.remove('hidden');
    } else {
        unoButton.classList.add('hidden');
    }

    // Update game status
    document.getElementById('game-status').textContent =
        gameState.currentPlayer === 'player' ? 'Your turn' : 'Opponent\'s turn';

    // Trigger AI turn if it's the opponent's turn and we're in AI mode
    if (gameMode === 'ai' && gameState.currentPlayer === 'opponent' && !gameState.gameOver) {
        setTimeout(playAITurn, 1000);
    }
}

// Create a card element based on a card object
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.color}`;

    let content = '';
    if (card.type === 'number') {
        content = `<div class="card-value">${card.value}</div>`;
    } else if (card.type === 'skip') {
        content = '<div class="card-symbol">⊘</div>';
    } else if (card.type === 'reverse') {
        content = '<div class="card-symbol">↻</div>';
    } else if (card.type === 'draw-two') {
        content = '<div class="card-symbol">+2</div>';
    } else if (card.type === 'wild' || card.type === 'wild-draw-four') {
        // Create a multi-colored wild card
        cardElement.classList.remove(card.color);
        cardElement.classList.add('wild-card');

        content = `
    <div class="wild-quadrant purple-bg"></div>
    <div class="wild-quadrant teal-bg"></div>
    <div class="wild-quadrant amber-bg"></div>
    <div class="wild-quadrant coral-bg"></div>
    <div class="wild-symbol">${card.type === 'wild' ? 'W' : '+4'}</div>
`;
    }

    cardElement.innerHTML = content;

    // Add tooltip description
    let description = '';
    if (card.type === 'number') {
        description = `${card.color} ${card.value}`;
    } else if (card.type === 'skip') {
        description = `${card.color} Skip`;
    } else if (card.type === 'reverse') {
        description = `${card.color} Reverse`;
    } else if (card.type === 'draw-two') {
        description = `${card.color} Draw Two`;
    } else if (card.type === 'wild') {
        description = 'Wild';
    } else if (card.type === 'wild-draw-four') {
        description = 'Wild Draw Four';
    }

    cardElement.setAttribute('title', description);
    cardElement.setAttribute('aria-label', description);

    return cardElement;
}

// Play a card from the player's hand
function playCard(index) {
    // Only allow playing if it's the player's turn
    if (gameState.currentPlayer !== 'player' || gameState.gameOver) {
        return;
    }

    const card = gameState.playerHand[index];

    // Check if card can be played
    if (isValidPlay(card)) {
        // Remove card from hand
        gameState.playerHand.splice(index, 1);

        // Add card to discard pile
        gameState.discardPile.push(card);

        // Update current color and number
        if (card.color !== 'wild') {
            gameState.currentColor = card.color;
            gameState.currentNumber = card.value;

            // Update color analytics
            analytics.colorCounts[card.color]++;
            playerStats.colorCounts[card.color]++;
        }

        // Track turn
        const turnEndTime = new Date();
        if (analytics.playerTurns.length > 0) {
            const lastTurn = analytics.playerTurns[analytics.playerTurns.length - 1];
            const turnDuration = (turnEndTime - new Date(lastTurn.endTime)) / 1000;
            analytics.playerTurns.push({
                cardPlayed: card,
                endTime: turnEndTime,
                duration: turnDuration
            });

            // Update player stats
            playerStats.totalTurnTime += turnDuration;
            playerStats.totalTurns++;
        } else {
            analytics.playerTurns.push({
                cardPlayed: card,
                endTime: turnEndTime,
                duration: 0
            });
        }

        // Track special cards
        if (card.type !== 'number') {
            analytics.specialCardsUsed++;
            playerStats.specialCardsUsed++;
        }

        // If it's a wild card, show color selector
        if (card.type === 'wild' || card.type === 'wild-draw-four') {
            showColorSelector();
        } else {
            // Apply special card effect
            applySpecialCardEffect(card);

            // Check if player has won
            if (gameState.playerHand.length === 0) {
                endGame('player');
                return;
            }

            // Next player's turn
            nextTurn();
        }

        // Save player stats
        savePlayerStats();

        // Render updated game state
        renderGame();
    } else {
        showNotification('Invalid move! Card cannot be played.');
    }
}

// Check if a card can be played
function isValidPlay(card) {
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];

    // Wild cards can always be played
    if (card.type === 'wild' || card.type === 'wild-draw-four') {
        return true;
    }

    // Card must match color or number/type
    return (
        card.color === gameState.currentColor ||
        (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) ||
        (card.type !== 'number' && topCard.type === card.type)
    );
}

// Apply effect of special cards
function applySpecialCardEffect(card) {
    if (card.type === 'skip') {
        // Skip next player's turn
        nextTurn();
    } else if (card.type === 'reverse') {
        // Reverse direction
        gameState.direction *= -1;
    } else if (card.type === 'draw-two') {
        // Next player draws two cards
        const nextPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
        if (nextPlayer === 'player') {
            for (let i = 0; i < 2; i++) {
                if (gameState.deck.length === 0) reshuffleDeck();
                gameState.playerHand.push(gameState.deck.pop());
            }
        } else {
            for (let i = 0; i < 2; i++) {
                if (gameState.deck.length === 0) reshuffleDeck();
                gameState.opponentHand.push(gameState.deck.pop());
            }
        }

        // Skip next player's turn
        nextTurn();
    } else if (card.type === 'wild-draw-four') {
        // Next player draws four cards
        const nextPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
        if (nextPlayer === 'player') {
            for (let i = 0; i < 4; i++) {
                if (gameState.deck.length === 0) reshuffleDeck();
                gameState.playerHand.push(gameState.deck.pop());
            }
        } else {
            for (let i = 0; i < 4; i++) {
                if (gameState.deck.length === 0) reshuffleDeck();
                gameState.opponentHand.push(gameState.deck.pop());
            }
        }

        // Skip next player's turn
        nextTurn();
    }
}

// Draw a card from the deck
function drawCard() {
    // Only allow drawing if it's the player's turn
    if (gameState.currentPlayer !== 'player' || gameState.gameOver) {
        return;
    }

    // Check if deck needs to be reshuffled
    if (gameState.deck.length === 0) {
        reshuffleDeck();
    }

    // Draw a card
    const card = gameState.deck.pop();
    gameState.playerHand.push(card);

    // Update analytics
    analytics.drawCount++;

    // Check if the drawn card can be played
    if (isValidPlay(card)) {
        showNotification('Card drawn. You can play it!');
    } else {
        // End turn
        nextTurn();
    }

    // Render updated game state
    renderGame();
}

// Show the color selector for wild cards
function showColorSelector() {
    document.getElementById('color-selector').classList.remove('hidden');
}

// Select a color for wild cards
function selectWildColor(color) {
    // Hide color selector
    document.getElementById('color-selector').classList.add('hidden');

    // Set current color
    gameState.currentColor = color;

    // Update analytics
    analytics.wildColorChoices[color]++;

    // Apply effects of the wild card
    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    applySpecialCardEffect(topCard);

    // Check if player has won
    if (gameState.playerHand.length === 0) {
        endGame('player');
        return;
    }

    // Next player's turn
    nextTurn();
    renderGame();
}

// Move to the next player's turn
function nextTurn() {
    // Switch current player
    gameState.currentPlayer = gameState.currentPlayer === 'player' ? 'opponent' : 'player';
    analytics.turnCount++;
}

// Reshuffle the discard pile into the deck
function reshuffleDeck() {
    const topCard = gameState.discardPile.pop();
    gameState.deck = shuffleArray(gameState.discardPile);
    gameState.discardPile = [topCard];

    showNotification('Deck reshuffled!');
}

// End the game
function endGame(winner) {
    gameState.gameOver = true;
    gameState.winner = winner;
    analytics.gameEnd = new Date();

    // Update player stats
    if (winner === 'player') {
        playerStats.gamesWon++;
        playerStats.currentStreak++;
        if (playerStats.currentStreak > playerStats.bestStreak) {
            playerStats.bestStreak = playerStats.currentStreak;
        }

        // Update difficulty wins
        playerStats.difficultyWins[difficulty]++;
    } else {
        playerStats.currentStreak = 0;
    }

    // Check if player didn't press UNO button
    if (gameState.playerHand.length === 0 && !analytics.unoButtonPressed) {
        playerStats.unosMissed++;
    }

    savePlayerStats();

    // Show game over screen
    document.getElementById('winner-display').textContent =
        winner === 'player' ? 'You Win!' : 'Opponent Wins!';

    // Show game stats
    const gameDuration = (analytics.gameEnd - analytics.gameStart) / 1000;
    const statsContent = document.getElementById('stats-content');
    statsContent.innerHTML = `
<div>Game Duration: ${Math.floor(gameDuration / 60)}m ${Math.floor(gameDuration % 60)}s</div>
<div>Turns Played: ${analytics.turnCount}</div>
<div>Cards Drawn: ${analytics.drawCount}</div>
<div>Special Cards Used: ${analytics.specialCardsUsed}</div>
`;

    showScreen('game-over');
}

// Press the UNO button
function pressUnoButton() {
    analytics.unoButtonPressed = true;
    playerStats.unosCalled++;
    document.getElementById('uno-button').classList.add('hidden');
    showNotification('UNO!');
    savePlayerStats();
}

// Show a notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.remove('hidden');

    // Hide after 3 seconds
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Toggle fullscreen function
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showNotification('Fullscreen not supported');
        });
    } else {
        document.exitFullscreen();
    }
}

// AI GAMEPLAY FUNCTIONS

// Play a turn for the AI
function playAITurn() {
    if (gameState.gameOver) {
        return;
    }

    // Add a short delay to make the AI feel more natural
    setTimeout(() => {
        // Determine the best card to play based on difficulty
        let cardToPlay = null;
        let cardIndex = -1;

        if (difficulty === 'easy') {
            // Easy AI: plays the first valid card it finds
            for (let i = 0; i < gameState.opponentHand.length; i++) {
                if (isValidPlay(gameState.opponentHand[i])) {
                    cardToPlay = gameState.opponentHand[i];
                    cardIndex = i;
                    break;
                }
            }
        } else if (difficulty === 'medium') {
            // Medium AI: prioritizes number cards, saves special cards for later

            // First try to play a number card
            for (let i = 0; i < gameState.opponentHand.length; i++) {
                const card = gameState.opponentHand[i];
                if (isValidPlay(card) && card.type === 'number') {
                    cardToPlay = card;
                    cardIndex = i;
                    break;
                }
            }

            // If no number card can be played, try to play a special card
            if (cardToPlay === null) {
                for (let i = 0; i < gameState.opponentHand.length; i++) {
                    const card = gameState.opponentHand[i];
                    if (isValidPlay(card) && card.type !== 'number') {
                        cardToPlay = card;
                        cardIndex = i;
                        break;
                    }
                }
            }
        } else if (difficulty === 'hard') {
            // Hard AI: strategic play, prioritizes special cards and saves wilds for emergencies

            // Check if player is about to win (has 1-2 cards) and counter with draw cards
            if (gameState.playerHand.length <= 2) {
                for (let i = 0; i < gameState.opponentHand.length; i++) {
                    const card = gameState.opponentHand[i];
                    if (isValidPlay(card) && (card.type === 'draw-two' || card.type === 'wild-draw-four')) {
                        cardToPlay = card;
                        cardIndex = i;
                        break;
                    }
                }
            }

            // If no counter was found or not needed, look for the most strategic card
            if (cardToPlay === null) {
                // First priority: playable cards that are the only one of that color in hand
                const colorCounts = {};
                gameState.opponentHand.forEach(card => {
                    if (card.color !== 'wild') {
                        colorCounts[card.color] = (colorCounts[card.color] || 0) + 1;
                    }
                });

                for (let i = 0; i < gameState.opponentHand.length; i++) {
                    const card = gameState.opponentHand[i];
                    if (isValidPlay(card) && card.color !== 'wild' && colorCounts[card.color] === 1) {
                        cardToPlay = card;
                        cardIndex = i;
                        break;
                    }
                }

                // Second priority: special cards
                if (cardToPlay === null) {
                    for (let i = 0; i < gameState.opponentHand.length; i++) {
                        const card = gameState.opponentHand[i];
                        if (isValidPlay(card) && card.type !== 'number' && card.type !== 'wild' && card.type !== 'wild-draw-four') {
                            cardToPlay = card;
                            cardIndex = i;
                            break;
                        }
                    }
                }

                // Third priority: number cards
                if (cardToPlay === null) {
                    for (let i = 0; i < gameState.opponentHand.length; i++) {
                        const card = gameState.opponentHand[i];
                        if (isValidPlay(card) && card.type === 'number') {
                            cardToPlay = card;
                            cardIndex = i;
                            break;
                        }
                    }
                }

                // Last resort: wild cards
                if (cardToPlay === null) {
                    for (let i = 0; i < gameState.opponentHand.length; i++) {
                        const card = gameState.opponentHand[i];
                        if (card.type === 'wild' || card.type === 'wild-draw-four') {
                            cardToPlay = card;
                            cardIndex = i;
                            break;
                        }
                    }
                }
            }
        }

        // If a card was found, play it
        if (cardToPlay !== null) {
            // Remove card from opponent's hand
            gameState.opponentHand.splice(cardIndex, 1);

            // Add card to discard pile
            gameState.discardPile.push(cardToPlay);

            // Show notification about the card played
            showNotification(`Opponent played ${getCardDescription(cardToPlay)}`);

            // Update current color and number if not a wild card
            if (cardToPlay.color !== 'wild') {
                gameState.currentColor = cardToPlay.color;
                gameState.currentNumber = cardToPlay.value;
            } else {
                // AI chooses a color for the wild card
                const colorCounts = {
                    'purple': 0,
                    'teal': 0,
                    'amber': 0,
                    'coral': 0
                };

                // Count colors in AI's hand
                gameState.opponentHand.forEach(card => {
                    if (card.color !== 'wild') {
                        colorCounts[card.color]++;
                    }
                });

                // Choose most common color
                let bestColor = 'purple';
                let maxCount = 0;
                for (const color in colorCounts) {
                    if (colorCounts[color] > maxCount) {
                        maxCount = colorCounts[color];
                        bestColor = color;
                    }
                }

                // Set the chosen color
                gameState.currentColor = bestColor;
                showNotification(`Opponent chose ${bestColor}`);
            }

            // Apply effects of special cards
            applySpecialCardEffect(cardToPlay);

            // Check if opponent has won
            if (gameState.opponentHand.length === 0) {
                endGame('opponent');
                return;
            }

            // Check if opponent should call UNO
            if (gameState.opponentHand.length === 1) {
                // Call UNO based on difficulty
                if (difficulty === 'easy') {
                    // 50% chance to forget to call UNO
                    if (Math.random() > 0.5) {
                        showNotification("Opponent says: UNO!");
                    }
                } else if (difficulty === 'medium') {
                    // 80% chance to call UNO
                    if (Math.random() > 0.2) {
                        showNotification("Opponent says: UNO!");
                    }
                } else if (difficulty === 'hard') {
                    // Always calls UNO
                    showNotification("Opponent says: UNO!");
                }
            }

            // Next player's turn
            nextTurn();
        } else {
            // No playable card, draw a card
            if (gameState.deck.length === 0) {
                reshuffleDeck();
            }

            const drawnCard = gameState.deck.pop();
            gameState.opponentHand.push(drawnCard);
            showNotification("Opponent drew a card");

            // Check if the drawn card can be played
            if (isValidPlay(drawnCard)) {
                // Play the drawn card (recursive call with a short delay)
                setTimeout(() => playAITurn(), 1000);
                return;
            } else {
                // End turn
                nextTurn();
            }
        }

        // Update game display
        renderGame();
    }, 500); // Short thinking delay
}

// Get a human-readable description of a card
function getCardDescription(card) {
    if (card.type === 'number') {
        return `${card.color} ${card.value}`;
    } else if (card.type === 'skip') {
        return `${card.color} Skip`;
    } else if (card.type === 'reverse') {
        return `${card.color} Reverse`;
    } else if (card.type === 'draw-two') {
        return `${card.color} Draw Two`;
    } else if (card.type === 'wild') {
        return 'Wild';
    } else if (card.type === 'wild-draw-four') {
        return 'Wild Draw Four';
    }
    return 'Unknown Card';
}

// Create a card element based on a card object (updated for Wild and +4 cards)
function createCardElement(card) {
    const cardElement = document.createElement('div');
    cardElement.className = `card ${card.color}`;

    let content = '';
    if (card.type === 'number') {
        content = `<div class="card-value">${card.value}</div>`;
    } else if (card.type === 'skip') {
        content = '<div class="card-symbol">⊘</div>';
    } else if (card.type === 'reverse') {
        content = '<div class="card-symbol">↻</div>';
    } else if (card.type === 'draw-two') {
        content = '<div class="card-symbol">+2</div>';
    } else if (card.type === 'wild' || card.type === 'wild-draw-four') {
        // Create a multi-colored wild card
        cardElement.classList.remove(card.color);
        cardElement.classList.add('wild-card');

        content = `
    <div class="wild-quadrant purple-bg"></div>
    <div class="wild-quadrant teal-bg"></div>
    <div class="wild-quadrant amber-bg"></div>
    <div class="wild-quadrant coral-bg"></div>
    <div class="wild-symbol">${card.type === 'wild' ? 'W' : '+4'}</div>
`;
    }

    cardElement.innerHTML = content;

    // Add tooltip description
    let description = '';
    if (card.type === 'number') {
        description = `${card.color} ${card.value}`;
    } else if (card.type === 'skip') {
        description = `${card.color} Skip`;
    } else if (card.type === 'reverse') {
        description = `${card.color} Reverse`;
    } else if (card.type === 'draw-two') {
        description = `${card.color} Draw Two`;
    } else if (card.type === 'wild') {
        description = 'Wild';
    } else if (card.type === 'wild-draw-four') {
        description = 'Wild Draw Four';
    }

    cardElement.setAttribute('title', description);
    cardElement.setAttribute('aria-label', description);

    return cardElement;
}

// Setup fullscreen button - modified to position in top right
// Setup fullscreen button - modified to position next to menu button
function setupFullscreenButton() {
    // Remove existing buttons first
    const existingButtons = document.querySelectorAll('#fullscreen-btn, #game-fullscreen-btn');
    existingButtons.forEach(btn => btn.remove());

    // Create fullscreen button for welcome screen
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.id = 'fullscreen-btn';
    fullscreenBtn.innerHTML = '⛶';
    fullscreenBtn.className = 'game-control-btn';
    fullscreenBtn.addEventListener('click', toggleFullscreen);

    // Add fullscreen button to top right corner of welcome screen
    const welcomeScreen = document.getElementById('welcome-screen');
    const fullscreenContainer = document.createElement('div');
    fullscreenContainer.id = 'fullscreen-container';
    fullscreenContainer.className = 'fullscreen-container';
    fullscreenContainer.appendChild(fullscreenBtn);
    welcomeScreen.appendChild(fullscreenContainer);

    // Add fullscreen button BEFORE menu button in game screen
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn && menuBtn.parentElement) {
        const gameFullscreenBtn = fullscreenBtn.cloneNode(true);
        gameFullscreenBtn.id = 'game-fullscreen-btn';
        gameFullscreenBtn.addEventListener('click', toggleFullscreen);
        menuBtn.parentElement.insertBefore(gameFullscreenBtn, menuBtn);
    }
}

// Additional CSS to add via JavaScript for the new elements
document.addEventListener('DOMContentLoaded', function () {
    const style = document.createElement('style');
    style.textContent = `
.fullscreen-container {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 100;
}

.game-control-btn {
    background-color: rgba(0,0,0,0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.game-control-btn:hover {
    background-color: rgba(0,0,0,0.4);
}

.wild-card {
    position: relative;
    overflow: hidden;
}

.wild-quadrant {
    position: absolute;
    width: 50%;
    height: 50%;
}

.wild-quadrant:nth-child(1) {
    top: 0;
    left: 0;
}

.wild-quadrant:nth-child(2) {
    top: 0;
    right: 0;
}

.wild-quadrant:nth-child(3) {
    bottom: 0;
    left: 0;
}

.wild-quadrant:nth-child(4) {
    bottom: 0;
    right: 0;
}

.purple-bg {
    background-color: #9c27b0;
}

.teal-bg {
    background-color: #009688;
}

.amber-bg {
    background-color: #ffc107;
}

.coral-bg {
    background-color: #ff5722;
}

.wild-symbol {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-size: 24px;
    font-weight: bold;
    text-shadow: 1px 1px 3px rgba(0,0,0,0.8);
    z-index: 1;
}
`;
    document.head.appendChild(style);
});