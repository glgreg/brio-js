import './style.css';
import * as monaco from 'monaco-editor';
import localforage from 'localforage';

// Configurando Monaco Editor Workers para o Vite
import selfWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }
    return new selfWorker();
  }
};

// #region ---> INTERFACES & PRESETS

interface VirtualFile {
  name: string;
  content: string;
}

// Preset: CapyBounce (PONG com o Capibrio)
const capyBounceCode = `import { BrioGame, BrioObject, BrioSprite, BrioKeyboard } from 'brio-js';

// Inicializando o jogo no container do Sandbox
const gameWidth = 460;
const gameHeight = 360;
const appDiv = document.getElementById('game-container');
const game = new BrioGame(gameWidth, gameHeight, appDiv);

// Ativando Teclado e Bounding Box de Debug
game.useKeyboard();
game.debugging.render.grid.enabled = false;
game.debugging.render.fpsOverlay.enabled = true;

// Preload dos Sprites
game.preload(() => {
  const sprCapy = new BrioSprite('spr_capy', '/assets/sprites/bounce_ball.png');
  const sprPaddle = new BrioSprite('spr_paddle', '/assets/sprites/bounce_paddle.png');
  const sprBg = new BrioSprite('spr_bg', '/assets/sprites/bounce_bg.png');
  return [sprCapy, sprPaddle, sprBg];
});

// Load e Posicionamento dos Objetos
game.load((assets) => {
  // Background
  const bg = new BrioObject('obj_bg', 'spr_bg', 1);
  bg.transform.position.x = 0;
  bg.transform.position.y = 0;
  bg.transform.size.x = gameWidth;
  bg.transform.size.y = gameHeight;

  // Player Paddle
  const paddle = new BrioObject('obj_paddle', 'spr_paddle', 10);
  paddle.transform.position.x = 200;
  paddle.transform.position.y = 330;
  paddle.transform.size.x = 80;
  paddle.transform.size.y = 20;
  paddle.addCollisionMask('rectangle', 'solid', 0, 0, 80, 20);

  // Bola (Energy Orb)
  const ball = new BrioObject('obj_ball', 'spr_capy', 5);
  ball.transform.position.x = 210;
  ball.transform.position.y = 80;
  ball.transform.size.x = 32;
  ball.transform.size.y = 32;
  ball.addCollisionMask('square', 'solid', 0, 0, 32, 32);

  // Variáveis customizadas anexadas à bola para física
  ball.velX = 160; // pixels/s
  ball.velY = 160;

  return [bg, paddle, ball];
});

let score = 0;

// Loop de Atualização de Lógica
game.update((updater, dt) => {
  const paddle = updater.getObject('obj_paddle');
  const ball = updater.getObject('obj_ball');
  const keyboard = game.keyboard;

  // Movimento da raquete (Player)
  const paddleSpeed = 250;
  if (keyboard.isDown('ArrowLeft') || keyboard.isDown('a')) {
    paddle.transform.position.x -= paddleSpeed * dt;
  }
  if (keyboard.isDown('ArrowRight') || keyboard.isDown('d')) {
    paddle.transform.position.x += paddleSpeed * dt;
  }

  // Bater nas paredes (Paddle)
  if (paddle.transform.position.x < 0) paddle.transform.position.x = 0;
  if (paddle.transform.position.x > gameWidth - paddle.transform.size.x) {
    paddle.transform.position.x = gameWidth - paddle.transform.size.x;
  }

  // Movimento da bola
  ball.transform.position.x += ball.velX * dt;
  ball.transform.position.y += ball.velY * dt;

  // Colisão da bola nas paredes laterais
  if (ball.transform.position.x <= 0) {
    ball.transform.position.x = 0;
    ball.velX *= -1;
  }
  if (ball.transform.position.x >= gameWidth - ball.transform.size.x) {
    ball.transform.position.x = gameWidth - ball.transform.size.x;
    ball.velX *= -1;
  }

  // Colisão no topo da tela
  if (ball.transform.position.y <= 0) {
    ball.transform.position.y = 0;
    ball.velY *= -1;
  }

  // Detecção de colisão entre bola (Capibrio) e raquete
  if (game.isColliding(ball, paddle)) {
    // Evitar engolimento físico
    ball.transform.position.y = paddle.transform.position.y - ball.transform.size.y;
    ball.velY *= -1.05; // Aceleração a cada rebatida
    ball.velX *= 1.02;
    score += 10;
    console.log('Score: ' + score);
  }

  // Game Over (Saiu por baixo)
  if (ball.transform.position.y > gameHeight) {
    console.log('Game Over! Placar final: ' + score);
    // Reiniciar bola
    ball.transform.position.x = 210;
    ball.transform.position.y = 80;
    ball.velY = 160;
    ball.velX = Math.random() > 0.5 ? 160 : -160;
    score = 0;
  }

  // Renderizar o placar diretamente no Canvas (Acima de tudo)
  const ctx = game.ctx;
  if (ctx) {
    ctx.font = 'bold 16px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#3b82f6';
    ctx.fillText('PLACAR: ' + score, 15, 30);
  }
});
`;

