import puzzles from './puzzles.js';
import { createEngine, setSkill, bestMove } from './engine.js';

const pieceTheme = 'https://unpkg.com/chessboardjs@1.0.0/www/img/chesspieces/wikipedia/{piece}.png';
const metrics = {
  games: '482K',
  puzzles: '8.7M',
  lessons: '112K',
  members: '126K'
};

const defaultProfile = {
  rating: 1200,
  puzzleRating: 1200,
  puzzleStreak: 0,
  preferredColor: 'white',
  skillLevel: 8,
  timed: false,
  lastPuzzleIndex: 0
};

let profile = loadProfile();

let chess;
let board;
let heroBoard;
let lessonBoards = [];
let gameEngine;
let puzzleEngine;
let engineReady = false;
let engineThinking = false;
let playerColor = 'w';
let gameActive = false;
let timers = { w: 180000, b: 180000 };
let activeTimer = null;
let timerInterval = null;
let audioCtx;
let lastMoveSquares = [];

let puzzleBoard;
let puzzleGame;
let puzzleActive = false;
let currentPuzzleIndex = profile.lastPuzzleIndex || 0;
let currentPuzzle = null;
let puzzleSolutionIndex = 0;
let puzzleStartTurn = 'w';
let puzzleArrowCleanup = () => {};
let puzzleHintActive = false;

const files = 'abcdefgh';
const ranks = '12345678';

const navToggle = document.getElementById('nav-toggle');
const mobileNav = document.getElementById('mobile-nav');
const playerRatingEl = document.getElementById('player-rating');
const metricGames = document.getElementById('metric-games');
const metricPuzzles = document.getElementById('metric-puzzles');
const metricLessons = document.getElementById('metric-lessons');
const metricMembers = document.getElementById('metric-members');
const footerYear = document.getElementById('footer-year');
const colorSelect = document.getElementById('color-select');
const skillRange = document.getElementById('skill-range');
const skillLabel = document.getElementById('skill-label');
const timedToggle = document.getElementById('timed-toggle');
const newGameBtn = document.getElementById('new-game');
const undoBtn = document.getElementById('undo-move');
const resignBtn = document.getElementById('resign-game');
const drawBtn = document.getElementById('offer-draw');
const copyFenBtn = document.getElementById('copy-fen');
const copyPgnBtn = document.getElementById('copy-pgn');
const pgnText = document.getElementById('pgn-text');
const gameStatus = document.getElementById('game-status');
const engineStatus = document.getElementById('engine-status');
const gameResult = document.getElementById('game-result');
const statusLive = document.getElementById('status-live');
const clockWhite = document.getElementById('clock-white');
const clockBlack = document.getElementById('clock-black');
const playBoardEl = document.getElementById('play-board');

const startPuzzleBtn = document.getElementById('start-puzzle');
const hintPuzzleBtn = document.getElementById('hint-puzzle');
const solutionPuzzleBtn = document.getElementById('solution-puzzle');
const nextPuzzleBtn = document.getElementById('next-puzzle');
const puzzleStatus = document.getElementById('puzzle-status');
const puzzleRatingEl = document.getElementById('puzzle-rating');
const puzzleStreakEl = document.getElementById('puzzle-streak');
const puzzleBoardEl = document.getElementById('puzzle-board');

init();

async function init() {
  setupNavigation();
  populateMetrics();
  setupFooter();
  setupHeroBoard();
  setupLessonBoards();
  setupPlayBoard();
  setupPuzzleBoard();
  updateClockDisplay();
  updateProfileControls();
  updatePlayerRatingUI();
  updatePuzzleUI();
  bindGameControls();
  bindPuzzleControls();
  await initializeEngines();
  engineStatus.textContent = `Engine ready • Skill ${profile.skillLevel}`;
  gameStatus.textContent = 'Press “New Game” to begin.';
}

function setupNavigation() {
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const expanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!expanded));
      mobileNav.classList.toggle('hidden');
    });
  }
}

function populateMetrics() {
  if (metricGames) metricGames.textContent = metrics.games;
  if (metricPuzzles) metricPuzzles.textContent = metrics.puzzles;
  if (metricLessons) metricLessons.textContent = metrics.lessons;
  if (metricMembers) metricMembers.textContent = metrics.members;
}

