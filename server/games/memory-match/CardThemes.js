// Card theme sets for Memory Match
// Highly distinct, colorful, and instantly recognizable symbols across diverse categories

const EMOJI_THEMES = {
  gaming_and_tech: [
    '🎮', '🕹️', '👾', '🎲', '♟️', '🎯', '🚀', '🛸', '🤖', '💻',
    '📱', '🔮', '⚡', '🔥', '💎', '👑', '🏆', '🥇', '⚔️', '🛡️',
    '🪄', '💣', '🎧', '📸', '🔬', '🔭', '🛰️', '🪐', '⚙️', '🗝️',
    '🔋', '💡', '📡', '🧩', '🃏', '🎴', '🎳', '🏎️', '🏍️', '🥽',
    '🔊', '🔦', '📻', '⏳', '🎛️', '🎙️', '🕹️', '🛡️', '🛸', '🛰️'
  ],
  animals_and_creatures: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦋', '🐢',
    '🐙', '🦑', '🐬', '🐠', '🦈', '🐊', '🐘', '🦒', '🦓', '🦘',
    '🦔', '🐿️', '🦩', '🦚', '🦉', '🦄', '🐲', '🦕', '🦖', '🐝',
    '🐞', '🦀', '🦞', '🦐', '🦭', '🐋', '🦦', '🦥', '🦨', '🦡'
  ],
  food_and_drinks: [
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒',
    '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🌽', '🥕', '🧁', '🍩',
    '🍪', '🎂', '🍕', '🌮', '🍔', '🌭', '🍟', '🥐', '🧀', '🥑',
    '🍫', '🍿', '🍦', '🍧', '🍣', '🥟', '🍜', '🍱', '🥞', '🧇',
    '🥨', '🥯', '🍞', '🥩', '🍗', '🥪', '🌯', '🧆', '🍲', '🥘'
  ],
  nature_and_weather: [
    '🌸', '🌺', '🌻', '🌹', '🌷', '🌵', '🍀', '🍁', '🍂', '🌿',
    '🪴', '🌴', '🌊', '⛰️', '🏔️', '🌋', '🗻', '🏝️', '🌅', '🌄',
    '🌠', '🌌', '☁️', '🌤️', '🌪️', '🌈', '☀️', '🌙', '⭐', '❄️',
    '💧', '🍄', '🪵', '🎋', '🪸', '💐', '🪷', '🪻', '🫧', '🌍',
    '🌖', '🪐', '☄️', '🔥', '⚡', '🌦️', '🌧️', '⛈️', '🌨️', '🌾'
  ],
  travel_and_objects: [
    '🚗', '🚕', '🚓', '🚑', '🚒', '🚚', '🚜', '🛵', '🚲', '🛴',
    '✈️', '⛵', '🚢', '⚓', '⛺', '🏰', '🎡', '🎢', '🎪', '🎨',
    '🎸', '🎹', '🎺', '🎻', '🥁', '🎤', '🎬', '🎭', '🎁', '🎈',
    '🎉', '🪅', '🎀', '💌', '🧭', '⏰', '⌛', '🔔', '🏮', '💎',
    '🚁', '🚆', '🛶', '🏎️', '🏍️', '🪂', '🏟️', '🗽', '🗼', '⛩️'
  ],
  sports_and_activities: [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🎱', '🏓',
    '🏸', '🏒', '🥊', '🥋', '⛳', '⛸️', '🎣', '🤿', '🎿', '🏂',
    '🏋️', '🚴', '🏊', '🧗', '🏄', '🛹', '🏹', '🏆', '🥇', '🥈',
    '🥉', '🏅', '🎖️', '🎫', '🎟️', '🎪', '🏇', '🚣', '🤺', '🤽'
  ]
};

/**
 * Get a random set of unique symbols for generating card pairs
 * @param {number} pairCount - Number of unique pairs needed
 * @returns {string[]} Array of unique symbols
 */