// Preset: BrioInvaders (Space Invaders)
const brioInvadersCode = `import { BrioGame, BrioObject, BrioSprite, BrioAudio } from 'brio-js';

const gameWidth = 460;
const gameHeight = 360;
const container = document.getElementById('game-container');
const game = new BrioGame(gameWidth, gameHeight, container);

game.useKeyboard();
game.debugging.render.grid.enabled = false;
game.debugging.render.fpsOverlay.enabled = true;

// Preload de recursos reais
game.preload(() => {
  const sprPlayer = new BrioSprite('spr_player', '/assets/sprites/invaders_ship.png');
  const sprEnemy = new BrioSprite('spr_enemy', '/assets/sprites/invaders_alien.png');
  const sprLaser = new BrioSprite('spr_laser', '/assets/sprites/invaders_laser.png');
  const sndLaser = new BrioAudio('snd_laser', '/assets/audios/laser.wav');
  return [sprPlayer, sprEnemy, sprLaser, sndLaser];
});

game.load((assets) => {
  // Jogador no centro inferior
  const player = new BrioObject('player', 'spr_player', 10);
  player.transform.position.x = 210;
  player.transform.position.y = 300;
  player.transform.size.x = 40;
  player.transform.size.y = 40;
  player.addCollisionMask('rectangle', 'solid', 0, 0, 40, 40);

  const objects = [player];

  // Inimigos (Grade de Slimes)
  const enemyRows = 2;
  const enemyCols = 6;
  const startX = 40;
  const startY = 40;
  const spacingX = 60;
  const spacingY = 50;

  for (let r = 0; r < enemyRows; r++) {
    for (let c = 0; c < enemyCols; c++) {
      const name = 'enemy_' + r + '_' + c;
      const enemy = new BrioObject(name, 'spr_enemy', 5);
      enemy.transform.position.x = startX + c * spacingX;
      enemy.transform.position.y = startY + r * spacingY;
      enemy.transform.size.x = 32;
      enemy.transform.size.y = 32;
      enemy.addCollisionMask('square', 'solid', 0, 0, 32, 32);
      enemy.isEnemy = true;
      objects.push(enemy);
    }
  }

  // Objeto de controle de projéteis ativos
  game.activeBullets = [];

  return objects;
});

let enemyDirection = 1;
let enemyMoveTimer = 0;
const enemyMoveInterval = 0.8; // segundos entre movimentos discretos
let shootCooldown = 0;

game.update((updater, dt) => {
  const player = updater.getObject('player');
  const keyboard = game.keyboard;

  // Cooldown de disparo
  if (shootCooldown > 0) shootCooldown -= dt;

  // Movimentação do Jogador
  const pSpeed = 220;
  if (keyboard.isDown('ArrowLeft') || keyboard.isDown('a')) {
    player.transform.position.x -= pSpeed * dt;
  }
  if (keyboard.isDown('ArrowRight') || keyboard.isDown('d')) {
    player.transform.position.x += pSpeed * dt;
  }

  // Prevenir saída lateral
  if (player.transform.position.x < 10) player.transform.position.x = 10;
  if (player.transform.position.x > gameWidth - 50) player.transform.position.x = gameWidth - 50;

  // Disparo com a barra de espaço
  if (keyboard.isDown(' ') && shootCooldown <= 0) {
    const bulletId = 'bullet_' + Date.now();
    const bullet = new BrioObject(bulletId, 'spr_laser', 8);
    bullet.transform.position.x = player.transform.position.x + 18;
    bullet.transform.position.y = player.transform.position.y - 12;
    bullet.transform.size.x = 8;
    bullet.transform.size.y = 16;
    bullet.addCollisionMask('rectangle', 'solid', 0, 0, 8, 16);
    
    // Registrar na engine dinamicamente
    game.gameObjects.set(bulletId, bullet);
    game.activeBullets.push(bullet);

    // Tocar Som de Laser
    const audio = updater.getAudio('snd_laser');
    audio.play();

    shootCooldown = 0.45; // Cooldown de quase meio segundo
    console.log('Laser disparado!');
  }

  // Atualização dos Projéteis
  for (let i = game.activeBullets.length - 1; i >= 0; i--) {
    const bullet = game.activeBullets[i];
    bullet.transform.position.y -= 300 * dt; // Sobbe rápido

    // Out of bounds (Remover projétil da engine)
    if (bullet.transform.position.y < -20) {
      game.destroy(bullet);
      game.activeBullets.splice(i, 1);
      continue;
    }

    // Checar colisão com todos os inimigos
    let hit = false;
    const objects = Array.from(game.gameObjects.values());
    for (let obj of objects) {
      if (obj.isEnemy && game.isColliding(bullet, obj)) {
        console.log('Inimigo eliminado!');
        game.destroy(obj);
        game.destroy(bullet);
        game.activeBullets.splice(i, 1);
        hit = true;
        break;
      }
    }
  }

  // Movimentação em grade dos inimigos
  enemyMoveTimer += dt;
  if (enemyMoveTimer >= enemyMoveInterval) {
    enemyMoveTimer = 0;
    let shiftDown = false;
    const enemies = Array.from(game.gameObjects.values()).filter(o => o.isEnemy);

    // Checar se bateu nas bordas laterais
    for (let enemy of enemies) {
      const nextX = enemy.transform.position.x + 10 * enemyDirection;
      if (nextX <= 15 || nextX >= gameWidth - 45) {
        shiftDown = true;
        break;
      }
    }

    if (shiftDown) {
      enemyDirection *= -1;
      for (let enemy of enemies) {
        enemy.transform.position.y += 15;
      }
    } else {
      for (let enemy of enemies) {
        enemy.transform.position.x += 12 * enemyDirection;
      }
    }
  }

  // Vitória
  const enemiesLeft = Array.from(game.gameObjects.values()).filter(o => o.isEnemy).length;
  if (enemiesLeft === 0) {
    const ctx = game.ctx;
    if (ctx) {
      ctx.font = 'bold 24px "Space Grotesk", sans-serif';
      ctx.fillStyle = '#3b82f6';
      ctx.fillText('VITÓRIA!', 180, 180);
    }
    game.pause();
  }
});
`;