function setupFooter() {
  if (footerYear) footerYear.textContent = String(new Date().getFullYear());
}

function setupHeroBoard() {
  if (!window.Chessboard) return;
  heroBoard = window.Chessboard('hero-board', {
    pieceTheme,
    draggable: false,
    position: 'rnbqkbnr/pppp1ppp/4p3/8/1bP5/5NP1/PP1PPPBP/RNBQK2R w KQkq - 2 5'
  });
}

function setupLessonBoards() {
  const lessonEls = document.querySelectorAll('.lesson-board');
  lessonBoards = [];
  lessonEls.forEach((el) => {
    const fen = el.getAttribute('data-fen') || 'start';
    const arrowsAttr = el.getAttribute('data-arrows') || '';
    const orientation = el.getAttribute('data-orientation') || 'white';
    const arrowMoves = arrowsAttr.split(',').filter(Boolean);
    const miniGame = new window.Chess(fen);
    const boardInstance = window.Chessboard(el, {
      pieceTheme,
      draggable: true,
      position: fen,
      orientation,
      onDrop: (source, target) => {
        const move = miniGame.move({ from: source, to: target, promotion: 'q' });
        if (!move) {
          return 'snapback';
        }
        playSound(move.captured ? 'capture' : 'move');
      }
    });
    const cleanup = drawArrows(el, arrowMoves.map((move) => ({
      from: move.slice(0, 2),
      to: move.slice(2, 4)
    })), orientation);
    lessonBoards.push({ board: boardInstance, game: miniGame, arrows: arrowMoves, cleanup, orientation, element: el });
  });
  window.addEventListener('resize', () => {
    if (board) board.resize();
    if (puzzleBoard) puzzleBoard.resize();
    if (heroBoard) heroBoard.resize();
    lessonBoards.forEach(({ board: b, arrows, orientation, element, cleanup }) => {
      if (b) b.resize();
      if (cleanup) cleanup();
      const arrowMoves = arrows.map((move) => ({ from: move.slice(0, 2), to: move.slice(2, 4) }));
      drawArrows(element, arrowMoves, orientation);
    });
    if (currentPuzzle && puzzleHintActive) {
      renderPuzzleHintArrow();
    }
    updateClockDisplay();
  });
}

function setupPlayBoard() {
  if (!playBoardEl) return;
  chess = new window.Chess();
  board = window.Chessboard(playBoardEl, {
    pieceTheme,
    position: 'start',
    orientation: profile.preferredColor,
    draggable: true,
    onDragStart: handleDragStart,
    onDrop: handleDrop,
    onSnapEnd: () => board.position(chess.fen()),
    onMouseoverSquare: handleMouseover,
    onMouseoutSquare: clearHighlights
  });
  playerColor = profile.preferredColor === 'white' ? 'w' : 'b';
}

function setupPuzzleBoard() {
  if (!puzzleBoardEl) return;
  puzzleGame = new window.Chess();
  puzzleBoard = window.Chessboard(puzzleBoardEl, {
    pieceTheme,
    position: 'start',
    orientation: 'white',
    draggable: true,
    onDragStart: (source, piece) => {
      if (!puzzleActive) return false;
      const turn = puzzleGame.turn();
      if ((turn === 'w' && piece.startsWith('b')) || (turn === 'b' && piece.startsWith('w'))) {
        return false;
      }
      return true;
    },
    onDrop: puzzleDrop,
    onSnapEnd: () => puzzleBoard.position(puzzleGame.fen())
  });
}

