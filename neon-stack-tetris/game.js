(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const COLORS = {
    I: '#42f5d7', J: '#6887ff', L: '#ffad5b', O: '#ffe66d',
    S: '#8bf18b', T: '#c49bff', Z: '#ff6f9e'
  };
  const SHAPES = {
    I: [[1, 1, 1, 1]],
    J: [[1, 0, 0], [1, 1, 1]],
    L: [[0, 0, 1], [1, 1, 1]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0]],
    T: [[0, 1, 0], [1, 1, 1]],
    Z: [[1, 1, 0], [0, 1, 1]]
  };
  const boardCanvas = document.getElementById('game-board');
  const ctx = boardCanvas.getContext('2d');
  const holdCanvas = document.getElementById('hold-canvas');
  const holdCtx = holdCanvas.getContext('2d');
  const nextCanvases = [...document.querySelectorAll('.next-piece canvas')];
  const overlay = document.getElementById('board-overlay');
  const pauseIndicator = document.getElementById('pause-indicator');
  const startButton = document.getElementById('start-btn');
  const startButtonLabel = document.getElementById('start-btn-label');
  const pauseButton = document.getElementById('pause-btn');
  const restartButton = document.getElementById('restart-btn');
  const statusPill = document.getElementById('status-pill');
  const soundButton = document.getElementById('sound-btn');
  const soundIcon = document.getElementById('sound-icon');

  let board = makeBoard();
  let bag = [];
  let queue = [];
  let current = null;
  let heldType = null;
  let canHold = true;
  let score = 0;
  let lines = 0;
  let level = 1;
  let lastClear = '—';
  let gameState = 'ready'; // ready | playing | paused | over
  let fallTimer = 0;
  let lastFrame = 0;
  let soundEnabled = false;
  let audioContext = null;
  let best = loadBest();

  function makeBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function loadBest() {
    try { return Number(localStorage.getItem('neonStackBest')) || 0; }
    catch (_) { return 0; }
  }

  function saveBest() {
    try { localStorage.setItem('neonStackBest', String(best)); }
    catch (_) { /* Storage may be unavailable in private browsing. */ }
  }

  function shuffledBag() {
    const pieces = Object.keys(SHAPES);
    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }
    return pieces;
  }

  function takeType() {
    if (bag.length === 0) bag = shuffledBag();
    return bag.pop();
  }

  function fillQueue() {
    while (queue.length < 5) queue.push(takeType());
  }

  function newPiece(type) {
    const shape = SHAPES[type].map(row => row.slice());
    return { type, shape, x: Math.floor((COLS - shape[0].length) / 2), y: -1 };
  }

  function spawnPiece() {
    fillQueue();
    current = newPiece(queue.shift());
    fillQueue();
    canHold = true;
    fallTimer = 0;
    if (collides(current, current.x, current.y, current.shape)) {
      endGame();
      return;
    }
    drawPreviews();
    draw();
  }

  function collides(piece, x, y, shape) {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && board[by][bx]) return true;
      }
    }
    return false;
  }

  function rotateMatrix(matrix, direction = 1) {
    if (direction === 1) return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
    return matrix[0].map((_, i) => matrix.map(row => row[row.length - 1 - i]));
  }

  function rotate(direction = 1) {
    if (gameState !== 'playing' || !current) return;
    if (current.type === 'O') { playTone(460, 0.025); return; }
    const rotated = rotateMatrix(current.shape, direction);
    const kicks = [0, -1, 1, -2, 2];
    for (const offset of kicks) {
      if (!collides(current, current.x + offset, current.y, rotated)) {
        current.shape = rotated;
        current.x += offset;
        playTone(520, 0.035);
        draw();
        return;
      }
    }
  }

  function move(dx, dy, soft = false) {
    if (gameState !== 'playing' || !current) return false;
    if (!collides(current, current.x + dx, current.y + dy, current.shape)) {
      current.x += dx;
      current.y += dy;
      if (soft && dy > 0) score += 1;
      draw();
      if (soft) updateStats();
      return true;
    }
    return false;
  }

  function hardDrop() {
    if (gameState !== 'playing' || !current) return;
    let distance = 0;
    while (!collides(current, current.x, current.y + 1, current.shape)) {
      current.y++;
      distance++;
    }
    score += distance * 2;
    playTone(190, 0.07);
    lockPiece();
  }

  function holdPiece() {
    if (gameState !== 'playing' || !current || !canHold) return;
    const outgoing = current.type;
    if (heldType) {
      current = newPiece(heldType);
      heldType = outgoing;
      if (collides(current, current.x, current.y, current.shape)) { endGame(); return; }
    } else {
      heldType = outgoing;
      spawnPiece();
    }
    canHold = false;
    drawPreviews();
    draw();
    playTone(390, 0.045);
  }

  function lockPiece() {
    if (!current) return;
    let toppedOut = false;
    for (let r = 0; r < current.shape.length; r++) {
      for (let c = 0; c < current.shape[r].length; c++) {
        if (!current.shape[r][c]) continue;
        const x = current.x + c;
        const y = current.y + r;
        if (y < 0) toppedOut = true;
        else if (y < ROWS && x >= 0 && x < COLS) board[y][x] = current.type;
      }
    }
    if (toppedOut) { endGame(); return; }
    const cleared = clearLines();
    if (cleared > 0) {
      const points = [0, 100, 300, 500, 800][cleared] || cleared * 200;
      score += points * level;
      lines += cleared;
      lastClear = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'TETRIS!'][cleared] || `${cleared} LINES`;
      playTone(cleared === 4 ? 880 : 650, 0.09);
      level = Math.floor(lines / 10) + 1;
    } else {
      lastClear = '—';
    }
    if (score > best) { best = score; saveBest(); }
    updateStats();
    spawnPiece();
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(Boolean)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    return cleared;
  }

  function startGame() {
    board = makeBoard();
    bag = [];
    queue = [];
    current = null;
    heldType = null;
    canHold = true;
    score = 0;
    lines = 0;
    level = 1;
    lastClear = '—';
    fallTimer = 0;
    gameState = 'playing';
    overlay.classList.add('hidden');
    pauseIndicator.hidden = true;
    pauseButton.disabled = false;
    statusPill.textContent = 'PLAYING';
    statusPill.style.color = 'var(--cyan)';
    startButtonLabel.textContent = 'PLAY AGAIN';
    updateStats();
    spawnPiece();
    playTone(600, 0.06);
  }

  function endGame() {
    gameState = 'over';
    current = null;
    pauseIndicator.hidden = true;
    overlay.classList.remove('hidden');
    document.getElementById('overlay-kicker').textContent = 'STACK COMPLETE';
    document.getElementById('overlay-title').innerHTML = 'Game<br />over.';
    document.getElementById('overlay-copy').textContent = `You scored ${formatScore(score)} points. Ready for another round?`;
    startButtonLabel.textContent = 'PLAY AGAIN';
    document.getElementById('overlay-footnote').textContent = 'PRESS ENTER TO TRY AGAIN';
    pauseButton.disabled = true;
    statusPill.textContent = 'GAME OVER';
    statusPill.style.color = '#ff8dab';
    playTone(140, 0.2);
    updateStats();
    draw();
  }

  function togglePause() {
    if (gameState === 'playing') {
      gameState = 'paused';
      pauseIndicator.hidden = false;
      pauseButton.innerHTML = '<span>▶</span> RESUME GAME <kbd>P</kbd>';
      statusPill.textContent = 'PAUSED';
      statusPill.style.color = '#c7b8ff';
    } else if (gameState === 'paused') {
      gameState = 'playing';
      pauseIndicator.hidden = true;
      pauseButton.innerHTML = '<span>Ⅱ</span> PAUSE GAME <kbd>P</kbd>';
      statusPill.textContent = 'PLAYING';
      statusPill.style.color = 'var(--cyan)';
      lastFrame = performance.now();
    }
  }

  function gravityInterval() {
    return Math.max(90, 850 * Math.pow(0.82, level - 1));
  }

  function frame(time = 0) {
    const delta = Math.min(time - lastFrame, 100);
    lastFrame = time;
    if (gameState === 'playing' && current) {
      fallTimer += delta;
      if (fallTimer >= gravityInterval()) {
        fallTimer = 0;
        if (!move(0, 1)) lockPiece();
      }
    }
    requestAnimationFrame(frame);
  }

  function drawCell(context, x, y, size, type, alpha = 1, ghost = false) {
    const color = COLORS[type] || '#42f5d7';
    context.save();
    context.globalAlpha = alpha;
    const inset = ghost ? 3 : 1.3;
    if (ghost) {
      context.strokeStyle = color;
      context.lineWidth = 1.35;
      context.strokeRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
    } else {
      context.fillStyle = color;
      context.fillRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
      context.fillStyle = 'rgba(255,255,255,.24)';
      context.fillRect(x + inset + 2, y + inset + 2, Math.max(1, size - inset * 2 - 4), 2);
      context.fillStyle = 'rgba(4,8,20,.17)';
      context.fillRect(x + inset + 2, y + size - inset - 4, Math.max(1, size - inset * 2 - 4), 2);
    }
    context.restore();
  }

  function drawPiece(context, piece, cell, offsetX = 0, offsetY = 0, ghost = false) {
    if (!piece) return;
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[r].length; c++) {
        if (!piece.shape[r][c]) continue;
        const x = offsetX + (piece.x + c) * cell;
        const y = offsetY + (piece.y + r) * cell;
        if (y + cell <= 0) continue;
        drawCell(context, x, y, cell, piece.type, ghost ? .55 : 1, ghost);
      }
    }
  }

  function draw() {
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.fillStyle = '#090d1b';
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.strokeStyle = 'rgba(112, 128, 177, .09)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath(); ctx.moveTo(x * CELL + .5, 0); ctx.lineTo(x * CELL + .5, ROWS * CELL); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath(); ctx.moveTo(0, y * CELL + .5); ctx.lineTo(COLS * CELL, y * CELL + .5); ctx.stroke();
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x]) drawCell(ctx, x * CELL, y * CELL, CELL, board[y][x]);
      }
    }
    if (current && gameState !== 'ready' && gameState !== 'over') {
      let ghostY = current.y;
      while (!collides(current, current.x, ghostY + 1, current.shape)) ghostY++;
      drawPiece(ctx, { ...current, y: ghostY }, CELL, 0, 0, true);
      drawPiece(ctx, current, CELL);
    }
  }

  function drawMini(context, canvas, type, cellSize = 18) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(5,8,18,.05)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!type) return;
    const shape = SHAPES[type];
    const cell = Math.min(cellSize, Math.floor((canvas.width - 10) / shape[0].length), Math.floor((canvas.height - 8) / shape.length));
    const width = shape[0].length * cell;
    const height = shape.length * cell;
    const left = Math.floor((canvas.width - width) / 2);
    const top = Math.floor((canvas.height - height) / 2);
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) drawCell(context, left + c * cell, top + r * cell, cell, type);
      }
    }
  }

  function drawPreviews() {
    document.getElementById('hold-empty').style.display = heldType ? 'none' : 'block';
    drawMini(holdCtx, holdCanvas, heldType, 20);
    nextCanvases.forEach((canvas, index) => {
      drawMini(canvas.getContext('2d'), canvas, queue[index], 16);
    });
  }

  function formatScore(value) { return String(value).padStart(6, '0'); }

  function updateStats() {
    document.getElementById('score-value').textContent = formatScore(score);
    document.getElementById('lines-value').textContent = String(lines).padStart(2, '0');
    document.getElementById('level-value').textContent = String(level).padStart(2, '0');
    document.getElementById('best-value').textContent = formatScore(best);
    document.getElementById('last-clear').textContent = lastClear;
    document.getElementById('speed-label').textContent = `SPEED ${String(level).padStart(2, '0')}`;
  }

  function playTone(frequency, duration) {
    if (!soundEnabled) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.035, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    } catch (_) { /* Audio is optional; gameplay remains available without it. */ }
  }

  function activateAction(action) {
    if (action === 'left') move(-1, 0);
    else if (action === 'right') move(1, 0);
    else if (action === 'down') move(0, 1, true);
    else if (action === 'rotate') rotate(1);
    else if (action === 'drop') hardDrop();
    else if (action === 'hold') holdPiece();
  }

  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    const handled = ['arrowleft', 'arrowright', 'arrowdown', 'arrowup', ' ', 'x', 'z', 'c', 'p', 'escape', 'r', 'enter'];
    if (handled.includes(key)) event.preventDefault();
    if (key === 'enter' && gameState !== 'playing' && gameState !== 'paused') { startGame(); return; }
    if (key === 'r') { startGame(); return; }
    if (key === 'p' || key === 'escape') { togglePause(); return; }
    if (gameState !== 'playing') return;
    if (key === 'arrowleft' || key === 'a') activateAction('left');
    else if (key === 'arrowright' || key === 'd') activateAction('right');
    else if (key === 'arrowdown' || key === 's') activateAction('down');
    else if (key === 'arrowup' || key === 'x') activateAction('rotate');
    else if (key === 'z') rotate(-1);
    else if (key === ' ') activateAction('drop');
    else if (key === 'c' || key === 'shift') holdPiece();
  });

  startButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', togglePause);
  restartButton.addEventListener('click', startGame);
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute('aria-label', soundEnabled ? 'Mute sound effects' : 'Enable sound effects');
    soundIcon.innerHTML = soundEnabled
      ? '<path d="M11 5 6 9H3v6h3l5 4V5Z"></path><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"></path>'
      : '<path d="M11 5 6 9H3v6h3l5 4V5Z"></path><path d="m16 9 5 6m0-6-5 6"></path>';
    if (soundEnabled) playTone(650, 0.07);
  });
  document.querySelectorAll('[data-action]').forEach(button => {
    button.addEventListener('click', () => activateAction(button.dataset.action));
  });

  // Pause the game when the player changes tabs, so it never drops pieces unexpectedly.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && gameState === 'playing') togglePause();
  });

  updateStats();
  drawPreviews();
  draw();
  requestAnimationFrame(frame);
})();