// Preset: Barigui Dash (Endless Dodge)
const bariguiDashCode = `import { BrioGame, BrioObject, BrioSprite, BrioAudio } from 'brio-js';

const gameWidth = 460;
const gameHeight = 360;
const container = document.getElementById('game-container');
const game = new BrioGame(gameWidth, gameHeight, container);

game.useKeyboard();
game.debugging.render.grid.enabled = false;
game.debugging.render.fpsOverlay.enabled = true;

// Preload do Capibrio e o fundo / moedas
game.preload(() => {
  const sprCapy = new BrioSprite('spr_capy', '/assets/sprites/dash_player.png');
  const sprCoin = new BrioSprite('spr_coin', '/assets/sprites/dash_coin.png');
  const sprObstacle = new BrioSprite('spr_obs', '/assets/sprites/dash_obstacle.png');
  const sprBg = new BrioSprite('spr_bg', '/assets/sprites/dash_bg.png');
  return [sprCapy, sprCoin, sprObstacle, sprBg];
});

game.load((assets) => {
  // Backgrounds para efeito de parallax infinito
  const bg1 = new BrioObject('obj_bg1', 'spr_bg', 1);
  bg1.transform.position.x = 0;
  bg1.transform.position.y = 0;
  bg1.transform.size.x = gameWidth;
  bg1.transform.size.y = gameHeight;

  const bg2 = new BrioObject('obj_bg2', 'spr_bg', 1);
  bg2.transform.position.x = gameWidth;
  bg2.transform.position.y = 0;
  bg2.transform.size.x = gameWidth;
  bg2.transform.size.y = gameHeight;

  // Mascote Capibrio correndo
  const capy = new BrioObject('obj_capy', 'spr_capy', 10);
  capy.transform.position.x = 60;
  capy.transform.position.y = 260; // Chão
  capy.transform.size.x = 48;
  capy.transform.size.y = 48;
  capy.addCollisionMask('square', 'solid', 0, 0, 48, 48);

  // Física do pulo
  capy.velocityY = 0;
  capy.isGrounded = true;

  // Obstáculo (Pinha gigante caindo/rolando)
  const obstacle = new BrioObject('obj_obs', 'spr_obs', 5);
  obstacle.transform.position.x = 480;
  obstacle.transform.position.y = 270;
  obstacle.transform.size.x = 36;
  obstacle.transform.size.y = 36;
  obstacle.addCollisionMask('square', 'solid', 0, 0, 36, 36);

  return [bg1, bg2, capy, obstacle];
});

let score = 0;
let speedFactor = 1;

game.update((updater, dt) => {
  const capy = updater.getObject('obj_capy');
  const obstacle = updater.getObject('obj_obs');
  const bg1 = updater.getObject('obj_bg1');
  const bg2 = updater.getObject('obj_bg2');
  const keyboard = game.keyboard;

  // Parallax simples do fundo
  const bgSpeed = 60 * speedFactor;
  bg1.transform.position.x -= bgSpeed * dt;
  bg2.transform.position.x -= bgSpeed * dt;

  if (bg1.transform.position.x <= -gameWidth) {
    bg1.transform.position.x = bg2.transform.position.x + gameWidth;
  }
  if (bg2.transform.position.x <= -gameWidth) {
    bg2.transform.position.x = bg1.transform.position.x + gameWidth;
  }

  // Gravidade e Física do Pulo do Capibrio
  const gravity = 800; // pixels/s^2
  if (!capy.isGrounded) {
    capy.velocityY += gravity * dt;
    capy.transform.position.y += capy.velocityY * dt;

    // Checar aterrissagem no chão fixo
    if (capy.transform.position.y >= 260) {
      capy.transform.position.y = 260;
      capy.velocityY = 0;
      capy.isGrounded = true;
    }
  }

  // Pular usando Espaço ou Seta Cima
  if ((keyboard.isDown(' ') || keyboard.isDown('ArrowUp')) && capy.isGrounded) {
    capy.velocityY = -380; // Força vertical inicial
    capy.isGrounded = false;
    console.log('Capibrio Saltou!');
  }

  // Obstáculo corre da direita para a esquerda
  obstacle.transform.position.x -= 240 * speedFactor * dt;

  // Spawn de novo obstáculo ao passar o limite esquerdo
  if (obstacle.transform.position.x < -30) {
    obstacle.transform.position.x = gameWidth + 50 + Math.random() * 100;
    score += 1;
    speedFactor += 0.05; // Aumenta velocidade
    console.log('Pinha ultrapassada! Placar: ' + score);
  }

  // Checagem de colisão fatal
  if (game.isColliding(capy, obstacle)) {
    console.log('Capibrio colidiu! Game Over final: ' + score);
    score = 0;
    speedFactor = 1;
    obstacle.transform.position.x = 480;
  }

  // Placar na tela
  const ctx = game.ctx;
  if (ctx) {
    ctx.font = 'bold 16px "Space Grotesk", sans-serif';
    ctx.fillStyle = '#fde047'; // Amarelo brilhante para contraste perfeito com céu do pôr do sol
    ctx.fillText('PINHA DESVIADA: ' + score, 15, 35);
  }
});
`;