function bindGameControls() {
  newGameBtn?.addEventListener('click', () => {
    startNewGame();
  });
  undoBtn?.addEventListener('click', undoMove);
  resignBtn?.addEventListener('click', () => finishGame('loss', 'You resigned.'));
  drawBtn?.addEventListener('click', () => finishGame('draw', 'Draw agreed.'));
  copyFenBtn?.addEventListener('click', copyFenToClipboard);
  copyPgnBtn?.addEventListener('click', copyPgnToClipboard);

  colorSelect?.addEventListener('change', () => {
    profile.preferredColor = colorSelect.value;
    saveProfile();
  });

  skillRange?.addEventListener('input', () => {
    const level = Number(skillRange.value);
    updateSkillLabel(level);
  });

  skillRange?.addEventListener('change', () => {
    const level = Number(skillRange.value);
    profile.skillLevel = level;
    saveProfile();
    if (gameEngine) {
      setSkill(gameEngine, level);
    }
    if (puzzleEngine) {
      setSkill(puzzleEngine, Math.min(12, level + 2));
    }
    engineStatus.textContent = `Engine ready • Skill ${level}`;
  });

  timedToggle?.addEventListener('change', () => {
    profile.timed = timedToggle.checked;
    saveProfile();
    updateClockDisplay();
  });
}

function bindPuzzleControls() {
  startPuzzleBtn?.addEventListener('click', () => {
    puzzleActive = false;
    loadPuzzle(currentPuzzleIndex);
  });
  hintPuzzleBtn?.addEventListener('click', showPuzzleHint);
  solutionPuzzleBtn?.addEventListener('click', showPuzzleSolution);
  nextPuzzleBtn?.addEventListener('click', () => {
    advancePuzzle();
  });
}

async function initializeEngines() {
  engineStatus.textContent = 'Connecting to Stockfish…';
  gameEngine = await initializeEngineInstance(profile.skillLevel);
  puzzleEngine = await initializeEngineInstance(Math.min(12, profile.skillLevel + 2));
  engineReady = true;
}

function initializeEngineInstance(level) {
  return new Promise((resolve) => {
    const engine = createEngine();
    engine.onMessage((msg) => {
      const text = msg.trim();
      if (text === 'uciok') {
        engine.send('isready');
      } else if (text === 'readyok') {
        setSkill(engine, level);
        resolve(engine);
      }
    });
  });
}

function handleDragStart(source, piece) {
  if (!gameActive || engineThinking) return false;
  if ((chess.turn() === 'w' && piece.startsWith('b')) || (chess.turn() === 'b' && piece.startsWith('w'))) {
    return false;
  }
  if ((chess.turn() === 'w' && playerColor !== 'w') || (chess.turn() === 'b' && playerColor !== 'b')) {
    return false;
  }
  return true;
}

function handleDrop(source, target) {
  removeSquareClasses(['square-source', 'square-target']);
  const move = chess.move({ from: source, to: target, promotion: 'q' });
  if (!move) {
    return 'snapback';
  }
  playSound(move.captured ? 'capture' : 'move');
  lastMoveSquares = [source, target];
  board.position(chess.fen());
  highlightLastMove();
  postMoveUpdate(move, true);
  if (profile.timed) {
    applyIncrement(playerColor);
  }
  if (!chess.game_over()) {
    startClock(opponent(playerColor));
    window.setTimeout(() => {
      handleEngineTurn();
    }, 50);
  } else {
    finishGame(determineResult(), determineResultMessage());
  }
}

function onEngineMove(move) {
  if (!move) return;
  const parsed = chess.move(move, { sloppy: true });
  if (!parsed) return;
  playSound(parsed.captured ? 'capture' : 'move');
  lastMoveSquares = [parsed.from, parsed.to];
  board.position(chess.fen());
  highlightLastMove();
  postMoveUpdate(parsed, false);
  if (profile.timed) {
    applyIncrement(opponent(playerColor));
    startClock(playerColor);
  }
  if (chess.game_over()) {
    finishGame(determineResult(), determineResultMessage());
  }
}

function postMoveUpdate(move, playerMove) {
  updateGameStatus(move, playerMove);
  updatePgn();
  updatePlayerRatingUI();
}

function updateGameStatus(move, playerMove) {
  const check = chess.in_check();
  let status = `${playerMove ? 'You' : 'Engine'} played ${move.san}. `;
  if (chess.in_checkmate()) {
    status += 'Checkmate!';
    announce('Checkmate.');
  } else if (chess.in_draw()) {
    status += 'Drawn position.';
  } else if (check) {
    status += 'Check!';
    announce('Check.');
  } else {
    const turnText = chess.turn() === playerColor ? 'Your move.' : 'Engine thinking…';
    status += turnText;
  }
  gameStatus.textContent = status;
}

