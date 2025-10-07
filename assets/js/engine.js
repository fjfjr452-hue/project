export function createEngine() {
  const worker = new Worker('https://unpkg.com/stockfish/stockfish.js');
  function send(cmd) {
    worker.postMessage(cmd);
  }
  function onMessage(fn) {
    worker.onmessage = (e) => fn(String(e.data));
  }
  send('uci');
  return { send, onMessage, worker };
}

export function setSkill(engine, level) {
  engine.send(`setoption name Skill Level value ${level}`);
  engine.send('setoption name Threads value 1');
  engine.send('setoption name Hash value 16');
}

export function bestMove(engine, fen, movetime = 1500) {
  return new Promise((resolve) => {
    let resolved = false;
    engine.onMessage((msg) => {
      const text = msg.trim();
      if (text.startsWith('bestmove') && !resolved) {
        resolved = true;
        const parts = text.split(' ');
        resolve(parts[1]);
      }
    });
    engine.send('ucinewgame');
    engine.send(`position fen ${fen}`);
    engine.send(`go movetime ${movetime}`);
  });
}