// #endregion ---> INTERFACES & PRESETS

// #region ---> APP STATE & MAIN ROUTING

let activeTab: 'landing' | 'playground' = 'landing';
let activeFile = 'index.js';
let files: VirtualFile[] = [
  { name: 'index.js', content: capyBounceCode }
];
let activePresetName = 'CapyBounce';

// Monaco Editor Instance
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;
// Console logs store
let logs: { type: string; text: string }[] = [];

// IndexedDB Init via localforage
const dbStore = localforage.createInstance({
  name: 'BrioJS-Showcase',
  storeName: 'virtual_workspace'
});

// Setup das tipagens da BrioJS para o Monaco Autocomplete
async function fetchAndSetupTypings() {
  const dtsFiles = [
    'index.d.ts',
    'base/BrioTransform.d.ts',
    'debugging/BrioDebugger.d.ts',
    'game/BrioGame.d.ts',
    'game/BrioSpriteRenderer.d.ts',
    'game/BrioUpdater.d.ts',
    'assets/BrioSprite.d.ts',
    'input/BrioKeyboard.d.ts',
    'math/BrioCollision.d.ts',
    'math/index.d.ts',
    'objects/BrioObject.d.ts',
    'tools/BrioUtils.d.ts'
  ];

  for (const path of dtsFiles) {
    try {
      const response = await fetch(`/brio/${path}`);
      if (response.ok) {
        const content = await response.text();
        const absolutePath = `file:///node_modules/brio-js/${path}`;
        
        const tsLang = (monaco.languages as any).typescript;
        tsLang.javascriptDefaults.addExtraLib(content, absolutePath);
        tsLang.typescriptDefaults.addExtraLib(content, absolutePath);
      }
    } catch (e) {
      console.warn(`Falha ao injetar typings para ${path}:`, e);
    }
  }

  // Configurações padrão do Monaco para sugerir as declarações corretamente
  const tsLang = (monaco.languages as any).typescript;
  tsLang.javascriptDefaults.setCompilerOptions({
    target: tsLang.ScriptTarget.ESNext,
    allowNonTsExtensions: true,
    moduleResolution: tsLang.ModuleResolutionKind.NodeJs,
    checkJs: true
  });
}

// Inicializar e restaurar estado da Workspace virtual do IndexedDB
async function initWorkspace() {
  try {
    const savedFiles = await dbStore.getItem<VirtualFile[]>('workspace_files');
    if (savedFiles && savedFiles.length > 0) {
      files = savedFiles;
    }
    const savedActive = await dbStore.getItem<string>('active_file');
    if (savedActive) {
      activeFile = savedActive;
    }
  } catch (e) {
    console.error('Erro ao ler do IndexedDB, revertendo para presets padrão:', e);
  }
}

// Salvar progresso
async function saveWorkspace() {
  try {
    await dbStore.setItem('workspace_files', files);
    await dbStore.setItem('active_file', activeFile);
    // Piscar luz indicadora no Painel Sandbox
    const indicator = document.querySelector('.sandbox-indicator');
    if (indicator) {
      indicator.classList.remove('pulse-glow');
      void (indicator as HTMLElement).offsetWidth; // Trigger reflow
      indicator.classList.add('pulse-glow');
    }
  } catch (e) {
    console.error('Erro ao salvar workspace no IndexedDB:', e);
  }
}

// #endregion ---> APP STATE & MAIN ROUTING

// #region ---> RENDER LAYOUT / TEMPLATE ENGINE