async function handleEngineTurn() {
  if (!engineReady || !gameActive || engineThinking) return;
  if (chess.turn() === playerColor) return;
  engineThinking = true;
  engineStatus.textContent = 'Engine calculating…';
  try {
    const movetime = profile.timed ? 900 + profile.skillLevel * 40 : 1500;
    const best = await bestMove(gameEngine, chess.fen(), movetime);
    engineThinking = false;
    engineStatus.textContent = `Engine ready • Skill ${profile.skillLevel}`;
    if (!gameActive) return;
    onEngineMove(best);
  } catch (err) {
    engineThinking = false;
    console.error('Engine error', err);
    engineStatus.textContent = 'Engine error. See console.';
  }
}

function startNewGame() {
  if (!engineReady) return;
  stopClock();
  chess.reset();
  gameActive = true;
  engineThinking = false;
  lastMoveSquares = [];
  clearHighlights();
  clearResult();
  const choice = colorSelect.value;
  let orientation = choice;
  if (choice === 'random') {
    orientation = Math.random() < 0.5 ? 'white' : 'black';
  }
  board.orientation(orientation);
  board.start();
  playerColor = orientation === 'white' ? 'w' : 'b';
  chess.reset();
  updatePgn();
  updateGameStatus({ san: 'Game start' }, true);
  if (timedToggle.checked) {
    timers = { w: 180000, b: 180000 };
    updateClockDisplay();
    startClock(chess.turn());
  } else {
    stopClock();
    updateClockDisplay();
  }
  if (playerColor === 'b') {
    handleEngineTurn();
  }
}

function undoMove() {
  if (!gameActive) return;
  if (engineThinking) return;
  const history = chess.history();
  if (!history.length) return;
  chess.undo();
  if (chess.turn() !== playerColor && chess.history().length) {
    chess.undo();
  }
  board.position(chess.fen());
  lastMoveSquares = [];
  clearHighlights();
  updatePgn();
  gameStatus.textContent = 'Move undone.';
}

function finishGame(result, message) {
  if (!gameActive) return;
  gameActive = false;
  stopClock();
  if (result === 'win') {
    profile.rating += 15;
  } else if (result === 'loss') {
    profile.rating = Math.max(100, profile.rating - 12);
  } else {
    profile.rating += 3;
  }
  saveProfile();
  updatePlayerRatingUI();
  gameResult.textContent = message || formatResultMessage(result);
  gameStatus.textContent = 'Game over.';
}

function formatResultMessage(result) {
  if (result === 'win') return 'You won! 🎉';
  if (result === 'loss') return 'The engine wins this round.';
  return 'Drawn result.';
}

function determineResult() {
  if (chess.in_checkmate()) {
    return chess.turn() === playerColor ? 'loss' : 'win';
  }
  return 'draw';
}

function determineResultMessage() {
  if (chess.in_checkmate()) {
    return chess.turn() === playerColor ? 'Checkmate. Engine wins.' : 'Checkmate. You win!';
  }
  if (chess.in_draw()) {
    return 'Drawn by rule.';
  }
  if (chess.in_stalemate()) {
    return 'Stalemate.';
  }
  return 'Game finished.';
}

function clearResult() {
  gameResult.textContent = '';
}

function updatePgn() {
  if (!pgnText) return;
  const pgn = chess.pgn({ maxWidth: 60, newline: '\n' });
  pgnText.value = pgn;
}

function copyFenToClipboard() {
  navigator.clipboard?.writeText(chess.fen()).then(() => {
    engineStatus.textContent = 'FEN copied to clipboard.';
  }).catch(() => {
    engineStatus.textContent = 'Unable to copy FEN.';
  });
}

function copyPgnToClipboard() {
  navigator.clipboard?.writeText(pgnText.value).then(() => {
    engineStatus.textContent = 'PGN copied to clipboard.';
  }).catch(() => {
    engineStatus.textContent = 'Unable to copy PGN.';
  });
}