function getCardSymbols(pairCount) {
  // Combine all themes and shuffle
  const allSymbols = Object.values(EMOJI_THEMES).flat();
  const uniquePool = Array.from(new Set(allSymbols));

  // Shuffle using Fisher-Yates
  for (let i = uniquePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniquePool[i], uniquePool[j]] = [uniquePool[j], uniquePool[i]];
  }

  if (pairCount > uniquePool.length) {
    // If more pairs requested than pool, cycle through
    const result = [];
    while (result.length < pairCount) {
      result.push(...uniquePool.slice(0, pairCount - result.length));
    }
    return result;
  }

  return uniquePool.slice(0, pairCount);
}

/**
 * Calculate the best board dimensions (rows and columns) for a given number of cards
 * Designed to fit standard aspect ratios (16:9, 4:3, 1:1) perfectly.
 * @param {number} totalCards
 * @returns {{ rows: number, cols: number }}
 */
function calculateBoardDimensions(totalCards) {
  const PRESETS = {
    4:   { rows: 2, cols: 2 },  // 2 pairs
    6:   { rows: 2, cols: 3 },  // 3 pairs
    8:   { rows: 2, cols: 4 },  // 4 pairs
    10:  { rows: 2, cols: 5 },  // 5 pairs
    12:  { rows: 3, cols: 4 },  // 6 pairs
    14:  { rows: 2, cols: 7 },  // 7 pairs
    16:  { rows: 4, cols: 4 },  // 8 pairs
    18:  { rows: 3, cols: 6 },  // 9 pairs
    20:  { rows: 4, cols: 5 },  // 10 pairs
    24:  { rows: 4, cols: 6 },  // 12 pairs
    28:  { rows: 4, cols: 7 },  // 14 pairs
    30:  { rows: 5, cols: 6 },  // 15 pairs
    32:  { rows: 4, cols: 8 },  // 16 pairs
    36:  { rows: 6, cols: 6 },  // 18 pairs
    40:  { rows: 5, cols: 8 },  // 20 pairs
    42:  { rows: 6, cols: 7 },  // 21 pairs
    48:  { rows: 6, cols: 8 },  // 24 pairs
    50:  { rows: 5, cols: 10 }, // 25 pairs
    54:  { rows: 6, cols: 9 },  // 27 pairs
    56:  { rows: 7, cols: 8 },  // 28 pairs
    60:  { rows: 6, cols: 10 }, // 30 pairs
    64:  { rows: 8, cols: 8 },  // 32 pairs
    70:  { rows: 7, cols: 10 }, // 35 pairs
    72:  { rows: 8, cols: 9 },  // 36 pairs
    80:  { rows: 8, cols: 10 }, // 40 pairs
    90:  { rows: 9, cols: 10 }, // 45 pairs
    96:  { rows: 8, cols: 12 }, // 48 pairs
    100: { rows: 10, cols: 10 }, // 50 pairs
    120: { rows: 10, cols: 12 }, // 60 pairs
    144: { rows: 12, cols: 12 }, // 72 pairs
  };

  if (PRESETS[totalCards]) {
    return PRESETS[totalCards];
  }

  // Fallback: Find the closest rectangle dimensions
  let bestRows = 1;
  let bestCols = totalCards;
  let bestDiff = totalCards - 1;

  for (let rows = 2; rows <= Math.ceil(Math.sqrt(totalCards)); rows++) {
    if (totalCards % rows === 0) {
      const cols = totalCards / rows;
      const diff = Math.abs(cols - rows);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRows = rows;
        bestCols = cols;
      }
    }
  }

  return { rows: bestRows, cols: bestCols };
}

/**
 * Get the default number of pairs based on player count
 * @param {number} playerCount
 * @returns {number}
 */
function getPairCount(playerCount) {
  if (playerCount <= 2) return 12; // 4x6 = 24 cards
  if (playerCount <= 4) return 18; // 6x6 = 36 cards
  if (playerCount <= 6) return 24; // 6x8 = 48 cards
  return 32;                       // 8x8 = 64 cards
}

module.exports = { getCardSymbols, calculateBoardDimensions, getPairCount, EMOJI_THEMES };