function initUI() {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    <header>
      <a class="logo-container" href="#">
        <img src="/capibrio.png" class="logo-logo" alt="BrioJS Logo">
        <span class="logo-symbol">BrioJS</span>
      </a>
      <nav class="nav-links">
        <span class="nav-link ${activeTab === 'landing' ? 'active' : ''}" id="nav-landing">Apresentação</span>
        <span class="nav-link ${activeTab === 'playground' ? 'active' : ''}" id="nav-playground">Playground</span>
        <button class="btn-primary" id="header-btn-action">
          ${activeTab === 'landing' ? 'Testar Agora <i class="fa-solid fa-rocket"></i>' : 'Executar Jogo <i class="fa-solid fa-gamepad"></i>'}
        </button>
      </nav>
    </header>
    
    <main id="view-port"></main>
    
    <footer id="footer-section">
      <p>© 2026 BrioJS. Desenvolvido para o Trabalho de Conclusão de Curso (TCC - TADS IFPR).</p>
      <div class="footer-capy-badge">
        <img class="footer-capy-icon" src="/capibrio.png" alt="Capibrio Mini">
        <span>Desenvolvido por Gustavo L. Gregorio como implementação acadêmica prática para o IFPR.</span>
      </div>
    </footer>
  `;

  // Bind Header Listeners
  document.querySelector('.logo-container')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('nav-landing')?.addEventListener('click', () => switchView('landing'));
  document.getElementById('nav-playground')?.addEventListener('click', () => switchView('playground'));
  document.getElementById('header-btn-action')?.addEventListener('click', () => {
    if (activeTab === 'landing') {
      switchView('playground');
    } else {
      runSandbox();
    }
  });

  renderActiveView();
}

function switchView(tab: 'landing' | 'playground') {
  activeTab = tab;
  initUI();
}

function renderActiveView() {
  const viewPort = document.getElementById('view-port');
  const footer = document.getElementById('footer-section');
  if (!viewPort || !footer) return;

  if (activeTab === 'landing') {
    footer.style.display = 'block';
    renderLandingView(viewPort);
  } else {
    footer.style.display = 'none';
    renderPlaygroundView(viewPort);
  }
}

// Renderizar Landing Page
function renderLandingView(container: HTMLElement) {
  container.innerHTML = `
    <section class="container hero-section">
      <div class="hero-content">
        <div class="hero-badge">
          <span><i class="fa-solid fa-graduation-cap"></i> Projeto Acadêmico de Conclusão - TADS IFPR</span>
        </div>
        <h1 class="hero-title">BrioJS: Uma <span class="text-gradient">Eficiente</span><br>Engine Gráfica 2D</h1>
        <p class="hero-description">
          Um motor de renderização 2D modular e didático desenvolvido em TypeScript puro sobre as APIs nativas do navegador. Projetado com zero dependências externas para oferecer alto desempenho estável a 60 FPS com excelente experiência de desenvolvimento.
        </p>
        <div class="hero-actions">
          <button class="btn-primary" id="btn-hero-playground">Abrir Playground <i class="fa-solid fa-screwdriver-wrench"></i></button>
          <a class="btn-secondary" href="#showcase-section">Ver Demonstrações <i class="fa-solid fa-cubes"></i></a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="mascot-hero-card">
          <img class="mascot-img" src="/capibrio.png" alt="Mascote Capibrio">
          <div class="mascot-caption">CAPIBRIO (Mascote Oficial)</div>
        </div>
      </div>
    </section>

    <section class="container" id="features-section">
      <h2 class="section-title">Engenharia e Arquitetura</h2>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon"><i class="fa-solid fa-rocket"></i></div>
          <h3>Arquitetura Vanilla</h3>
          <p>Construída de forma nativa em TypeScript utilizando a HTML5 Canvas 2D e Web Audio API, assegurando um runtime ultraleve e livre de dependências externas.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
          <h3>DX Estruturada</h3>
          <p>Documentação inline robusta (TSDoc) com exportação nativa de tipagens (.d.ts), garantindo suporte completo a autocomplete e IntelliSense estático.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon"><i class="fa-solid fa-ghost"></i></div>
          <h3>Loop Determinístico</h3>
          <p>Gerenciamento de tempo via requestAnimationFrame (delta time independente de taxa de quadros), detecção de colisões AABB e utilitários de depuração.</p>
        </div>
      </div>
    </section>

    <section class="container" id="showcase-section">
      <h2 class="section-title">Demonstrações e Casos de Uso</h2>
      <div class="games-grid">
        <!-- Game 1 -->
        <div class="game-card" id="game-preset-capybounce">
          <div class="game-header">
            <span class="game-preview-icon"><i class="fa-solid fa-table-tennis-paddle-ball"></i></span>
          </div>
          <div class="game-card-content">
            <h3 class="game-title">CapyBounce (PONG)</h3>
            <p class="game-desc">Controle a raquete para rebater a esfera de energia. Demonstra cálculo de vetores de reflexão física, detecção de colisão AABB dinâmica e renderização de placares em tempo real.</p>
            <div class="game-meta">
              <span class="game-tag">Colisão AABB</span>
              <span class="game-play-btn">Executar & Editar <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>
        </div>
        <!-- Game 2 -->
        <div class="game-card" id="game-preset-invaders">
          <div class="game-header">
            <span class="game-preview-icon"><i class="fa-solid fa-rocket"></i></span>
          </div>
          <div class="game-card-content">
            <h3 class="game-title">BrioInvaders</h3>
            <p class="game-desc">Elimine a grade de invasores com feixes de laser. Valida a criação e destruição procedural de instâncias de entidades, controle de colisões múltiplas e reprodução de efeitos de áudio.</p>
            <div class="game-meta">
              <span class="game-tag">Sons + Projéteis</span>
              <span class="game-play-btn">Executar & Editar <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>
        </div>
        <!-- Game 3 -->
        <div class="game-card" id="game-preset-dash">
          <div class="game-header">
            <span class="game-preview-icon"><i class="fa-solid fa-paw"></i></span>
          </div>
          <div class="game-card-content">
            <h3 class="game-title">Barigui Dash</h3>
            <p class="game-desc">Realize saltos verticais para evitar a queda de pinhas gigantes. Demonstra a simulação física de aceleração gravitacional e a renderização de movimento por scroll parallax infinito no background.</p>
            <div class="game-meta">
              <span class="game-tag">Gravidade + Parallax</span>
              <span class="game-play-btn">Executar & Editar <i class="fa-solid fa-arrow-right"></i></span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="container tcc-section">
      <div class="tcc-content">
        <h2 class="tcc-title">O Projeto de Pesquisa (TADS IFPR)</h2>
        <p class="tcc-text">
          O projeto <strong>BrioJS</strong> foi idealizado como um estudo didático-prático sobre o ciclo interno de desenvolvimento de motores gráficos bidimensionais cliente-side. Ele visa demonstrar que é viável criar estruturas de loop e renderização estruturadas e de alta performance na web moderna utilizando unicamente os recursos nativos oferecidos pelas especificações do HTML5 e TypeScript.
        </p>
        <div class="tcc-specs">
          <div class="spec-item">
            <h4>60 FPS</h4>
            <p>Sincronização robusta de renderização baseada no ciclo do navegador.</p>
          </div>
          <div class="spec-item">
            <h4>Vanilla ESM</h4>
            <p>Empacotamento limpo, carregável nativamente de qualquer CDN ou localmente.</p>
          </div>
          <div class="spec-item">
            <h4>Didático</h4>
            <p>Arquitetura modularizada e linear, otimizada para o ensino de engenharia de jogos.</p>
          </div>
        </div>
      </div>
    </section>
  `;

  // Bind Listeners
  document.getElementById('btn-hero-playground')?.addEventListener('click', () => switchView('playground'));
  
  // Game Selectors
  document.getElementById('game-preset-capybounce')?.addEventListener('click', () => selectPresetGame('CapyBounce', capyBounceCode));
  document.getElementById('game-preset-invaders')?.addEventListener('click', () => selectPresetGame('BrioInvaders', brioInvadersCode));
  document.getElementById('game-preset-dash')?.addEventListener('click', () => selectPresetGame('Barigui Dash', bariguiDashCode));
}

// Renderizar Playground IDE
function renderPlaygroundView(container: HTMLElement) {
  container.innerHTML = `
    <div class="playground-view">
      <!-- Sidebar Explorer -->
      <aside class="playground-sidebar">
        <div class="sidebar-title">
          <span>Explorador</span>
          <div class="sidebar-actions">
            <button class="sidebar-action-btn" id="btn-new-file" title="Novo Arquivo"><i class="fa-solid fa-file-circle-plus"></i></button>
            <button class="sidebar-action-btn" id="btn-reset-preset" title="Resetar Código Original"><i class="fa-solid fa-arrows-rotate"></i></button>
          </div>
        </div>
        <div class="file-tree" id="file-tree-container">
          <!-- Dinamicamente gerado -->
        </div>
      </aside>

      <!-- Workspace central (Editor + Tabs) -->
      <section class="editor-workspace">
        <div class="editor-tabs" id="editor-tabs-container">
          <!-- Dinamicamente gerado -->
        </div>
        <div class="monaco-container">
          <div id="monaco-editor"></div>
        </div>
        
        <!-- Terminal de Console -->
        <div class="console-panel">
          <div class="console-header">
            <div class="console-title">Console de Execução</div>
            <button class="console-clear-btn" id="btn-clear-console">Limpar</button>
          </div>
          <div class="console-logs" id="console-logs-container">
            <div class="log-line engine">[BrioConsole] Pronto. Clique em "Executar" para iniciar seu jogo <i class="fa-solid fa-gamepad"></i></div>
          </div>
        </div>
      </section>

      <!-- Painel Sandbox (Lado Direito) -->
      <section class="sandbox-panel">
        <div class="sandbox-header">
          <div class="sandbox-title">
            <div class="sandbox-indicator pulse-glow"></div>
            <span id="sandbox-project-name">${activePresetName}</span>
          </div>
          <div class="sandbox-controls">
            <button class="sandbox-btn btn-run" id="btn-run-sandbox"><i class="fa-solid fa-play"></i> Executar</button>
            <button class="sandbox-btn" id="btn-stop-sandbox"><i class="fa-solid fa-stop"></i> Parar</button>
          </div>
        </div>
        <div class="sandbox-view-container" id="sandbox-view-port">
          <!-- Canvas Iframe Sandbox -->
          <div style="color: var(--color-muted); font-size: 0.9rem; text-align: center; padding: 2rem;" id="sandbox-placeholder">
            <img src="/capibrio.png" style="width: 80px; image-rendering: pixelated; margin-bottom: 1rem; opacity: 0.5;">
            <p>Clique em <strong>▶ Executar</strong> para renderizar a engine Canvas</p>
          </div>
        </div>
      </section>
    </div>
  `;

  // Bind Sidebar Actions
  document.getElementById('btn-new-file')?.addEventListener('click', createNewVirtualFile);
  document.getElementById('btn-reset-preset')?.addEventListener('click', resetCurrentPreset);
  document.getElementById('btn-clear-console')?.addEventListener('click', clearConsoleLogs);
  document.getElementById('btn-run-sandbox')?.addEventListener('click', runSandbox);
  document.getElementById('btn-stop-sandbox')?.addEventListener('click', stopSandbox);

  renderFileTree();
  renderTabs();
  initMonacoEditor();
}

function selectPresetGame(name: string, code: string) {
  activePresetName = name;
  files = [{ name: 'index.js', content: code }];
  activeFile = 'index.js';
  saveWorkspace();
  switchView('playground');
}

// #endregion ---> RENDER LAYOUT / TEMPLATE ENGINE

// #region ---> WORKSPACE & FILE MANAGEMENT

function renderFileTree() {
  const container = document.getElementById('file-tree-container');
  if (!container) return;

  container.innerHTML = '';
  files.forEach(file => {
    const activeClass = file.name === activeFile ? 'active' : '';
    const item = document.createElement('div');
    item.className = `file-item ${activeClass}`;
    item.innerHTML = `
      <span class="file-icon js"><i class="fa-brands fa-js"></i></span>
      <span class="file-name">${file.name}</span>
    `;
    item.addEventListener('click', () => selectFile(file.name));
    container.appendChild(item);
  });
}

function renderTabs() {
  const container = document.getElementById('editor-tabs-container');
  if (!container) return;

  container.innerHTML = '';
  files.forEach(file => {
    const activeClass = file.name === activeFile ? 'active' : '';
    const tab = document.createElement('div');
    tab.className = `tab ${activeClass}`;
    tab.innerHTML = `
      <span>${file.name}</span>
      ${files.length > 1 ? `<span class="tab-close" data-file="${file.name}">×</span>` : ''}
    `;
    tab.querySelector('.tab-close')?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeFile(file.name);
    });
    tab.addEventListener('click', () => selectFile(file.name));
    container.appendChild(tab);
  });
}

function selectFile(name: string) {
  if (editorInstance) {
    // Salvar o arquivo ativo atual antes de alternar
    const currentFile = files.find(f => f.name === activeFile);
    if (currentFile) {
      currentFile.content = editorInstance.getValue();
    }
  }

  activeFile = name;
  renderFileTree();
  renderTabs();

  const file = files.find(f => f.name === name);
  if (editorInstance && file) {
    editorInstance.setValue(file.content);
  }
  saveWorkspace();
}

function createNewVirtualFile() {
  const name = prompt('Digite o nome do arquivo (ex: player.js):');
  if (!name) return;
  if (!name.endsWith('.js')) {
    alert('Os arquivos do playground precisam terminar com a extensão .js');
    return;
  }
  if (files.some(f => f.name === name)) {
    alert('Já existe um arquivo com esse nome.');
    return;
  }

  files.push({ name, content: `// Arquivo ${name}\n` });
  saveWorkspace();
  selectFile(name);
}