function handleMouseover(square) {
  if (!gameActive) return;
  const moves = chess.moves({ square, verbose: true });
  if (!moves.length) return;
  highlightSquare(square, 'square-source');
  moves.forEach((move) => highlightSquare(move.to, move.captured ? 'square-target' : 'square-highlight'));
}

function clearHighlights() {
  removeSquareClasses(['square-highlight', 'square-target', 'square-source']);
}

function highlightLastMove() {
  clearHighlights();
  lastMoveSquares.forEach((sq, idx) => {
    highlightSquare(sq, idx === 0 ? 'square-source' : 'square-target');
  });
}

function highlightSquare(square, className) {
  const squareEl = document.querySelector(`#play-board .square-${square}`);
  if (squareEl) squareEl.classList.add(className);
}

function removeSquareClasses(classes) {
  classes.forEach((className) => {
    document.querySelectorAll(`#play-board .${className}`).forEach((el) => el.classList.remove(className));
    document.querySelectorAll(`#puzzle-board .${className}`).forEach((el) => el.classList.remove(className));
  });
}

function opponent(side) {
  return side === 'w' ? 'b' : 'w';
}

function loadProfile() {
  try {
    const raw = localStorage.getItem('grandmaster-hub-profile');
    if (!raw) return { ...defaultProfile };
    const parsed = JSON.parse(raw);
    return { ...defaultProfile, ...parsed };
  } catch (error) {
    console.warn('Failed to load profile', error);
    return { ...defaultProfile };
  }
}

function saveProfile() {
  localStorage.setItem('grandmaster-hub-profile', JSON.stringify(profile));
}

function updateProfileControls() {
  if (colorSelect) colorSelect.value = profile.preferredColor;
  if (skillRange) {
    skillRange.value = profile.skillLevel;
    updateSkillLabel(profile.skillLevel);
  }
  if (timedToggle) timedToggle.checked = profile.timed;
}

function updateSkillLabel(level) {
  const tiers = ['Beginner', 'Novice', 'Club', 'Competitor', 'Expert', 'Master', 'GM'];
  const tier = tiers[Math.min(tiers.length - 1, Math.floor(level / 3))];
  skillLabel.textContent = `${level} • ${tier}`;
}

function updatePlayerRatingUI() {
  if (playerRatingEl) {
    playerRatingEl.textContent = `Rating ${profile.rating}`;
  }
}

function announce(message) {
  statusLive.textContent = message;
}

function startClock(side) {
  stopClock();
  if (!profile.timed) return;
  activeTimer = side;
  timerInterval = window.setInterval(() => {
    timers[activeTimer] -= 100;
    if (timers[activeTimer] <= 0) {
      timers[activeTimer] = 0;
      updateClockDisplay();
      stopClock();
      const loser = activeTimer;
      const result = loser === playerColor ? 'loss' : 'win';
      finishGame(result, loser === playerColor ? 'Flag fall. Engine wins.' : 'Flag fall. You win!');
    } else {
      updateClockDisplay();
    }
  }, 100);
}

function stopClock() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  activeTimer = null;
}

function applyIncrement(side) {
  if (!profile.timed) return;
  timers[side] += 2000;
  updateClockDisplay();
}

function updateClockDisplay() {
  if (!profile.timed) {
    clockWhite.textContent = '∞';
    clockBlack.textContent = '∞';
    return;
  }
  clockWhite.textContent = formatTime(timers.w);
  clockBlack.textContent = formatTime(timers.b);
}

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(1, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function playSound(type) {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = type === 'capture' ? 420 : 340;
    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.21);
  } catch (error) {
    console.warn('Audio not supported', error);
  }
}