function closeFile(name: string) {
  if (files.length <= 1) return;
  const index = files.findIndex(f => f.name === name);
  if (index === -1) return;

  files.splice(index, 1);
  if (activeFile === name) {
    activeFile = files[0].name;
  }
  saveWorkspace();
  renderFileTree();
  renderTabs();
  const file = files.find(f => f.name === activeFile);
  if (editorInstance && file) {
    editorInstance.setValue(file.content);
  }
}

function resetCurrentPreset() {
  if (!confirm('Tem certeza de que deseja resetar o código atual para o original?')) return;
  let code = capyBounceCode;
  if (activePresetName === 'BrioInvaders') code = brioInvadersCode;
  if (activePresetName === 'Barigui Dash') code = bariguiDashCode;

  const file = files.find(f => f.name === activeFile);
  if (file) {
    file.content = code;
    if (editorInstance) {
      editorInstance.setValue(code);
    }
    saveWorkspace();
    addConsoleLog('engine', `Preset ${activePresetName} resetado com sucesso!`);
  }
}

// #endregion ---> WORKSPACE & FILE MANAGEMENT

// #region ---> MONACO EDITOR INTEGRATION

function initMonacoEditor() {
  const editorEl = document.getElementById('monaco-editor');
  if (!editorEl) return;

  // Carregar arquivo inicial
  const activeFileObj = files.find(f => f.name === activeFile) || files[0];

  editorInstance = monaco.editor.create(editorEl, {
    value: activeFileObj.content,
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
    fontFamily: 'Fira Code, JetBrains Mono, monospace',
    fontSize: 13,
    minimap: { enabled: false },
    cursorBlinking: 'smooth',
    lineHeight: 20,
    scrollbar: {
      vertical: 'visible',
      horizontal: 'visible',
      useShadows: false,
      verticalScrollbarSize: 8,
      horizontalScrollbarSize: 8
    }
  });

  // Atualizar o vetor virtual de arquivos conforme o usuário digita
  editorInstance.onDidChangeModelContent(() => {
    const file = files.find(f => f.name === activeFile);
    if (file && editorInstance) {
      file.content = editorInstance.getValue();
    }
  });

  // Salvar no IndexedDB periodicamente (auto-save) ao parar de digitar por 1 segundo
  let typingTimer: number;
  editorInstance.onDidChangeModelContent(() => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(saveWorkspace, 1000) as unknown as number;
  });
}

// #endregion ---> MONACO EDITOR INTEGRATION

// #region ---> DYNAMIC SANDBOX EXECUTION & LOG CAPTURE

function clearConsoleLogs() {
  const container = document.getElementById('console-logs-container');
  if (container) {
    container.innerHTML = '';
  }
  logs = [];
}

function addConsoleLog(type: string, text: string) {
  const container = document.getElementById('console-logs-container');
  if (!container) return;

  const logLine = document.createElement('div');
  logLine.className = `log-line ${type}`;
  logLine.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  container.appendChild(logLine);
  container.scrollTop = container.scrollHeight;

  logs.push({ type, text });
}

// Parar Sandbox
function stopSandbox() {
  const viewport = document.getElementById('sandbox-view-port');
  if (!viewport) return;

  viewport.innerHTML = `
    <div style="color: var(--color-muted); font-size: 0.9rem; text-align: center; padding: 2rem;" id="sandbox-placeholder">
      <img src="/capibrio.png" style="width: 80px; image-rendering: pixelated; margin-bottom: 1rem; opacity: 0.5;">
      <p>Sandbox interrompido. Clique em <strong>▶ Executar</strong> para rodar a engine Canvas</p>
    </div>
  `;
  addConsoleLog('engine', 'Sandbox finalizado e listeners limpos.');
}