function drawArrows(container, arrows, orientation) {
  if (!container) return () => {};
  const existing = container.querySelector('.board-arrow-overlay');
  if (existing) existing.remove();
  if (!arrows.length) return () => {};
  const svgNS = 'http://www.w3.org/2000/svg';
  const overlay = document.createElementNS(svgNS, 'svg');
  overlay.setAttribute('class', 'board-arrow-overlay');
  overlay.setAttribute('width', '100%');
  overlay.setAttribute('height', '100%');
  overlay.setAttribute('viewBox', '0 0 400 400');
  const defs = document.createElementNS(svgNS, 'defs');
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('refX', '4');
  marker.setAttribute('refY', '3');
  marker.setAttribute('orient', 'auto');
  const markerPath = document.createElementNS(svgNS, 'path');
  markerPath.setAttribute('d', 'M0,0 L0,6 L6,3 z');
  markerPath.setAttribute('fill', '#38bdf8');
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  overlay.appendChild(defs);
  const squareSize = 400 / 8;
  arrows.forEach(({ from, to }) => {
    if (!from || !to) return;
    const start = squareCenter(from, squareSize, orientation);
    const end = squareCenter(to, squareSize, orientation);
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', String(start.x));
    line.setAttribute('y1', String(start.y));
    line.setAttribute('x2', String(end.x));
    line.setAttribute('y2', String(end.y));
    line.setAttribute('stroke', '#38bdf8');
    line.setAttribute('stroke-width', '10');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    line.setAttribute('opacity', '0.75');
    overlay.appendChild(line);
  });
  container.appendChild(overlay);
  return () => overlay.remove();
}

function squareCenter(square, size, orientation) {
  const fileIndex = files.indexOf(square[0]);
  const rankIndex = ranks.indexOf(square[1]);
  if (fileIndex < 0 || rankIndex < 0) {
    return { x: 0, y: 0 };
  }
  if (orientation === 'white') {
    return {
      x: fileIndex * size + size / 2,
      y: (7 - rankIndex) * size + size / 2
    };
  }
  return {
    x: (7 - fileIndex) * size + size / 2,
    y: rankIndex * size + size / 2
  };
}

function setupPuzzleSession(puzzle) {
  puzzleGame.load(puzzle.fen);
  puzzleBoard.position(puzzle.fen);
  puzzleStartTurn = puzzleGame.turn();
  puzzleBoard.orientation(puzzleStartTurn === 'w' ? 'white' : 'black');
  puzzleSolutionIndex = 0;
  puzzleActive = true;
  puzzleArrowCleanup();
  puzzleArrowCleanup = () => {};
  puzzleHintActive = false;
  puzzleStatus.textContent = `Puzzle ${puzzle.id} • ${puzzle.theme.join(', ')} • Rating ${puzzle.rating}`;
}

function loadPuzzle(index) {
  if (!puzzles.length) return;
  currentPuzzleIndex = index % puzzles.length;
  profile.lastPuzzleIndex = currentPuzzleIndex;
  saveProfile();
  currentPuzzle = puzzles[currentPuzzleIndex];
  setupPuzzleSession(currentPuzzle);
}

function advancePuzzle() {
  puzzleActive = false;
  puzzleArrowCleanup();
  puzzleHintActive = false;
  currentPuzzleIndex = (currentPuzzleIndex + 1) % puzzles.length;
  loadPuzzle(currentPuzzleIndex);
}

function puzzleDrop(source, target) {
  if (!puzzleActive) return 'snapback';
  const move = puzzleGame.move({ from: source, to: target, promotion: 'q' });
  if (!move) {
    return 'snapback';
  }
  puzzleBoard.position(puzzleGame.fen());
  playSound(move.captured ? 'capture' : 'move');
  puzzleHintActive = false;
  const expectedSan = currentPuzzle.solutionSAN[puzzleSolutionIndex];
  if (move.san !== expectedSan) {
    puzzleGame.undo();
    puzzleBoard.position(puzzleGame.fen());
    puzzleArrowCleanup();
    puzzleHintActive = false;
    puzzleStatus.textContent = `Not quite. Expected ${expectedSan}. Try again or use a hint.`;
    adjustPuzzleRating(false);
    puzzleActive = false;
    window.setTimeout(() => {
      puzzleActive = true;
    }, 600);
    return 'snapback';
  }
  puzzleSolutionIndex += 1;
  puzzleArrowCleanup();
  if (puzzleSolutionIndex >= currentPuzzle.solutionSAN.length) {
    completePuzzle(true, 'Puzzle solved!');
  } else {
    autoPlayPuzzleMoves();
  }
}