// Transpilar e rodar sandbox dinamicamente no iframe com Import Maps
function runSandbox() {
  // Salvar estado atual do editor
  if (editorInstance) {
    const currentFile = files.find(f => f.name === activeFile);
    if (currentFile) {
      currentFile.content = editorInstance.getValue();
    }
  }

  const viewport = document.getElementById('sandbox-view-port');
  if (!viewport) return;

  viewport.innerHTML = ''; // Limpar placeholder

  const iframe = document.createElement('iframe');
  iframe.className = 'sandbox-iframe';
  viewport.appendChild(iframe);

  // Mapear arquivos da workspace virtual para Blob URLs
  const fileBlobUrls: Record<string, string> = {};
  files.forEach(file => {
    const blob = new Blob([file.content], { type: 'application/javascript' });
    fileBlobUrls[file.name] = URL.createObjectURL(blob);
  });

  // Criar Import Map dinamicamente mapeando "brio-js" e os arquivos virtuais locais
  const imports: Record<string, string> = {
    'brio-js': '/brio/index.js'
  };
  files.forEach(file => {
    imports[`./${file.name}`] = fileBlobUrls[file.name];
  });

  const importMap = { imports };

  // HTML que será injetado no Sandbox Iframe
  const iframeHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background: #050608;
          display: flex;
          justify-content: center;
          align-items: center;
          overflow: hidden;
        }
        #game-container {
          width: 460px;
          height: 360px;
          position: relative;
          background: #07090c;
          border: 1px solid rgba(102, 252, 241, 0.15);
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(102, 252, 241, 0.05);
        }
        canvas {
          display: block;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
      </style>
      
      <!-- Script para interceptação de logs e erros e envio ao pai -->
      <script>
        (function() {
          const originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info
          };

          function sendLog(type, args) {
            const text = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
            window.parent.postMessage({ type: 'CONSOLE_LOG', logType: type, text }, '*');
          }

          console.log = function(...args) {
            originalConsole.log.apply(console, args);
            sendLog('info', args);
          };

          console.error = function(...args) {
            originalConsole.error.apply(console, args);
            sendLog('error', args);
          };

          console.warn = function(...args) {
            originalConsole.warn.apply(console, args);
            sendLog('warn', args);
          };

          console.info = function(...args) {
            originalConsole.info.apply(console, args);
            sendLog('engine', args);
          };

          // Capturar erros fatais não tratados de runtime
          window.addEventListener('error', function(event) {
            sendLog('error', [event.message + ' em ' + event.filename + ':' + event.lineno]);
          });
        })();
      </script>

      <!-- Import Map para carregar os módulos virtuais em tempo de execução -->
      <script type="importmap">
        ${JSON.stringify(importMap, null, 2)}
      </script>
    </head>
    <body>
      <div id="game-container"></div>
      
      <!-- Script principal que executa a aplicação do usuário -->
      <script type="module" src="${fileBlobUrls['index.js']}"></script>
    </body>
    </html>
  `;

  // Injetar código no Iframe
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (doc) {
    addConsoleLog('engine', `Iniciando compilação do sandbox...`);
    doc.open();
    doc.write(iframeHTML);
    doc.close();
    addConsoleLog('engine', `Instanciação da engine BrioJS iniciada.`);
  }
}

// Capturar logs postados do Iframe no pai
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CONSOLE_LOG') {
    addConsoleLog(event.data.logType, event.data.text);
  }
});

// #endregion ---> DYNAMIC SANDBOX EXECUTION & LOG CAPTURE

// #region ---> BOOT UP ACTIONS

async function bootUp() {
  await initWorkspace();
  initUI();
  await fetchAndSetupTypings();
}

// Iniciar a aplicação
bootUp();

// #endregion ---> BOOT UP ACTIONS