function autoPlayPuzzleMoves() {
  while (puzzleSolutionIndex < currentPuzzle.solutionSAN.length && puzzleGame.turn() !== puzzleStartTurn) {
    const san = currentPuzzle.solutionSAN[puzzleSolutionIndex];
    const move = puzzleGame.move(san);
    if (!move) break;
    puzzleSolutionIndex += 1;
  }
  puzzleBoard.position(puzzleGame.fen());
}

async function showPuzzleHint() {
  if (!puzzleActive || !currentPuzzle) return;
  puzzleHintActive = true;
  puzzleStatus.textContent = 'Analyzing hint…';
  let hintMove = null;
  try {
    if (puzzleEngine) {
      hintMove = await bestMove(puzzleEngine, puzzleGame.fen(), 700);
    }
  } catch (error) {
    console.warn('Hint engine error', error);
  }
  renderPuzzleHintArrow(true, hintMove);
  puzzleStatus.textContent = 'Hint shown. Aim for the highlighted arrow.';
}

function renderPuzzleHintArrow(isHint = false, uciMove = null) {
  puzzleArrowCleanup();
  if (!currentPuzzle || puzzleSolutionIndex >= currentPuzzle.solutionSAN.length) {
    puzzleArrowCleanup = () => {};
    return;
  }
  if (!isHint && !puzzleHintActive) {
    puzzleArrowCleanup = () => {};
    return;
  }
  let moveData;
  if (uciMove) {
    moveData = {
      from: uciMove.slice(0, 2),
      to: uciMove.slice(2, 4)
    };
  } else {
    const san = currentPuzzle.solutionSAN[puzzleSolutionIndex];
    const move = puzzleGame.move(san);
    if (!move) return;
    moveData = { from: move.from, to: move.to };
    puzzleGame.undo();
  }
  const orientation = puzzleBoard.orientation();
  const removeOverlay = drawArrows(puzzleBoardEl, [{ from: moveData.from, to: moveData.to }], orientation);
  if (isHint) {
    const sourceSquare = puzzleBoardEl.querySelector(`.square-${moveData.from}`);
    const targetSquare = puzzleBoardEl.querySelector(`.square-${moveData.to}`);
    sourceSquare?.classList.add('square-hint');
    targetSquare?.classList.add('square-hint');
    puzzleArrowCleanup = () => {
      removeOverlay();
      document.querySelectorAll('#puzzle-board .square-hint').forEach((sq) => sq.classList.remove('square-hint'));
    };
  } else {
    puzzleArrowCleanup = removeOverlay;
  }
}

async function showPuzzleSolution() {
  if (!currentPuzzle) return;
  puzzleActive = false;
  puzzleArrowCleanup();
  puzzleHintActive = false;
  puzzleGame.load(currentPuzzle.fen);
  puzzleBoard.position(currentPuzzle.fen());
  for (let i = 0; i < currentPuzzle.solutionSAN.length; i += 1) {
    const move = puzzleGame.move(currentPuzzle.solutionSAN[i]);
    if (!move) break;
    puzzleBoard.position(puzzleGame.fen());
    await delay(500);
  }
  puzzleStatus.textContent = `Solution: ${currentPuzzle.solutionSAN.join(', ')}`;
  adjustPuzzleRating(false, true);
}

function completePuzzle(success, message) {
  puzzleStatus.textContent = message;
  adjustPuzzleRating(success);
  puzzleActive = false;
  puzzleArrowCleanup();
  puzzleHintActive = false;
}

function adjustPuzzleRating(success, solutionShown = false) {
  if (!currentPuzzle) return;
  const base = Math.max(5, Math.round(Math.abs(currentPuzzle.rating - profile.puzzleRating) / 25));
  const delta = Math.max(8, base);
  if (success) {
    profile.puzzleRating += delta;
    profile.puzzleStreak += 1;
  } else {
    const penalty = solutionShown ? delta : Math.floor(delta / 2);
    profile.puzzleRating = Math.max(400, profile.puzzleRating - penalty);
    profile.puzzleStreak = 0;
  }
  saveProfile();
  updatePuzzleUI();
}

function updatePuzzleUI() {
  puzzleRatingEl.textContent = String(Math.round(profile.puzzleRating));
  puzzleStreakEl.textContent = String(profile.puzzleStreak);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
