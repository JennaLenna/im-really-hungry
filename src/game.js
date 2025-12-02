// Pixelated Title Screen Renderer
(function(){
  const canvas = document.getElementById('titleCanvas');
  const ctx = canvas.getContext('2d');

  // Offscreen low-res buffer to draw pixel-art into
  const buffer = document.createElement('canvas');
  const bw = 320; // buffer width (low-res)
  const bh = 200; // buffer height (low-res)
  buffer.width = bw;
  buffer.height = bh;
  const bctx = buffer.getContext('2d');
  bctx.imageSmoothingEnabled = false;

  // static offscreen layer for sky + trees to avoid redrawing heavy static parts every frame
  const staticCanvas = document.createElement('canvas');
  staticCanvas.width = bw;
  staticCanvas.height = bh;
  const staticCtx = staticCanvas.getContext('2d');
  staticCtx.imageSmoothingEnabled = false;
  let staticDirty = true;

  // Colors palette (simple wood tones)
  const palette = {
    woodBase: '#d9c9ad', // pale brown base
    woodLight: '#f3e7cf',
    woodMid: '#d0b68f',
    woodDark: '#9b7a56',
    woodDarker: '#6b4a30',
    outline: '#4b2b16',
    skyTop: '#8fd1ff',
    skyBottom: '#c8eeff'
  };

  function resizeCanvas(){
    const style = getComputedStyle(canvas);
    const cssW = parseFloat(style.width);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssW * ratio);
    canvas.height = Math.round((cssW * (bh/bw)) * ratio);
    ctx.imageSmoothingEnabled = false;
    // mark static layer dirty (needs re-render at the new size)
    staticCanvas.width = bw;
    staticCanvas.height = bh;
    staticCtx.imageSmoothingEnabled = false;
    staticDirty = true;
    draw();
  }

  // Draw sky gradient on buffer
  // draw sky onto a provided context (or used via drawSky() which draws to bctx)
  function drawSkyTo(ctx){
    const bctx = ctx; // shadow outer bctx so existing code can reuse the name
    // draw a stepped (pixelated) vertical gradient by drawing horizontal bands
    const steps = 32; // number of bands (more = smoother)
    for(let i=0;i<steps;i++){
      const t0 = i / steps;
      const t1 = (i+1) / steps;
      // lerp colors between skyTop and skyBottom
      const c = lerpColor(palette.skyTop, palette.skyBottom, (t0 + t1) / 2);
      const y = Math.floor(t0 * bh);
      const h = Math.max(1, Math.floor((t1 * bh) - y));
      bctx.fillStyle = c;
      bctx.fillRect(0, y, bw, h);
    }
  }

  function drawSky(){ drawSkyTo(bctx); }

  // linear interpolate two hex colors, return hex
  function lerpColor(a, b, t){
    const pa = hexToRgb(a);
    const pb = hexToRgb(b);
    const r = Math.round(pa.r + (pb.r - pa.r) * t);
    const g = Math.round(pa.g + (pb.g - pa.g) * t);
    const bl = Math.round(pa.b + (pb.b - pa.b) * t);
    return rgbToHex(r,g,bl);
  }
  function hexToRgb(hex){
    const h = hex.replace('#','');
    return {r: parseInt(h.substring(0,2),16), g: parseInt(h.substring(2,4),16), b: parseInt(h.substring(4,6),16)};
  }
  function rgbToHex(r,g,b){
    const toHex = v => ('0'+v.toString(16)).slice(-2);
    return '#'+toHex(r)+toHex(g)+toHex(b);
  }

  // deterministic pseudo-random in [0,1)
  function pseudoRandom(x){
    return fract(Math.abs(Math.sin(x * 12.9898) * 43758.5453));
  }
  function fract(v){ return v - Math.floor(v); }

  function randomBetween(min, max){
    return min + Math.random() * (max - min);
  }

  // --- petals (cherry blossom blocks) ---
  const petals = [];
  // tweakable multiplier to keep petals visible even if rendering gets heavier
  // reduced from 2.4 -> 1.6 to make fall speed a bit slower while keeping smoothness
  const PETAL_SPEED_MULT = 1.6;
  function createPetals(n = 28){
    petals.length = 0;
    for(let i=0;i<n;i++){
      const size = 1 + Math.floor(pseudoRandom(i*1.3) * 4); // 1..4
      const baseX = Math.floor(pseudoRandom(i*3.7) * bw);
      const y = Math.floor(-pseudoRandom(i*5.1) * bh);
      const speed = (8 + Math.floor(pseudoRandom(i*7.9) * 24)) * PETAL_SPEED_MULT; // pixels per second
      const amp = 6 + Math.floor(pseudoRandom(i*2.5) * 18); // horizontal amplitude
      const freq = 0.02 + pseudoRandom(i*9.1)*0.04;
      const phase = pseudoRandom(i*4.4) * Math.PI * 2;
      // decide whether this petal starts in front or behind the plank
      const layer = pseudoRandom(i*11.7) > 0.5 ? 'front' : 'back';
      petals.push({baseX, x: baseX, y, size, speed, amp, freq, phase, layer});
    }
  }

  function updatePetals(dt){
    for(const p of petals){
      p.y += p.speed * dt;
      // wavy horizontal movement based on vertical position
      p.x = p.baseX + Math.sin((p.y * p.freq) + p.phase) * p.amp;
      // small drift to baseX over time
      p.baseX += Math.sin((p.phase + p.y*0.01))*0.02;
      if(p.y > bh + 10){
        // recycle to top
        p.y = - (1 + Math.floor(pseudoRandom(p.phase*7.1)*20));
        p.baseX = Math.floor(pseudoRandom(p.phase*3.3) * bw);
        p.size = 1 + Math.floor(pseudoRandom(p.phase*4.7) * 4);
        p.speed = (8 + Math.floor(pseudoRandom(p.phase*5.9) * 24)) * PETAL_SPEED_MULT;
        p.amp = 6 + Math.floor(pseudoRandom(p.phase*2.2) * 18);
        p.freq = 0.02 + pseudoRandom(p.phase*8.1)*0.04;
        p.phase = pseudoRandom(p.phase*9.3) * Math.PI * 2;
        // reassign layer occasionally so some petals change depth
        p.layer = pseudoRandom(p.phase*2.7) > 0.5 ? 'front' : 'back';
      }
    }
  }

  function drawPetals(layer){
    // draw petals as blocky squares; back-layer petals keep the original pink, front-layer are slightly lighter
    const petalPinkBack = '#f7c7d6';
    const petalPinkFront = '#fbe8ef';
    for(const p of petals){
      if(layer && p.layer !== layer) continue; // when layer filter provided, draw only that layer
      const color = (p.layer === 'front') ? petalPinkFront : petalPinkBack;
      bctx.fillStyle = color;
      // draw as square of size p.size (pixel-units)
      bctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      // a tiny second block to make some petals chunkier (still same color)
      if(p.size > 1 && pseudoRandom(p.phase*6.7) > 0.7) bctx.fillRect(Math.round(p.x)+p.size, Math.round(p.y)+1, 1, 1);
    }
  }

  // --- wispy pixelated clouds (drawn on top of everything, slightly transparent) ---
  const clouds = [];
  // fade transition state (top-level so draw() can access it)
  let fadeActive = false;
  let fadeT = 0; // 0..1 progress
  const messages = [
    ["I've never seen", 'the ocean before...'],
    ["Maybe that's why Sam", 'told me I should come here.']
  ];
  const TITLE_MUSIC_TRACK = 'titleMusic';
  const TITLE_MUSIC_TARGET_VOLUME = 0.68;
  const TITLE_MUSIC_FADE_IN = 3.2;
  const TITLE_MUSIC_FADE_OUT = 2.6;
  const ADVENTURE_MUSIC_TRACK = 'adventureMusic';
  const ADVENTURE_MUSIC_TARGET_VOLUME = 0.64;
  const ADVENTURE_MUSIC_FADE_IN = 2.8;
  const ADVENTURE_MUSIC_FADE_OUT = 1.8;
  let messageIndex = 0;
  let messageSequenceDone = false;
  let messageAlpha = 0;
  let messageTargetAlpha = 0;
  let messageFadeOut = false;
  const MESSAGE_FADE_SPEED = 2.2; // alpha units per second
  const FADE_DURATION = 3.5; // seconds (slower fade)
  const FADE_TARGET = '#ECF8F8';
  const POST_STATE = {
    idle: 'idle',
    toBlack: 'toBlack',
    blackHold: 'blackHold',
    eyeOpening: 'eyeOpening',
    eyeClosing: 'eyeClosing',
    eyeFinalOpen: 'eyeFinalOpen',
    done: 'done'
  };
  let postState = POST_STATE.idle;
  let blackFade = 0;
  let blackHoldTimer = 0;
  let eyeCrackProgress = 0;
  let eyeCloseProgress = 0;
  let eyeFinalProgress = 0;
  const BLACK_FADE_DURATION = 2.8;
  const BLACK_HOLD_DURATION = 4;
  const EYE_OPEN_DURATION = 3.2;
  const EYE_CLOSE_DURATION = 1.8;
  const EYE_FINAL_DURATION = 2.6;

  const audioTracks = [
    {
      name: TITLE_MUSIC_TRACK,
      element: new Audio('sound effects/Adventure Title screen.mp3'),
      baseTargetVolume: 0,
      currentTargetVolume: 0,
      baseFadeDuration: TITLE_MUSIC_FADE_IN,
      currentFadeDuration: TITLE_MUSIC_FADE_IN,
      loop: true,
      autoStart: false,
      allowIdlePlayback: true,
      retrigger: true,
      started: false,
      playPending: false,
      playAttempted: false,
      retryDelay: 0,
      lastError: null
    },
    {
      name: 'waves',
      element: new Audio('sound effects/soothing-ocean-waves-372489.mp3'),
      baseTargetVolume: 0.7,
      currentTargetVolume: 0.7,
      baseFadeDuration: 5.5,
      currentFadeDuration: 5.5,
      loop: true,
      autoStart: true,
      started: false,
      playPending: false,
      playAttempted: false,
      retryDelay: 0,
      lastError: null
    },
    {
      name: 'seagulls',
      element: new Audio('sound effects/sound-effect-seagulls-157829.mp3'),
      baseTargetVolume: 0.45,
      currentTargetVolume: 0.45,
      baseFadeDuration: 6.4,
      currentFadeDuration: 6.4,
      loop: true,
      autoStart: true,
      started: false,
      playPending: false,
      playAttempted: false,
      retryDelay: 0,
      lastError: null
    },
    {
      name: 'huh',
      element: new Audio('sound effects/huh-128934.mp3'),
      baseTargetVolume: 0,
      currentTargetVolume: 0,
      baseFadeDuration: 0.12,
      currentFadeDuration: 0.12,
      loop: false,
      autoStart: false,
      retrigger: true,
      started: false,
      playPending: false,
      playAttempted: false,
      retryDelay: 0,
      lastError: null
    },
    {
      name: 'ping',
      element: new Audio('sound effects/happy-message-ping-351298.mp3'),
      baseTargetVolume: 0,
      currentTargetVolume: 0,
      baseFadeDuration: 0.08,
      currentFadeDuration: 0.08,
      loop: false,
      autoStart: false,
      retrigger: true,
      started: false,
      playPending: false,
      playAttempted: false,
      retryDelay: 0,
      lastError: null
    },
    {
      name: ADVENTURE_MUSIC_TRACK,
      element: new Audio('sound effects/Dungeons and dragons.mp3'),
      baseTargetVolume: 0,
      currentTargetVolume: 0,
      baseFadeDuration: ADVENTURE_MUSIC_FADE_IN,
      currentFadeDuration: ADVENTURE_MUSIC_FADE_IN,
      loop: true,
      autoStart: false,
      allowIdlePlayback: true,
      retrigger: true,
      started: false,
      playPending: false,
      playAttempted: false,
      retryDelay: 0,
      lastError: null
    },
    {
      name: 'pickup',
      element: new Audio('sound effects/picksomethingup.mp3'),
      baseTargetVolume: 0,
      currentTargetVolume: 0,
      baseFadeDuration: 0.08,
      currentFadeDuration: 0.08,
      loop: false,
      autoStart: false,
      allowIdlePlayback: true,
      retrigger: true,
      started: false,
      playPending: false,
      playAttempted: false,
      retryDelay: 0,
      lastError: null
    }
  ];
  for(const track of audioTracks){
    track.element.loop = !!track.loop;
    if(!track.loop){
      track.element.addEventListener('ended', ()=>{
        track.started = false;
        track.playAttempted = false;
        track.playPending = false;
      });
    }
  }
  const HUH_DURATION = 1.0;
  const PING_DELAY_AFTER_HUH = 1.0;
  const PING_BOX_FADE_DURATION = 0.65;
  const AMBIENT_FADE_POST_HUH_DELAY = 0.35;
  let huhTimer = 0;
  let ambienceSoftened = false;
  let huhTriggered = false;
  let huhPlaying = false;
  let ambienceFullFadeQueued = false;
  let ambienceFullFadeTimer = 0;
  let pingPending = false;
  let pingDelayTimer = 0;
  let pingTriggered = false;
  let pingBoxProgress = 0;
  let pingTypeProgress = 0;
  let pingTypeIndex = 0;
  let pingTypingActive = false;
  let dialoguePortraitDraw = null;
  let dialoguePortraitKey = 'ping';
  let dialogueOnComplete = null;
  let dialogueOnCancel = null;
  let dialogueContext = 'intro';
  const INITIAL_PING_DIALOGUES = [
    "Hi! I'm Kieryln. I'm so glad you showed up!",
    "Can you remind me your name?"
  ];
  const POST_GREETING_DIALOGUES = [
    "Ever since the storm struck, things just haven't been the same...",
    "Actually, could you help me with that? I need to gather 10 pieces of driftwood."
  ];
  let pingDialogues = INITIAL_PING_DIALOGUES.slice();
  const PING_TYPE_INTERVAL = 0.08;
  const TYPE_SOUND_POOL_SIZE = 6;
  const typeSoundPool = [];
  let typeSoundIndex = 0;
  let typeSoundsPrimed = false;
  const SCENE = { title: 'title', adventure: 'adventure' };
  let currentScene = SCENE.title;
  const SAND_COLOR = '#f4d6a5';
  const ADVENTURE_WORLD_WIDTH = Math.round(bw * 4.2);
  const CAMERA_FOLLOW_LERP = 6.5;
  const CAMERA_EDGE_MARGIN = Math.round(bw * 0.18);
  const CAMERA_MAX_OFFSET = Math.max(0, ADVENTURE_WORLD_WIDTH - bw);
  const WAVE_BASELINE = Math.round(bh * 0.22);
  const WAVE_EDGE_AMPLITUDE = Math.round(bh * 0.027);
  const WAVE_TIDE_AMPLITUDE = Math.round(bh * 0.012);
  const WAVE_SCROLL_SPEED = 0.55;
  const WAVE_TIDE_SPEED = 0.28;
  const WAVE_PRIMARY_FREQUENCY = Math.PI * 4.2 / Math.max(1, ADVENTURE_WORLD_WIDTH);
  const WAVE_SECONDARY_FREQUENCY = Math.PI * 7.4 / Math.max(1, ADVENTURE_WORLD_WIDTH);
  const WAVE_COLLISION_PADDING = 12;
  const WAVE_FOAM_COLORS = ['#f3fbff', '#d8eefc'];
  const WAVE_DEPTH_COLORS = ['#102c45', '#173e5e', '#265a82', '#3b7ba6'];
  const INVENTORY_SLOT_COUNT = 30;
  const INVENTORY_COLUMNS = 6;
  const INVENTORY_SLOT_SIZE = 18;
  const INVENTORY_SLOT_GAP = 3;
  const INVENTORY_PANEL_PADDING = 10;
  const INVENTORY_HEADER_FONT = 18;
  const INVENTORY_BUTTON_MARGIN = 6;
  const INVENTORY_ICON_BASE_SCALE = 0.72;
  const INVENTORY_ICON_SCALE_OVERRIDES = {
    shell1: 0.06
  };
  const INVENTORY_VIEW = { inventory: 'inventory', journal: 'journal' };
  const JOURNAL_PAGE_COUNT = 3;
  const JOURNAL_HEADER_FONT = 16;
  const JOURNAL_BODY_FONT = 10;
  const JOURNAL_BUTTON_FONT = 10;
  const JOURNAL_TEXT_PADDING = 4;
  const JOURNAL_MAX_CHARS = 900;
  const JOURNAL_PLACEHOLDER_TEXT = 'click to write in your journal';
  const INVENTORY_TUTORIAL_WIDTH = 150;
  const INVENTORY_TUTORIAL_GAP = 12;
  const INVENTORY_TUTORIAL_HEADER_FONT = 16;
  const INVENTORY_TUTORIAL_BODY_FONT = 10;
  const INVENTORY_TUTORIAL_TEXT = [
    '- use arrow keys or click to move',
    '- click on players and items to interact',
    '- press i to open your inventory',
    '- press esc to close menus'
  ].join('\n');
  const INVENTORY_ITEM_INFO = {
    driftwood: {
      title: 'DRIFTWOOD',
      bio: "You found this washed up on the beach, but it isn't like the photos say..."
    },
    seaweed: {
      title: 'SEAWEED',
      bio: "It's disgustingly green and disgustingly slimy. Seriously, why did you pick this up?"
    },
    shell1: {
      title: 'SHELL',
      bio: 'Is it fancy? Probably. Can you hear the ocean with it? TBD.'
    }
  };
  const INVENTORY_COUNT_GLYPH_WIDTH = 7;
  const INVENTORY_COUNT_GLYPH_HEIGHT = 8;
  const INVENTORY_COUNT_GLYPH_SPACING = 1;
  const INVENTORY_COUNT_GLYPHS = {
    '0': [
      '0011100',
      '0100010',
      '0100110',
      '0101010',
      '0110010',
      '0100010',
      '0011100',
      '0000000'
    ],
    '1': [
      '0001000',
      '0011000',
      '0101000',
      '0001000',
      '0001000',
      '0001000',
      '0111110',
      '0000000'
    ],
    '2': [
      '0011100',
      '0100010',
      '0000010',
      '0000100',
      '0001000',
      '0010000',
      '0111110',
      '0000000'
    ],
    '3': [
      '0011100',
      '0100010',
      '0000010',
      '0001100',
      '0000010',
      '0100010',
      '0011100',
      '0000000'
    ],
    '4': [
      '0000100',
      '0001100',
      '0010100',
      '0100100',
      '0111110',
      '0000100',
      '0000100',
      '0000000'
    ],
    '5': [
      '0111110',
      '0100000',
      '0111100',
      '0000010',
      '0000010',
      '0100010',
      '0011100',
      '0000000'
    ],
    '6': [
      '0011100',
      '0100000',
      '0111100',
      '0100010',
      '0100010',
      '0100010',
      '0011100',
      '0000000'
    ],
    '7': [
      '0111110',
      '0000010',
      '0000100',
      '0001000',
      '0010000',
      '0010000',
      '0010000',
      '0000000'
    ],
    '8': [
      '0011100',
      '0100010',
      '0100010',
      '0011100',
      '0100010',
      '0100010',
      '0011100',
      '0000000'
    ],
    '9': [
      '0011100',
      '0100010',
      '0100010',
      '0011110',
      '0000010',
      '0100010',
      '0011100',
      '0000000'
    ],
    '?': [
      '0011100',
      '0100010',
      '0000010',
      '0001100',
      '0001000',
      '0000000',
      '0001000',
      '0000000'
    ]
  };
  const INVENTORY_COUNT_PADDING = 0;
  const INVENTORY_COUNT_BORDER_WIDTH = 1;
  const CURRENCY_ICON_MARGIN = 6;
  const CURRENCY_TEXT_COLOR = '#2a2117';
  const CURRENCY_AMOUNT_COLOR = '#d8b54c';
  const CURRENCY_SHADOW_COLOR = '#3a3834';
  const ADVENTURE_FADE_DURATION = 2.2;
  let adventureFade = 0;
  let adventureFadeActive = false;
  let adventureScenePending = false;
  const mcSprite = new Image();
  let mcSpriteReady = false;
  mcSprite.addEventListener('load', ()=>{ mcSpriteReady = true; });
  mcSprite.src = 'character images/MCwalk.png';
  const kgirlSprite = new Image();
  let kgirlSpriteReady = false;
  kgirlSprite.addEventListener('load', ()=>{ kgirlSpriteReady = true; });
  kgirlSprite.src = 'character images/kgirlwalk.png';
  const wiseSprite = new Image();
  let wiseSpriteReady = false;
  wiseSprite.addEventListener('load', ()=>{ wiseSpriteReady = true; });
  wiseSprite.src = 'character images/wisedudewalk.png';
  const MC_DIRECTIONS = { down: 'down', left: 'left', right: 'right', up: 'up' };
  const MC_FRAME_RECTS = {
    down: [
      {sx: 7, sy: 3, sw: 33, sh: 45},
      {sx: 54, sy: 3, sw: 33, sh: 45},
      {sx: 102, sy: 3, sw: 32, sh: 45}
    ],
    left: [
      {sx: 7, sy: 51, sw: 35, sh: 45},
      {sx: 55, sy: 51, sw: 34, sh: 45},
      {sx: 103, sy: 51, sw: 33, sh: 45}
    ],
    right: [
      {sx: 5, sy: 99, sw: 34, sh: 45},
      {sx: 54, sy: 99, sw: 33, sh: 45},
      {sx: 103, sy: 99, sw: 32, sh: 45}
    ],
    up: [
      {sx: 7, sy: 147, sw: 34, sh: 45},
      {sx: 56, sy: 147, sw: 34, sh: 45},
      {sx: 105, sy: 147, sw: 32, sh: 45}
    ]
  };
  const MC_RENDER_SCALE = 0.7;
  const MC_FRAME_COUNT = 3;
  const KGIRL_FRAME_WIDTH = 37;
  const KGIRL_FRAME_HEIGHT = 45;
  const KGIRL_FRAME_COUNT = 3;
  const KGIRL_RENDER_SCALE = 0.68;
  const KGIRL_FRAME_DURATION = 0.34;
  const KGIRL_WALK_SPEED = 18;
  const KGIRL_WALK_PADDING = {x: 18, top: 42, bottom: 6};
  const KGIRL_FRAME_RECTS = {
    down: [
      {sx: 5, sy: 3, sw: 37, sh: 45},
      {sx: 53, sy: 3, sw: 37, sh: 45},
      {sx: 101, sy: 3, sw: 37, sh: 45}
    ],
    left: [
      {sx: 5, sy: 51, sw: 36, sh: 45},
      {sx: 54, sy: 51, sw: 34, sh: 45},
      {sx: 103, sy: 51, sw: 32, sh: 45}
    ],
    right: [
      {sx: 8, sy: 99, sw: 34, sh: 45},
      {sx: 55, sy: 99, sw: 34, sh: 45},
      {sx: 102, sy: 99, sw: 34, sh: 45}
    ],
    up: [
      {sx: 5, sy: 147, sw: 37, sh: 45},
      {sx: 53, sy: 147, sw: 37, sh: 45},
      {sx: 101, sy: 147, sw: 37, sh: 45}
    ]
  };
  const WISE_FRAME_COUNT = 3;
  const WISE_RENDER_SCALE = 0.68;
  const WISE_FRAME_DURATION = 0.42;
  const WISE_WALK_SPEED = 11;
  const WISE_FRAME_RECTS = {
    down: [
      {sx: 5, sy: 3, sw: 37, sh: 45},
      {sx: 53, sy: 3, sw: 37, sh: 45},
      {sx: 101, sy: 3, sw: 37, sh: 45}
    ],
    left: [
      {sx: 5, sy: 51, sw: 36, sh: 45},
      {sx: 54, sy: 51, sw: 34, sh: 45},
      {sx: 103, sy: 51, sw: 32, sh: 45}
    ],
    right: [
      {sx: 8, sy: 99, sw: 34, sh: 45},
      {sx: 55, sy: 99, sw: 34, sh: 45},
      {sx: 102, sy: 99, sw: 34, sh: 45}
    ],
    up: [
      {sx: 5, sy: 147, sw: 37, sh: 45},
      {sx: 53, sy: 147, sw: 37, sh: 45},
      {sx: 101, sy: 147, sw: 37, sh: 45}
    ]
  };
  let mcPosition = {x: bw / 2, y: Math.round(bh * 0.62)};
  let mcDirection = MC_DIRECTIONS.down;
  let mcFrameIndex = 1;
  let mcFrameTimer = 0;
  let mcMoving = false;
  const MC_FRAME_DURATION = 0.16;
  const MC_MOVE_SPEED = 70; // pixels per second in buffer space
  const mcInputState = { up: false, down: false, left: false, right: false };
  const MC_WALK_PADDING = { x: 14, top: 40, bottom: 6 };
  let mcAutoMoveTarget = null;
  let mcAutoMoveCollectTarget = null;
  let kgirlPosition = {x: Math.round(bw * 0.68), y: Math.round(bh * 0.78)};
  let kgirlDirection = MC_DIRECTIONS.left;
  let kgirlFrameIndex = 1;
  let kgirlFrameTimer = 0;
  let kgirlMoving = false;
  let kgirlTarget = null;
  let kgirlPauseTimer = 0;
  let kgirlRewardGiven = false;
  const KGIRL_REWARD_AMOUNT = 50;
  const KGIRL_REMINDER_HINT = 'keep an eye out for the sparkling logs along the shoreline.';
  const KGIRL_REPEAT_THANKS_LINES = [
    'thanks again for helping me earlier!',
    'enjoy the sea breeze with me!'
  ];
  const WISE_WALK_PADDING = {x: 18, top: 42, bottom: 6};
  let wiseBaseX = Math.round(bw * 0.42);
  let wisePosition = {x: wiseBaseX, y: Math.round(bh * 0.64)};
  let wiseDirection = MC_DIRECTIONS.down;
  let wiseFrameIndex = 1;
  let wiseFrameTimer = 0;
  let wiseMoving = false;
  let wiseTargetY = null;
  let wisePauseTimer = 0;
  let wiseHeadingUp = false;
  let wiseEncounterComplete = false;
  let wisePathTop = Math.round(bh * 0.54);
  let wisePathBottom = Math.round(bh * 0.72);
  const DRIFTWOOD_COUNT = 10;
  const SEAWEED_COUNT = 7;
  const SHELL1_COUNT = 4;
  const DRIFTWOOD_SCALE = 0.16;
  const SEAWEED_SCALE = 0.13;
  const SHELL1_SCALE = 0.05;
  const BEACH_DECOR_MARGIN_X = 14;
  const BEACH_DECOR_MIN_SPACING = 22;
  const COLLECTIBLE_TYPES = new Set(['driftwood', 'seaweed', 'shell1']);
  const PICKUP_RANGE = 42;
  const PICKUP_MESSAGE_DURATION = 2.6;
  const PICKUP_MESSAGE_FADE = 0.45;
  const PICKUP_MESSAGE_FONT = 10;
  const PICKUP_DISPLAY_NAMES = {
    driftwood: 'driftwood',
    seaweed: 'seaweed',
    shell1: 'shell'
  };
  const AUTO_MOVE_STOP_DISTANCE = 3;

  let pickupMessage = null;
  let pickupMessageElapsed = 0;
  let pickupMessageCanvas = null;
  let pickupMessageShadowCanvas = null;

  const driftwoodImage = new Image();
  let driftwoodReady = false;
  driftwoodImage.addEventListener('load', ()=>{ driftwoodReady = true; });
  driftwoodImage.src = 'pixel images/driftwood.png';

  const seaweedImage = new Image();
  let seaweedReady = false;
  seaweedImage.addEventListener('load', ()=>{ seaweedReady = true; });
  seaweedImage.src = 'pixel images/seaweed.png';

  const shell1Image = new Image();
  let shell1Ready = false;
  shell1Image.addEventListener('load', ()=>{ shell1Ready = true; });
  shell1Image.src = 'pixel images/shell1.png';

  const beachDecor = [];
  const coinIcon = new Image();
  let coinIconReady = false;
  coinIcon.addEventListener('load', ()=>{ coinIconReady = true; });
  coinIcon.src = 'pixel images/coin.png';
  let cameraX = 0;
  let cameraTargetX = 0;
  let inventoryButtonEnabled = false;
  let inventoryButtonPending = false;
  let inventoryVisible = false;
  let inventoryButtonRect = null;
  let questButtonRect = null;
  let questsVisible = false;
  let questsPanelLayout = null;
  let currencyDisplayRect = null;
  let inventoryPanelLayout = null;
  const inventoryItems = new Array(INVENTORY_SLOT_COUNT).fill(null);
  let inventoryViewMode = INVENTORY_VIEW.inventory;
  let journalButtonRect = null;
  let journalPanelLayout = null;
  let journalPages = new Array(JOURNAL_PAGE_COUNT).fill('');
  let journalCurrentPage = 0;
  let journalEditing = false;
  let inventoryHoverSlotIndex = -1;
  let currencyAmount = 10;
  let waveShapePhase = 0;
  let waveTidePhase = 0;
  let waveVerticalOffset = 0;
  let waveSurfaceY = Math.round(WAVE_BASELINE + WAVE_EDGE_AMPLITUDE * 1.4);
  let waveCollisionY = waveSurfaceY + WAVE_COLLISION_PADDING;
  let waveForeshoreY = Math.max(0, Math.round(WAVE_BASELINE - WAVE_EDGE_AMPLITUDE * 0.6));

  function getBeachDecorImage(type){
    if(type === 'driftwood') return driftwoodReady ? driftwoodImage : null;
    if(type === 'seaweed') return seaweedReady ? seaweedImage : null;
    if(type === 'shell1') return shell1Ready ? shell1Image : null;
    return null;
  }

  function getBeachDecorScale(type){
    if(type === 'driftwood') return DRIFTWOOD_SCALE;
    if(type === 'seaweed') return SEAWEED_SCALE;
    if(type === 'shell1') return SHELL1_SCALE;
    return 1;
  }

  function generateBeachDecorPositions(){
    beachDecor.length = 0;
    const marginX = BEACH_DECOR_MARGIN_X;
    const horizontalSpan = Math.max(1, ADVENTURE_WORLD_WIDTH - marginX * 2);
    const waterCap = WAVE_BASELINE + WAVE_TIDE_AMPLITUDE + WAVE_EDGE_AMPLITUDE * 1.4;
    const minY = Math.round(Math.min(bh - 12, Math.max(0, waterCap + 8)));
    const maxY = bh - 10;
    const verticalRange = Math.max(1, maxY - minY);
    const maxAttempts = 12;

    function tooClose(x, y){
      for(const deco of beachDecor){
        const dx = deco.x - x;
        const dy = deco.y - y;
        if(Math.abs(dx) < BEACH_DECOR_MIN_SPACING && Math.abs(dy) < BEACH_DECOR_MIN_SPACING * 0.7){
          return true;
        }
      }
      return false;
    }

    function placeBatch(type, count, seedBase){
      if(count <= 0) return;
      for(let i=0; i<count; i++){
        let selected = null;
        for(let attempt=0; attempt<maxAttempts; attempt++){
          const seed = seedBase + i * 71.17 + attempt * 19.37;
          const base = (i + 0.5) / count;
          const jitter = (pseudoRandom(seed) - 0.5) * 0.6;
          const normalized = Math.max(0, Math.min(1, base + jitter));
          const x = Math.round(marginX + normalized * horizontalSpan);
          const noiseY = pseudoRandom(seed * 1.37);
          const offsetY = Math.round((pseudoRandom(seed * 2.13) - 0.5) * 12);
          const y = Math.max(minY, Math.min(maxY, Math.round(minY + noiseY * verticalRange) + offsetY));
          if(!tooClose(x, y)){
            const flip = pseudoRandom(seed * 3.11) > 0.5;
            selected = {type, x, y, flip, collected: false};
            break;
          }
        }
        if(!selected){
          const fallbackSeed = seedBase + i * 413.2;
          const normalized = Math.max(0, Math.min(1, (i + 0.5) / (count + 0.5)));
          const x = Math.round(marginX + normalized * horizontalSpan);
          const y = Math.max(minY, Math.min(maxY, Math.round(minY + pseudoRandom(fallbackSeed) * verticalRange)));
          const flip = pseudoRandom(fallbackSeed * 1.91) > 0.5;
          selected = {type, x, y, flip, collected: false};
        }
        beachDecor.push(selected);
      }
    }

    placeBatch('driftwood', DRIFTWOOD_COUNT, 500);
    placeBatch('seaweed', SEAWEED_COUNT, 1700);
    placeBatch('shell1', SHELL1_COUNT, 2900);
    beachDecor.sort((a, b) => a.y - b.y);
  }

  generateBeachDecorPositions();

  let pingDialogueIndex = 0;
  let pingCurrentText = pingDialogues[0] || '';
  let postGreetingPending = false;
  let namePromptCompleted = false;
  let namePromptState = 'hidden';
  let namePromptProgress = 0;
  let namePromptCaretTimer = 0;
  let namePromptLayout = null;
  let nameInput = '';
  let playerName = '';
  const NAME_INPUT_MAX_LENGTH = 16;
  const NAME_PROMPT_FADE_DURATION = 0.45;
  // Shared helper so every dialogue sequence uses the exact same box, font,
  // and typewriter behaviour. Future scenes can call dialogueManager methods
  // instead of reimplementing the style.
  const dialogueManager = {
    setSequence(lines, options = {}){
      const sequence = Array.isArray(lines) ? lines.filter(line => typeof line === 'string') : [];
      const {startIndex = 0, startTyping = false} = options;
      pingDialogues = sequence.slice();
      if(pingDialogues.length === 0){
        pingDialogueIndex = 0;
        pingCurrentText = '';
        pingTypeIndex = 0;
        pingTypeProgress = 0;
        pingTypingActive = false;
        return;
      }
      const safeIndex = Math.max(0, Math.min(startIndex, pingDialogues.length - 1));
      pingDialogueIndex = safeIndex;
      pingCurrentText = pingDialogues[safeIndex] || '';
      pingTypeIndex = 0;
      pingTypeProgress = 0;
      pingTypingActive = !!startTyping && !!pingCurrentText;
    },
    appendLines(lines, options = {}){
      let incoming = Array.isArray(lines) ? lines : [lines];
      incoming = incoming.filter(line => typeof line === 'string');
      if(incoming.length === 0) return;
      if(pingDialogues.length === 0){
        this.setSequence(incoming, options);
      }else{
        pingDialogues = pingDialogues.concat(incoming);
      }
    },
    advance(){
      if(pingDialogueIndex < pingDialogues.length - 1){
        pingDialogueIndex++;
        pingCurrentText = pingDialogues[pingDialogueIndex] || '';
        pingTypeIndex = 0;
        pingTypeProgress = 0;
        pingTypingActive = !!pingCurrentText;
        return true;
      }
      return false;
    },
    skipTyping(){
      pingTypeIndex = pingCurrentText.length;
      pingTypeProgress = 0;
      pingTypingActive = false;
    },
    clear(){
      pingDialogues = [];
      pingDialogueIndex = 0;
      pingCurrentText = '';
      pingTypeIndex = 0;
      pingTypeProgress = 0;
      pingTypingActive = false;
    }
  };
  let questPromptState = 'hidden';
  let questPromptProgress = 0;
  let questPromptLayout = null;
  let questPromptPending = false;
  let questPromptReady = false;
  let questAccepted = false;
  const QUEST_PROMPT_FADE_DURATION = 0.45;
  const QUEST_PROMPT_TEXT = 'accept quest?';
  const QUEST_PROMPT_BUTTON = 'yes';
  const QUEST_EMPTY_MESSAGE_LINES = [
    'no quests right now.',
    'maybe soak in the sea breeze.'
  ];
  const TITLE_SCREEN_IGNORED_KEY_CODES = new Set([
    'AudioVolumeMute',
    'AudioVolumeDown',
    'AudioVolumeUp',
    'VolumeMute',
    'VolumeDown',
    'VolumeUp',
    'XF86AudioMute',
    'XF86AudioLowerVolume',
    'XF86AudioRaiseVolume'
  ]);
  const TITLE_SCREEN_IGNORED_KEYS = new Set([
    'AudioVolumeMute',
    'AudioVolumeDown',
    'AudioVolumeUp',
    'VolumeMute',
    'VolumeDown',
    'VolumeUp',
    'XF86AudioMute',
    'XF86AudioLowerVolume',
    'XF86AudioRaiseVolume'
  ]);
  const INTRO_SPACE_HINT_TEXT = 'press space to continue';
  let finalFadeActive = false;
  let finalFadeProgress = 0;
  const FINAL_FADE_DURATION = 2.4;
  function ensureTypeSoundPool(){
    if(typeSoundPool.length > 0) return;
    for(let i=0;i<TYPE_SOUND_POOL_SIZE;i++){
      const audio = new Audio('sound effects/computer-mouse-click-02-383961.mp3');
      audio.preload = 'auto';
      audio.volume = 0.7;
      audio.muted = false;
      audio.load();
      typeSoundPool.push(audio);
    }
  }

  function primeTypeSoundPool(){
    if(typeSoundsPrimed) return;
    ensureTypeSoundPool();
    if(typeSoundPool.length === 0) return;
    typeSoundsPrimed = true;
    for(const audio of typeSoundPool){
      try{
        const originalVolume = audio.volume;
        audio.volume = 0;
        const playPromise = audio.play();
        if(playPromise && typeof playPromise.then === 'function'){
          playPromise.then(()=>{
            audio.pause();
            audio.currentTime = 0;
            audio.volume = originalVolume;
          }).catch(()=>{
            audio.currentTime = 0;
            audio.volume = originalVolume;
          });
        }else{
          audio.pause();
          audio.currentTime = 0;
          audio.volume = originalVolume;
        }
      }catch(_err){
        try{ audio.currentTime = 0; }catch(_err2){}
      }
    }
  }
  function playTypeSound(){
    if(typeSoundPool.length === 0){
      ensureTypeSoundPool();
      if(typeSoundPool.length === 0) return;
    }
    const audio = typeSoundPool[typeSoundIndex];
    typeSoundIndex = (typeSoundIndex + 1) % typeSoundPool.length;
    try{
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.7;
      const p = audio.play();
      if(p && typeof p.catch === 'function') p.catch(()=>{});
    }catch(_err){}
  }
  const pingPortrait = new Image();
  let pingPortraitReady = false;
  pingPortrait.addEventListener('load', ()=>{ pingPortraitReady = true; });
  pingPortrait.src = 'character images/girl.png';
  const PING_PORTRAIT_SOURCE = {x: 4, y: 0, width: 140, height: 144};
  const wisePortrait = new Image();
  let wisePortraitReady = false;
  wisePortrait.addEventListener('load', ()=>{ wisePortraitReady = true; });
  wisePortrait.src = 'character images/wisedude.png';
  const WISE_PORTRAIT_SOURCE = {x: 0, y: 0, width: 144, height: 144};

  audioTracks.forEach(track => {
    track.element.loop = track.loop;
    track.element.preload = 'auto';
    track.element.volume = 0;
  });
  function createClouds(n = 6){
    clouds.length = 0;
    for(let i=0;i<n;i++){
      const w = 40 + Math.floor(pseudoRandom(i*3.3) * 80); // width in px
      const h = 8 + Math.floor(pseudoRandom(i*4.2) * 20); // height in px
      const x = Math.floor(pseudoRandom(i*5.1) * bw) - w/2;
      const y = Math.floor(pseudoRandom(i*6.7) * (bh * 0.25)); // top quarter
      const speed = (0.5 + pseudoRandom(i*7.3) * 1.2); // slow horizontal drift
      const density = 0.35 + pseudoRandom(i*8.9) * 0.55; // how filled the cloud is
      const block = 2 + Math.floor(pseudoRandom(i*9.1) * 3); // pixel block size
      const phase = pseudoRandom(i*11.2) * Math.PI * 2;
      clouds.push({x,w,h,y,speed,density,block,phase});
    }
  }

  function updateClouds(dt){
    for(const c of clouds){
      c.x += c.speed * dt * 12; // scaled so movement is noticeable but slow
      // subtle vertical bobbing
      c.y += Math.sin((performance.now()/1000) * 0.3 + c.phase) * 0.01; // smaller bobbing for subtlety
      if(c.x > bw + c.w) c.x = -c.w - Math.floor(pseudoRandom(c.phase*7.3)*40);
    }
  }

  function drawClouds(){
    // draw on the working buffer (bctx) so clouds appear above dynamic content
    for(const c of clouds){
      const block = c.block;
      // cloud color white, alpha varies per cell for wispy look
      for(let ox=0; ox < c.w; ox += block){
        for(let oy=0; oy < c.h; oy += block){
          const gx = Math.round(c.x + ox);
          const gy = Math.round(c.y + oy);
          // skip pixels outside top area (keep clouds at top)
          if(gy < 0 || gy >= bh) continue;
          // density and noise decide whether this block exists
          // sample at a lower spatial frequency so alpha/noise changes more slowly as clouds move
          const sampleX = Math.floor(gx / Math.max(1, block*3));
          const sampleY = Math.floor(gy / Math.max(1, block*3));
          const n = pseudoRandom((c.phase*13.1) + (ox*0.17) + (oy*0.23) + (sampleX*0.07) + (sampleY*0.11));
          if(n > c.density) continue;
          // alpha softer towards edges: compute distance to cloud center
          const cx = c.w/2; const cy = c.h/2;
          const dist = Math.hypot((ox - cx), (oy - cy));
          const maxd = Math.hypot(cx, cy);
          const edgeFactor = 1 - Math.min(1, dist / (maxd * (0.9 + pseudoRandom(c.phase*3.3)*0.2)));
          // increase base alpha so clouds are less transparent and reduce per-block flicker magnitude
          // raised baseAlpha and narrowed flickerFactor so clouds are visibly denser and flicker slower
          const baseAlpha = 0.22 + pseudoRandom(c.phase*5.7) * 0.36; // ~0.22..0.58
          const flickerFactor = 0.9 + pseudoRandom((sampleX+sampleY)*2.1) * 0.3; // tighter, near 0.9..1.2
          const alpha = Math.max(0.08, baseAlpha * edgeFactor * flickerFactor);
          bctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
          bctx.fillRect(gx, gy, block, block);
        }
      }
    }
  }


  // Draw a pixel-art wooden plank with jagged vertical splintered edges
  function drawPlank(cx, cy, w, h){
    const leftX = Math.round(cx - w/2);
    const rightX = Math.round(cx + w/2);
    const topY = Math.round(cy - h/2);
    const bottomY = Math.round(cy + h/2);

    const step = 2; // smaller = finer jaggies
    const leftOffsets = [];
    const rightOffsets = [];
    for(let y=0; y<=h; y+=step){
      const yy = y + topY;
      const n1 = pseudoRandom(yy * 0.321 + 1.234);
      const n2 = pseudoRandom(yy * 0.618 + 4.321);
      // reduce amplitude so edges aren't huge; keep randomness
      const jitterL = Math.floor(( (Math.sin(yy*0.18) + (n1*2-1)) ) * 4);
      const jitterR = Math.floor(( (Math.cos(yy*0.14) + (n2*2-1)) ) * 4);
      leftOffsets.push( Math.max(-6, Math.min(6, jitterL)) );
      rightOffsets.push( Math.max(-6, Math.min(6, jitterR)) );
    }

    bctx.beginPath();
    bctx.moveTo(leftX + leftOffsets[0], topY);
    let idx = 0;
    for(let y=topY; y<=bottomY; y+=step){
      bctx.lineTo(leftX + leftOffsets[idx], y);
      idx++;
    }
    idx = rightOffsets.length - 1;
    for(let y=bottomY; y>=topY; y-=step){
      bctx.lineTo(rightX + rightOffsets[idx], y);
      idx--;
    }
    bctx.closePath();

    // fill base so there are no holes; then overlay banded colors for pixelated shading
    bctx.fillStyle = palette.woodMid;
    bctx.fill();

    // overlay vertical banded shading (pixel-style) safely to avoid gaps
    const bandCount = 8;
    const bandHeight = Math.max(1, Math.ceil((bottomY - topY + 1) / bandCount));
    for(let i=0;i<bandCount;i++){
      const t = i / (bandCount-1 || 1);
      const col = lerpColor(palette.woodLight, palette.woodDark, t);
      const bandY = topY + i * bandHeight;
      const h = Math.min(bandHeight, bottomY - bandY + 1);
      bctx.save();
      // clip to the plank polygon
      bctx.beginPath();
      bctx.moveTo(leftX + leftOffsets[0], topY);
      let ii = 0;
      for(let y=topY; y<=bottomY; y+=step){ bctx.lineTo(leftX + leftOffsets[ii], y); ii++; }
      ii = rightOffsets.length - 1;
      for(let y=bottomY; y>=topY; y-=step){ bctx.lineTo(rightX + rightOffsets[ii], y); ii--; }
      bctx.closePath();
      bctx.clip();
      bctx.fillStyle = col;
      bctx.fillRect(leftX, bandY, w, h);
      bctx.restore();
    }

    // add many subtle, possibly-angled pixel grain lines clipped to the plank polygon
    // prepare a clip region equal to the plank so grain lines never show sky
    bctx.save();
    bctx.beginPath();
    bctx.moveTo(leftX + leftOffsets[0], topY);
    let ci = 0;
    for(let y=topY; y<=bottomY; y+=step){ bctx.lineTo(leftX + leftOffsets[ci], y); ci++; }
    ci = rightOffsets.length - 1;
    for(let y=bottomY; y>=topY; y-=step){ bctx.lineTo(rightX + rightOffsets[ci], y); ci--; }
    bctx.closePath();
    bctx.clip();

    // helper to create rgba string from hex
    function rgbaFromHex(hex, a){ const c = hexToRgb(hex); return `rgba(${c.r},${c.g},${c.b},${a})`; }

    const grainCount = Math.max(60, Math.floor((bottomY-topY) * 1.6)); // higher density
    for(let i=0;i<grainCount;i++){
      const gy = Math.floor(topY + pseudoRandom(i*12.3) * (bottomY-topY));
      const gx = Math.floor(leftX + 1 + pseudoRandom(i*7.1) * (w*0.8));
      const angle = (pseudoRandom(i*2.1) - 0.5) * 1.2; // -0.6..0.6 rad range
      const len = 2 + Math.floor(pseudoRandom(i*3.3) * 8); // 2..10 px
      // choose subtle shade near woodMid
      const darker = pseudoRandom(i*5.5) > 0.55;
      const color = darker ? rgbaFromHex(palette.woodDarker, 0.12) : rgbaFromHex(palette.woodLight, 0.08);
      bctx.fillStyle = color;
      // draw small angled pixel line (one pixel segments)
      for(let k=0;k<len;k++){
        const px = gx + Math.round(Math.cos(angle) * k);
        const py = gy + Math.round(Math.sin(angle) * k);
        if(px >= leftX+1 && px <= rightX-1 && py >= topY && py <= bottomY){
          bctx.fillRect(px, py, 1, 1);
        }
      }
      // occasional tiny dot
      if(pseudoRandom(i*9.9) > 0.88){ const dx = Math.min(rightX-1, gx + Math.floor(pseudoRandom(i*4.4)*6)); bctx.fillRect(dx, gy+1, 1, 1); }
    }

    bctx.restore();

    bctx.strokeStyle = 'rgba(0,0,0,0.06)';
    bctx.lineWidth = 1;
    for(let y = topY + 6; y < bottomY; y += 4){
      const off = Math.floor(Math.sin(y*0.2) * 6);
      bctx.beginPath();
      bctx.moveTo(leftX + off, y);
      bctx.lineTo(rightX + off - 6, y + 1);
      bctx.stroke();
    }

    bctx.strokeStyle = palette.woodDarker;
    bctx.lineWidth = 1;
    bctx.stroke();

    bctx.strokeStyle = 'rgba(255,255,255,0.06)';
    bctx.beginPath();
    bctx.moveTo(leftX + 4, topY + 6);
    bctx.lineTo(rightX - 4, topY + 6);
    bctx.stroke();
  }

  function drawTitleText(cx, cy, title, subtitle){
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';

    bctx.font = '14px monospace';
    bctx.fillStyle = palette.woodDarker;
    bctx.fillText(title, cx + 1, cy + 1);
    bctx.fillStyle = 'rgba(0,0,0,0.28)';
    bctx.fillText(title, cx + 2, cy + 2);
    bctx.fillStyle = 'rgba(255,255,255,0.12)';
    bctx.fillText(title, cx - 1, cy - 1);

    bctx.font = '8px monospace';
    const subY = cy + 18;
    bctx.fillStyle = 'rgba(0,0,0,0.28)';
    bctx.fillText(subtitle, cx + 1, subY + 1);
    bctx.fillStyle = 'rgba(255,255,255,0.12)';
    bctx.fillText(subtitle, cx - 1, subY - 1);
    bctx.fillStyle = palette.woodDarker;
    bctx.fillText(subtitle, cx, subY);
  }

  // Draw a small whiteish prompt near the bottom of the plank: "-press any key to continue-"
  function drawPressPrompt(cx, plankCenterY, plankH){
    const bottomY = Math.round(plankCenterY + plankH/2);
    const padding = 8; // distance from bottom edge of plank
    const y = bottomY - padding;
    const text = '-press any key to continue-';

    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    // small pixel font for the prompt
    bctx.font = '9px monospace';
    // subtle dark shadow for contrast
    bctx.fillStyle = 'rgba(0,0,0,0.28)';
    bctx.fillText(text, cx + 1, y + 1);
    // light, almost-white fill for the main prompt
    bctx.fillStyle = 'rgba(250,250,250,0.94)';
    bctx.fillText(text, cx, y);
  }

  // Draw the final centered message after fade: crisp, pixel-scaled, dark color #BD9589
  // We render the text to a small offscreen canvas at a tiny font size, then scale it up with
  // nearest-neighbor sampling (imageSmoothingEnabled = false) so the letters are blocky and crisp.
  const _pixelTextCache = { key: null, canvas: null };
  const _textMeasureCanvas = document.createElement('canvas');
  const _textMeasureCtx = _textMeasureCanvas.getContext('2d');
  _textMeasureCtx.imageSmoothingEnabled = false;
  // create a pixel-rendered canvas for multiple lines of text. Returns a small canvas
  // containing the lines at baseFontPx height (not scaled). Caller will scale by an integer.
  function makePixelTextCanvasLines(lines, baseFontPx = 6, color = '#6B3F37'){
    const joined = lines.join('|');
    const key = joined + '|' + baseFontPx + '|' + color;
    if(_pixelTextCache.key === key && _pixelTextCache.canvas) return _pixelTextCache.canvas;
    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d');
    tctx.imageSmoothingEnabled = false;
    tctx.font = baseFontPx + 'px monospace';
    tctx.textBaseline = 'top';
    // measure widest line
    let maxW = 0;
    for(const L of lines){ maxW = Math.max(maxW, Math.ceil(tctx.measureText(L).width)); }
    const lineHeight = Math.ceil(baseFontPx * 1.15);
    tmp.width = Math.max(1, maxW);
    tmp.height = Math.max(1, lineHeight * lines.length);
    const tctx2 = tmp.getContext('2d');
    tctx2.imageSmoothingEnabled = false;
    tctx2.font = baseFontPx + 'px monospace';
    tctx2.textBaseline = 'top';
    tctx2.fillStyle = color;
    for(let i=0;i<lines.length;i++){
      const y = i * lineHeight;
      // draw at integer x=0 to avoid subpixel AA
      tctx2.fillText(lines[i], 0, y);
    }
    // quantize the text to hard pixels (remove antialiasing) for a crisp pixel-art look
    const rgb = hexToRgb(color);
    const imageData = tctx2.getImageData(0, 0, tmp.width, tmp.height);
    const data = imageData.data;
    for(let i=0;i<data.length;i+=4){
      const alpha = data[i+3];
      if(alpha > 60){
        data[i] = rgb.r;
        data[i+1] = rgb.g;
        data[i+2] = rgb.b;
        data[i+3] = 255;
      }else{
        data[i+3] = 0;
      }
    }
    tctx2.putImageData(imageData, 0, 0);
    _pixelTextCache.key = key;
    _pixelTextCache.canvas = tmp;
    return tmp;
  }

  function wrapPixelText(text, maxWidth, baseFontPx = 12){
    if(!text || maxWidth <= 0) return [];
    _textMeasureCtx.font = baseFontPx + 'px monospace';
    _textMeasureCtx.textBaseline = 'top';
    const lines = [];
    const paragraphs = text.replace(/\r/g, '').split('\n');
    for(const para of paragraphs){
      if(!para.length){
        lines.push('');
        continue;
      }
      const words = para.split(' ');
      let line = '';
      for(const wordRaw of words){
        const word = wordRaw;
        if(!word.length){
          // consecutive spaces collapse; continue
          continue;
        }
        const candidate = line ? `${line} ${word}` : word;
        if(_textMeasureCtx.measureText(candidate).width <= maxWidth){
          line = candidate;
          continue;
        }
        if(line){
          lines.push(line);
          line = '';
        }
        if(_textMeasureCtx.measureText(word).width <= maxWidth){
          line = word;
          continue;
        }
        let chunk = '';
        for(const ch of word){
          const test = chunk + ch;
          if(_textMeasureCtx.measureText(test).width > maxWidth && chunk){
            lines.push(chunk);
            chunk = ch;
          }else{
            chunk = test;
          }
        }
        line = chunk;
      }
      if(line) lines.push(line);
    }
    return lines;
  }

  function drawFinalMessage(lines, alpha = 1){
    if(!lines || !lines.length || alpha <= 0) return;
    // lines already split for readability
    const baseFont = 12; // higher-resolution pixel source for legibility
    const preferredScale = 1; // keep pixel size small by avoiding enlargement
    const color = '#3E1F19'; // deep contrast against #ECF8F8
    const src = makePixelTextCanvasLines(lines, baseFont, color);
    // compute maximum integer scale that fits within buffer width with margins
    const margin = 16;
    const maxScale = Math.max(1, Math.floor((bw - margin) / src.width));
    const scale = Math.min(preferredScale, maxScale);
    const dw = src.width * scale;
    const dh = src.height * scale;
    const dx = Math.round((bw - dw) / 2);
    const dy = Math.round((bh - dh) / 2);
    bctx.imageSmoothingEnabled = false;
    // subtle drop shadow (offset by 1 pixel) for contrast
    bctx.save();
    bctx.globalAlpha = Math.max(0, Math.min(1, alpha * 0.35));
    bctx.drawImage(src, 0, 0, src.width, src.height, dx + 1, dy + 1, dw, dh);
    bctx.restore();
    bctx.save();
    bctx.globalAlpha = alpha;
    bctx.drawImage(src, 0, 0, src.width, src.height, dx, dy, dw, dh);
    bctx.restore();
  }

  // Draw a persistent bottom-of-screen prompt (light colored) telling player to press space
  function drawBottomScreenPrompt(alpha = 1){
    if(alpha <= 0) return;
    if(postState !== POST_STATE.idle) return;
    const text = 'press space to continue';
    const y = bh - 8;
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.font = '9px monospace';
    bctx.save();
    bctx.globalAlpha = alpha * 0.6;
    bctx.fillStyle = 'rgba(0,0,0,1)';
    bctx.fillText(text, Math.round(bw/2) + 1, y + 1);
    bctx.restore();
    bctx.save();
    bctx.globalAlpha = alpha;
    bctx.fillStyle = 'rgba(250,250,250,0.94)';
    bctx.fillText(text, Math.round(bw/2), y);
    bctx.restore();
  }

  function resetAudioTracks(skipNames){
    const skip = Array.isArray(skipNames) && skipNames.length ? new Set(skipNames) : null;
    for(const track of audioTracks){
      if(skip && skip.has(track.name)) continue;
      try{ track.element.pause(); }catch(_err){}
      try{ track.element.currentTime = 0; }catch(_err){}
      track.element.volume = 0;
      track.element.loop = !!track.loop;
      track.currentTargetVolume = track.baseTargetVolume;
      track.currentFadeDuration = track.baseFadeDuration;
      track.started = false;
      track.playPending = false;
      track.playAttempted = false;
      track.retryDelay = 0;
      track.lastError = null;
    }
  }

  function getTrackByName(name){
    return audioTracks.find(track => track.name === name) || null;
  }

  function setTrackTarget(name, volume, durationOverride){
    const track = getTrackByName(name);
    if(!track) return null;
    track.currentTargetVolume = Math.max(0, Math.min(1, volume));
    if(typeof durationOverride === 'number' && durationOverride >= 0){
      track.currentFadeDuration = Math.max(0.0001, durationOverride);
    }else{
      track.currentFadeDuration = track.baseFadeDuration;
    }
    if(!track.started && track.currentTargetVolume > 0){
      if(track.retrigger){
        try{ track.element.currentTime = 0; }catch(_err){}
      }
      tryPlayTrack(track);
    }
    return track;
  }

  function tryPlayTrack(track){
    track.playAttempted = true;
    if(track.retrigger){
      try{ track.element.currentTime = 0; }catch(_err){}
    }
    try{
      const result = track.element.play();
      if(result && typeof result.then === 'function'){
        result.then(()=>{
          track.started = true;
          track.playPending = false;
        }).catch(err => {
          track.playPending = true;
          track.retryDelay = 0.75;
          track.lastError = err;
        });
      }else{
        track.started = true;
        track.playPending = false;
      }
    }catch(err){
      track.playPending = true;
      track.retryDelay = 0.75;
      track.lastError = err;
    }
  }

  function primeAudioPlayback(){
    resetAudioTracks();
    for(const track of audioTracks){
      if(track.autoStart === false) continue;
      tryPlayTrack(track);
    }
  }

  function softenAmbientAudio(){
    if(ambienceSoftened) return;
    ambienceSoftened = true;
    setTrackTarget('waves', 0.24, 2.8);
    setTrackTarget('seagulls', 0.14, 2.8);
  }

  function fadeOutAmbientAudio(){
    setTrackTarget('waves', 0, 4.2);
    setTrackTarget('seagulls', 0, 4.2);
  }

  function triggerHuhCue(){
    if(huhTriggered) return;
    const track = setTrackTarget('huh', 0.9, 0.08);
    if(track){
      huhTriggered = true;
      huhTimer = HUH_DURATION;
      huhPlaying = true;
    }
  }

  function triggerPingCue(){
    if(pingTriggered) return;
    const track = setTrackTarget('ping', 0.85, 0.05);
    if(track){
      dialogueManager.setSequence(INITIAL_PING_DIALOGUES);
      pingTriggered = true;
      pingBoxProgress = 0;
      pingDelayTimer = 0;
      pingPending = false;
      namePromptCompleted = false;
      namePromptState = 'hidden';
      namePromptProgress = 0;
      namePromptLayout = null;
      nameInput = '';
      namePromptCaretTimer = 0;
      playerName = '';
      postGreetingPending = false;
      questPromptState = 'hidden';
      questPromptProgress = 0;
      questPromptLayout = null;
      questPromptPending = false;
      questPromptReady = false;
      questAccepted = false;
      finalFadeActive = false;
      finalFadeProgress = 0;
      inventoryButtonEnabled = false;
      inventoryButtonPending = false;
      inventoryVisible = false;
      questsVisible = false;
      questsPanelLayout = null;
      questButtonRect = null;
      currencyDisplayRect = null;
      dismissAdventureDialogue();
      dialogueContext = 'intro';
      dialoguePortraitKey = 'ping';
      inventoryPanelLayout = null;
      resetInventoryContents();
      resetBeachCollectibles();
      cancelAutoMove();
    }
  }

  function startNamePrompt(){
    if(namePromptCompleted) return;
    if(namePromptState !== 'hidden') return;
    namePromptState = 'opening';
    namePromptProgress = 0;
    namePromptCaretTimer = 0;
    namePromptLayout = null;
    nameInput = '';
  }

  function closeNamePrompt(){
    if(namePromptState === 'closing' || namePromptState === 'hidden') return;
    namePromptState = 'closing';
  }

  function updateNamePrompt(dt){
    if(namePromptState === 'hidden') return;
    if(namePromptState !== 'closing'){
      namePromptCaretTimer += dt;
      if(namePromptCaretTimer >= 1.0) namePromptCaretTimer -= 1.0;
    }
    if(namePromptState === 'opening'){
      namePromptProgress = Math.min(1, namePromptProgress + dt / NAME_PROMPT_FADE_DURATION);
      if(namePromptProgress >= 1){
        namePromptProgress = 1;
        namePromptState = 'visible';
      }
    }else if(namePromptState === 'closing'){
      namePromptProgress = Math.max(0, namePromptProgress - dt / NAME_PROMPT_FADE_DURATION);
      if(namePromptProgress <= 0){
        namePromptProgress = 0;
        namePromptState = 'hidden';
        namePromptLayout = null;
      }
    }
  }

  function handleNamePromptKey(e){
    if(namePromptState !== 'visible') return false;
    const key = e.key;
    if(key === 'Backspace'){
      if(nameInput.length > 0){
        nameInput = nameInput.slice(0, -1);
        playTypeSound();
      }
      namePromptCaretTimer = 0;
      e.preventDefault();
      return true;
    }
    if(key === 'Enter'){
      namePromptCaretTimer = 0;
      e.preventDefault();
      submitNameInput();
      return true;
    }
    if(key === 'Escape'){
      namePromptCaretTimer = 0;
      e.preventDefault();
      return true;
    }
    if(key.length === 1){
      if(nameInput.length >= NAME_INPUT_MAX_LENGTH){
        e.preventDefault();
        return true;
      }
      if(/[A-Za-z0-9'\- ]/.test(key)){
        nameInput += key;
        playTypeSound();
        namePromptCaretTimer = 0;
        e.preventDefault();
        return true;
      }
      return true;
    }
    if(key === 'Tab'){
      namePromptCaretTimer = 0;
      e.preventDefault();
      return true;
    }
    return false;
  }

  function handleJournalPointer(x, y){
    if(!journalPanelLayout) return true;
    const {panel, textArea, prevButton, nextButton} = journalPanelLayout;
    if(prevButton && x >= prevButton.x && x <= prevButton.x + prevButton.width && y >= prevButton.y && y <= prevButton.y + prevButton.height){
      changeJournalPage(-1);
      return true;
    }
    if(nextButton && x >= nextButton.x && x <= nextButton.x + nextButton.width && y >= nextButton.y && y <= nextButton.y + nextButton.height){
      changeJournalPage(1);
      return true;
    }
    if(textArea && x >= textArea.x && x <= textArea.x + textArea.width && y >= textArea.y && y <= textArea.y + textArea.height){
      journalEditing = true;
      ensureJournalPageInitialized(journalCurrentPage);
      return true;
    }
    if(panel && x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height){
      journalEditing = false;
      return true;
    }
    journalEditing = false;
    return true;
  }

  function handleQuestsPointer(x, y){
    if(!questsVisible || !questsPanelLayout) return false;
    const {panel} = questsPanelLayout;
    if(panel){
      const insidePanel = x >= panel.x && x <= panel.x + panel.width && y >= panel.y && y <= panel.y + panel.height;
      if(!insidePanel){
        closeQuestsPanel();
        return true;
      }
      return true;
    }
    return false;
  }

  function handleJournalKeyDown(e){
    if(inventoryViewMode !== INVENTORY_VIEW.journal) return false;

    if(e.code === 'Escape'){
      if(journalEditing){
        journalEditing = false;
      }else{
        closeJournalView();
      }
      e.preventDefault();
      return true;
    }

    const printable = e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

    if(!journalEditing){
      if(e.code === 'ArrowLeft'){
        if(changeJournalPage(-1)){
          e.preventDefault();
          return true;
        }
      }
      if(e.code === 'ArrowRight'){
        if(changeJournalPage(1)){
          e.preventDefault();
          return true;
        }
      }
      if(!printable){
        return false;
      }
      journalEditing = true;
    }

    ensureJournalPageInitialized(journalCurrentPage);
    const current = journalPages[journalCurrentPage] || '';

    if(e.key === 'Backspace' || e.key === 'Delete'){
      if(current.length > 0){
        journalPages[journalCurrentPage] = current.slice(0, -1);
      }
      e.preventDefault();
      return true;
    }

    if(e.key === 'Enter'){
      if(current.length < JOURNAL_MAX_CHARS){
        journalPages[journalCurrentPage] = (current + '\n').slice(0, JOURNAL_MAX_CHARS);
      }
      e.preventDefault();
      return true;
    }

    if(e.key === 'Tab'){
      if(current.length < JOURNAL_MAX_CHARS - 1){
        journalPages[journalCurrentPage] = (current + '  ').slice(0, JOURNAL_MAX_CHARS);
      }
      e.preventDefault();
      return true;
    }

    if(printable){
      if(current.length < JOURNAL_MAX_CHARS){
        journalPages[journalCurrentPage] = (current + e.key).slice(0, JOURNAL_MAX_CHARS);
      }
      e.preventDefault();
      return true;
    }

    return false;
  }

  function handleNamePromptClick(e){
    if(namePromptState !== 'visible') return false;
    if(!namePromptLayout) return false;
    const rect = canvas.getBoundingClientRect();
    if(rect.width === 0 || rect.height === 0) return false;
    const scaleX = bw / rect.width;
    const scaleY = bh / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const {button, box} = namePromptLayout;
    if(button && x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height){
      e.preventDefault();
      namePromptCaretTimer = 0;
      submitNameInput();
      return true;
    }
    if(box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height){
      e.preventDefault();
      namePromptCaretTimer = 0;
      return true;
    }
    return false;
  }

  function submitNameInput(){
    const trimmed = nameInput.trim();
    if(!trimmed) return;
    playerName = trimmed;
    namePromptCompleted = true;
    closeNamePrompt();
    const greeting = `Hi, ${playerName}!`;
    const sequence = INITIAL_PING_DIALOGUES.slice();
    sequence.push(greeting);
    dialogueManager.setSequence(sequence, {startIndex: sequence.length - 1, startTyping: true});
    postGreetingPending = true;
    questPromptReady = false;
  }

  function startQuestPrompt(){
    if(questPromptState !== 'hidden') return;
    questPromptPending = false;
    questPromptReady = false;
    questPromptState = 'opening';
    questPromptProgress = 0;
    questPromptLayout = null;
  }

  function closeQuestPrompt(){
    if(questPromptState === 'hidden' || questPromptState === 'closing') return;
    questPromptState = 'closing';
  }

  function updateQuestPrompt(dt){
    if(questPromptState === 'hidden') return;
    if(questPromptState === 'opening'){
      questPromptProgress = Math.min(1, questPromptProgress + dt / QUEST_PROMPT_FADE_DURATION);
      if(questPromptProgress >= 1){
        questPromptProgress = 1;
        questPromptState = 'visible';
      }
    }else if(questPromptState === 'closing'){
      questPromptProgress = Math.max(0, questPromptProgress - dt / QUEST_PROMPT_FADE_DURATION);
      if(questPromptProgress <= 0){
        questPromptProgress = 0;
        questPromptState = 'hidden';
        questPromptLayout = null;
      }
    }
  }

  function handleQuestPromptKey(e){
    if(questPromptState !== 'visible') return false;
    const key = e.key;
    if(key === 'Enter' || key === ' '){
      e.preventDefault();
      acceptQuest();
      return true;
    }
    if(key === 'Escape'){
      e.preventDefault();
      return true;
    }
    e.preventDefault();
    return true;
  }

  function handleQuestPromptClick(e){
    if(questPromptState !== 'visible') return false;
    if(!questPromptLayout) return false;
    const rect = canvas.getBoundingClientRect();
    if(rect.width === 0 || rect.height === 0) return false;
    const scaleX = bw / rect.width;
    const scaleY = bh / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const {button, box} = questPromptLayout;
    if(button && x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height){
      e.preventDefault();
      acceptQuest();
      return true;
    }
    if(box && x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height){
      e.preventDefault();
      return true;
    }
    return false;
  }

  function acceptQuest(){
    if(questAccepted) return;
    questAccepted = true;
    questPromptPending = false;
    closeQuestPrompt();
    finalFadeActive = true;
    finalFadeProgress = 0;
    adventureScenePending = true;
    fadeOutAmbientAudio();
    setTrackTarget(TITLE_MUSIC_TRACK, 0, TITLE_MUSIC_FADE_OUT);
    inventoryButtonEnabled = false;
    inventoryButtonPending = true;
    inventoryVisible = false;
    closeQuestsPanel();
    inventoryPanelLayout = null;
  }

  function handleAdventureKeyDown(e){
    if(finalFadeActive){
      e.preventDefault();
      return true;
    }
    if(isAdventureDialogueActive()){
      const code = e.code;
      if(code === 'Escape'){
        cancelActiveDialogue();
        e.preventDefault();
        return true;
      }
      if(code === 'Space' || code === 'Enter'){
        advanceActiveDialogue();
        e.preventDefault();
        return true;
      }
      if(code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowLeft' || code === 'KeyA' || code === 'ArrowRight' || code === 'KeyD'){
        e.preventDefault();
        return true;
      }
    }
    if(inventoryVisible){
      if(e.code === 'Escape'){ closeInventory(); }
      e.preventDefault();
      return true;
    }
    let handled = false;
    switch(e.code){
      case 'ArrowUp':
      case 'KeyW':
        cancelAutoMove();
        mcInputState.up = true;
        handled = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        cancelAutoMove();
        mcInputState.down = true;
        handled = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        cancelAutoMove();
        mcInputState.left = true;
        handled = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        cancelAutoMove();
        mcInputState.right = true;
        handled = true;
        break;
      default:
        break;
    }
    if(handled){
      e.preventDefault();
      return true;
    }
    return false;
  }

  function handleAdventureKeyUp(e){
    if(finalFadeActive){
      e.preventDefault();
      return;
    }
    if(isAdventureDialogueActive()){
      e.preventDefault();
      return;
    }
    if(inventoryVisible){
      e.preventDefault();
      return;
    }
    switch(e.code){
      case 'ArrowUp':
      case 'KeyW':
        mcInputState.up = false;
        e.preventDefault();
        break;
      case 'ArrowDown':
      case 'KeyS':
        mcInputState.down = false;
        e.preventDefault();
        break;
      case 'ArrowLeft':
      case 'KeyA':
        mcInputState.left = false;
        e.preventDefault();
        break;
      case 'ArrowRight':
      case 'KeyD':
        mcInputState.right = false;
        e.preventDefault();
        break;
      default:
        break;
    }
  }

  function beginAdventureScene(){
    currentScene = SCENE.adventure;
    adventureScenePending = false;
    adventureFadeActive = true;
    adventureFade = 1;
    finalFadeActive = false;
    finalFadeProgress = 0;
    fadeActive = false;
    questPromptState = 'hidden';
    questPromptProgress = 0;
    questPromptLayout = null;
    mcPosition = {x: bw / 2, y: Math.round(bh * 0.78)};
    mcDirection = MC_DIRECTIONS.down;
    mcFrameIndex = 1;
    mcFrameTimer = 0;
    mcMoving = false;
    mcInputState.up = mcInputState.down = mcInputState.left = mcInputState.right = false;
    cancelAutoMove();
    waveShapePhase = 0;
    waveTidePhase = 0;
    waveVerticalOffset = 0;
    waveSurfaceY = Math.round(WAVE_BASELINE + WAVE_EDGE_AMPLITUDE * 1.4);
    waveCollisionY = waveSurfaceY + WAVE_COLLISION_PADDING;
    waveForeshoreY = Math.max(0, Math.round(WAVE_BASELINE - WAVE_EDGE_AMPLITUDE * 0.6));
    const initialCamera = Math.max(0, Math.min(CAMERA_MAX_OFFSET, mcPosition.x - bw / 2));
    cameraTargetX = initialCamera;
    cameraX = initialCamera;
    resetWiseWalker();
    resetKgWalker();
    wiseEncounterComplete = false;
    dismissAdventureDialogue();
    dialogueContext = 'none';
    dialoguePortraitKey = 'ping';
    inventoryVisible = false;
    questsVisible = false;
    questsPanelLayout = null;
    questButtonRect = null;
    currencyDisplayRect = null;
    inventoryPanelLayout = null;
    const inventoryShouldReturn = inventoryButtonPending || inventoryButtonEnabled;
    inventoryButtonEnabled = false;
    inventoryButtonPending = inventoryShouldReturn;
    pickupMessage = null;
    pickupMessageCanvas = null;
    pickupMessageShadowCanvas = null;
    pickupMessageElapsed = 0;
    resetInventoryContents();
    resetBeachCollectibles();
    setTrackTarget(ADVENTURE_MUSIC_TRACK, ADVENTURE_MUSIC_TARGET_VOLUME, ADVENTURE_MUSIC_FADE_IN);
  }

  function updateAudio(dt){
    for(const track of audioTracks){
      if(track.playPending){
        track.retryDelay -= dt;
        if(track.retryDelay <= 0){
          track.retryDelay = 0.75;
          tryPlayTrack(track);
        }
      }
      const idleState = (postState === POST_STATE.idle);
      if(idleState && !track.allowIdlePlayback){
        if(track.element.volume > 0){
          const next = Math.max(0, track.element.volume - dt * 0.4);
          track.element.volume = next;
        }
        continue;
      }
      if(!track.started){
        if(track.autoStart !== false && track.currentTargetVolume > 0){
          tryPlayTrack(track);
        }
        continue;
      }
      const target = Math.max(0, Math.min(1, track.currentTargetVolume));
      const current = Math.max(0, Math.min(1, track.element.volume));
      if(Math.abs(target - current) < 0.0005){
        track.element.volume = target;
        continue;
      }
      const duration = Math.max(0.0001, track.currentFadeDuration);
      const change = ((target - current) / duration) * dt;
      let next = current + change;
      if(target > current && next > target) next = target;
      if(target < current && next < target) next = target;
      track.element.volume = Math.max(0, Math.min(1, next));
    }
  }

  function beginPostSequence(){
    if(postState !== POST_STATE.idle) return;
    postState = POST_STATE.toBlack;
    blackFade = 0;
    blackHoldTimer = 0;
    eyeCrackProgress = 0;
    eyeCloseProgress = 0;
    eyeFinalProgress = 0;
    ambienceSoftened = false;
    huhTriggered = false;
    huhTimer = 0;
    huhPlaying = false;
    ambienceFullFadeQueued = false;
    ambienceFullFadeTimer = 0;
    pingPending = false;
    pingDelayTimer = 0;
    pingTriggered = false;
    pingBoxProgress = 0;
    dialogueManager.setSequence(INITIAL_PING_DIALOGUES);
    namePromptCompleted = false;
    namePromptState = 'hidden';
    namePromptProgress = 0;
    namePromptCaretTimer = 0;
    namePromptLayout = null;
    nameInput = '';
    playerName = '';
    postGreetingPending = false;
    questPromptState = 'hidden';
    questPromptProgress = 0;
    questPromptLayout = null;
    questPromptPending = false;
    questAccepted = false;
    questPromptReady = false;
    finalFadeActive = false;
    finalFadeProgress = 0;
    inventoryButtonEnabled = false;
    inventoryButtonPending = false;
    inventoryVisible = false;
    questsVisible = false;
    questsPanelLayout = null;
    questButtonRect = null;
    currencyDisplayRect = null;
    inventoryPanelLayout = null;
    dismissAdventureDialogue();
    dialogueContext = 'intro';
    dialoguePortraitKey = 'ping';
    cancelAutoMove();
    primeAudioPlayback();
  }

  function updateDialogueBox(dt){
    if(pingTriggered){
      const prior = pingBoxProgress;
      pingBoxProgress = Math.min(1, pingBoxProgress + dt / PING_BOX_FADE_DURATION);
      if(pingBoxProgress >= 1 && prior < 1 && !pingTypingActive && pingCurrentText.length > 0){
        pingTypingActive = true;
        pingTypeProgress = 0;
        pingTypeIndex = 0;
      }
    }else if(pingBoxProgress > 0){
      pingBoxProgress = Math.max(0, pingBoxProgress - dt / PING_BOX_FADE_DURATION);
      if(pingBoxProgress <= 0.001){
        pingBoxProgress = 0;
      }
    }

    if(pingTypingActive){
      const targetLength = pingCurrentText.length;
      pingTypeProgress += dt;
      while(pingTypeProgress >= PING_TYPE_INTERVAL && pingTypeIndex < targetLength){
        pingTypeProgress -= PING_TYPE_INTERVAL;
        pingTypeIndex++;
        playTypeSound();
      }
      if(pingTypeIndex >= targetLength){
        pingTypeIndex = targetLength;
        pingTypingActive = false;
        pingTypeProgress = 0;
      }
    }
  }

  function updatePostSequence(dt){
    updateAudio(dt);
    if(postState === POST_STATE.idle) return;
    switch(postState){
      case POST_STATE.toBlack:
        blackFade = Math.min(1, blackFade + dt / BLACK_FADE_DURATION);
        if(blackFade >= 1){
          postState = POST_STATE.blackHold;
          blackHoldTimer = 0;
        }
        break;
      case POST_STATE.blackHold:
        blackHoldTimer += dt;
        if(blackHoldTimer >= BLACK_HOLD_DURATION){
          postState = POST_STATE.eyeOpening;
        }
        break;
      case POST_STATE.eyeOpening:
        eyeCrackProgress = Math.min(1, eyeCrackProgress + dt / EYE_OPEN_DURATION);
        if(eyeCrackProgress >= 1){
          postState = POST_STATE.eyeClosing;
          eyeCloseProgress = 0;
        }
        break;
      case POST_STATE.eyeClosing:
        eyeCloseProgress = Math.min(1, eyeCloseProgress + dt / EYE_CLOSE_DURATION);
        if(eyeCloseProgress >= 1){
          postState = POST_STATE.eyeFinalOpen;
          eyeFinalProgress = 0;
        }
        break;
      case POST_STATE.eyeFinalOpen:
        eyeFinalProgress = Math.min(1, eyeFinalProgress + dt / EYE_FINAL_DURATION);
        if(eyeFinalProgress >= 1){
          softenAmbientAudio();
          triggerHuhCue();
          postState = POST_STATE.done;
        }
        break;
      case POST_STATE.done:
        eyeFinalProgress = 1;
        softenAmbientAudio();
        break;
    }

    if(huhPlaying){
      huhTimer = Math.max(0, huhTimer - dt);
      if(huhTimer <= 0){
        huhTimer = 0;
        setTrackTarget('huh', 0, 0.4);
        huhPlaying = false;
        ambienceFullFadeQueued = true;
        ambienceFullFadeTimer = 0;
        pingPending = true;
        pingDelayTimer = 0;
      }
    }

    if(ambienceFullFadeQueued){
      ambienceFullFadeTimer += dt;
      if(ambienceFullFadeTimer >= AMBIENT_FADE_POST_HUH_DELAY){
        ambienceFullFadeQueued = false;
        fadeOutAmbientAudio();
      }
    }

    if(pingPending){
      pingDelayTimer += dt;
      if(pingDelayTimer >= PING_DELAY_AFTER_HUH){
        pingPending = false;
        triggerPingCue();
      }
    }

    updateDialogueBox(dt);

    if(!pingTypingActive && pingTriggered && pingDialogueIndex === 1 && !namePromptCompleted && namePromptState === 'hidden'){
      startNamePrompt();
    }

    updateNamePrompt(dt);
    if(!pingTypingActive && questPromptPending && questPromptState === 'hidden'){
      const atEnd = pingDialogues.length > 0 && pingDialogueIndex >= pingDialogues.length - 1;
      if(atEnd) questPromptReady = true;
    }
    updateQuestPrompt(dt);
  }

  function updateAdventure(dt){
    updateAudio(dt);
    waveShapePhase += dt * WAVE_SCROLL_SPEED;
    waveTidePhase += dt * WAVE_TIDE_SPEED;
    waveVerticalOffset = Math.sin(waveTidePhase) * WAVE_TIDE_AMPLITUDE;
    const baseSurface = WAVE_BASELINE + waveVerticalOffset;
    waveSurfaceY = Math.round(Math.max(0, Math.min(bh - 4, baseSurface + WAVE_EDGE_AMPLITUDE * 1.4)));
    waveForeshoreY = Math.round(Math.max(0, Math.min(bh - 4, baseSurface - WAVE_EDGE_AMPLITUDE * 0.6)));
    waveCollisionY = Math.min(bh - 1, waveSurfaceY + WAVE_COLLISION_PADDING);
    if(adventureFadeActive){
      adventureFade = Math.max(0, adventureFade - dt / ADVENTURE_FADE_DURATION);
      if(adventureFade <= 0.001){
        adventureFade = 0;
        adventureFadeActive = false;
      }
    }
    if(!adventureFadeActive && adventureFade <= 0.001 && inventoryButtonPending){
      inventoryButtonEnabled = true;
      inventoryButtonPending = false;
    }

    const wasMoving = mcMoving;
    let vx = 0;
    let vy = 0;
    const manualX = (mcInputState.right ? 1 : 0) - (mcInputState.left ? 1 : 0);
    const manualY = (mcInputState.down ? 1 : 0) - (mcInputState.up ? 1 : 0);
    const manualActive = manualX !== 0 || manualY !== 0;

    if(manualActive){
      const mag = Math.hypot(manualX, manualY) || 1;
      vx = manualX / mag;
      vy = manualY / mag;
      cancelAutoMove();
    }else if(mcAutoMoveTarget){
      const dx = mcAutoMoveTarget.x - mcPosition.x;
      const dy = mcAutoMoveTarget.y - mcPosition.y;
      const dist = Math.hypot(dx, dy);
      if(dist > 0){
        const moveStep = MC_MOVE_SPEED * dt;
        if(dist > Math.max(moveStep, AUTO_MOVE_STOP_DISTANCE)){
          vx = dx / dist;
          vy = dy / dist;
        }else{
          mcPosition.x = mcAutoMoveTarget.x;
          mcPosition.y = mcAutoMoveTarget.y;
          if(mcAutoMoveCollectTarget && !mcAutoMoveCollectTarget.collected && withinPickupRange(mcAutoMoveCollectTarget)){
            collectBeachDecor(mcAutoMoveCollectTarget);
          }
          cancelAutoMove();
        }
      }else{
        if(mcAutoMoveCollectTarget && !mcAutoMoveCollectTarget.collected && withinPickupRange(mcAutoMoveCollectTarget)){
          collectBeachDecor(mcAutoMoveCollectTarget);
        }
        cancelAutoMove();
      }
    }

    if(vx !== 0 || vy !== 0){
      mcPosition.x += vx * MC_MOVE_SPEED * dt;
      mcPosition.y += vy * MC_MOVE_SPEED * dt;

      const absX = Math.abs(vx);
      const absY = Math.abs(vy);
      if(absX > absY){
        mcDirection = vx > 0 ? MC_DIRECTIONS.right : MC_DIRECTIONS.left;
      }else if(absY >= absX){
        mcDirection = vy > 0 ? MC_DIRECTIONS.down : MC_DIRECTIONS.up;
      }

      mcMoving = true;
      if(!wasMoving){
        mcFrameIndex = 0;
        mcFrameTimer = 0;
      }
      mcFrameTimer += dt;
      if(mcFrameTimer >= MC_FRAME_DURATION){
        mcFrameTimer -= MC_FRAME_DURATION;
        mcFrameIndex = (mcFrameIndex + 1) % MC_FRAME_COUNT;
      }
    }else{
      mcMoving = false;
      mcFrameIndex = 1;
      mcFrameTimer = 0;
    }

    const frames = MC_FRAME_RECTS[mcDirection] || MC_FRAME_RECTS[MC_DIRECTIONS.down];
    const frameForBounds = frames[(mcFrameIndex + MC_FRAME_COUNT) % MC_FRAME_COUNT];
    const scaledWidth = Math.max(1, frameForBounds.sw * MC_RENDER_SCALE);
    const scaledHeight = Math.max(1, frameForBounds.sh * MC_RENDER_SCALE);
    const halfWidth = Math.max(6, scaledWidth / 2);
    const minX = halfWidth + MC_WALK_PADDING.x;
    const maxX = ADVENTURE_WORLD_WIDTH - (halfWidth + MC_WALK_PADDING.x);
    const minY = Math.max(scaledHeight + MC_WALK_PADDING.top, waveCollisionY);
    const maxY = bh - MC_WALK_PADDING.bottom;
    mcPosition.x = Math.max(minX, Math.min(maxX, mcPosition.x));
    mcPosition.y = Math.max(minY, Math.min(maxY, mcPosition.y));
    if(mcAutoMoveTarget){
      mcAutoMoveTarget.x = Math.max(minX, Math.min(maxX, mcAutoMoveTarget.x));
      mcAutoMoveTarget.y = Math.max(minY, Math.min(maxY, mcAutoMoveTarget.y));
    }

    if(mcAutoMoveCollectTarget){
      if(mcAutoMoveCollectTarget.collected){
        mcAutoMoveCollectTarget = null;
      }else if(withinPickupRange(mcAutoMoveCollectTarget)){
        if(collectBeachDecor(mcAutoMoveCollectTarget)){
          cancelAutoMove();
        }
      }
    }

    updateWiseWalker(dt);
    updateKgWalker(dt);

    const viewportStart = cameraX;
    const viewportEnd = cameraX + bw;
    let desiredCamera = cameraTargetX;
    if(mcPosition.x < viewportStart + CAMERA_EDGE_MARGIN){
      desiredCamera = Math.max(0, mcPosition.x - CAMERA_EDGE_MARGIN);
    }else if(mcPosition.x > viewportEnd - CAMERA_EDGE_MARGIN){
      desiredCamera = Math.min(CAMERA_MAX_OFFSET, mcPosition.x + CAMERA_EDGE_MARGIN - bw);
    }
    desiredCamera = Math.max(0, Math.min(CAMERA_MAX_OFFSET, desiredCamera));
    cameraTargetX = desiredCamera;
    const cameraLerp = Math.min(1, dt * CAMERA_FOLLOW_LERP);
    cameraX += (cameraTargetX - cameraX) * cameraLerp;
    if(cameraX < 0.0001) cameraX = 0;
    if(cameraX > CAMERA_MAX_OFFSET - 0.0001) cameraX = CAMERA_MAX_OFFSET;

    updateDialogueBox(dt);

    if(pickupMessage){
      pickupMessageElapsed += dt;
      if(pickupMessageElapsed >= PICKUP_MESSAGE_DURATION){
        pickupMessage = null;
        pickupMessageCanvas = null;
        pickupMessageShadowCanvas = null;
        pickupMessageElapsed = 0;
      }
    }

    if(finalFadeActive && finalFadeProgress < 1){
      finalFadeProgress = Math.min(1, finalFadeProgress + dt / FINAL_FADE_DURATION);
    }else if(!finalFadeActive && finalFadeProgress > 0){
      finalFadeProgress = Math.max(0, finalFadeProgress - dt / FINAL_FADE_DURATION);
    }
  }

  function drawPostSequenceOverlay(){
    if(postState === POST_STATE.idle) return;
    if(postState === POST_STATE.toBlack){
      if(blackFade <= 0) return;
      bctx.save();
      bctx.globalAlpha = Math.max(0, Math.min(1, blackFade));
      bctx.fillStyle = '#000';
      bctx.fillRect(0,0,bw,bh);
      bctx.restore();
      return;
    }

    if(postState === POST_STATE.done){
      bctx.fillStyle = '#ffffff';
      bctx.fillRect(0,0,bw,bh);
      if(pingTriggered || pingBoxProgress > 0){
        drawPingBox(pingBoxProgress);
      }
      return;
    }

    // default backdrop for post sequence moments is pure black
    bctx.fillStyle = '#000';
    bctx.fillRect(0,0,bw,bh);

    switch(postState){
      case POST_STATE.blackHold:
        // nothing to render yet, just hold on darkness
        break;
      case POST_STATE.eyeOpening:
        drawEyeCrack(eyeCrackProgress);
        break;
      case POST_STATE.eyeClosing:
        drawEyeCrack(Math.max(0, 1 - eyeCloseProgress));
        break;
      case POST_STATE.eyeFinalOpen:
        // reopen the eye and bloom to full white
        drawEyeCrack(eyeFinalProgress);
        {
          const bloom = easeInOutQuad(Math.max(0, Math.min(1, eyeFinalProgress)));
          if(bloom > 0){
            bctx.save();
            bctx.globalAlpha = Math.pow(bloom, 1.6);
            bctx.fillStyle = '#ffffff';
            bctx.fillRect(0,0,bw,bh);
            bctx.restore();
          }
        }
        break;
      default:
        drawEyeCrack(eyeCrackProgress);
        break;
    }
  }

  function drawEyeCrack(progress){
    if(progress <= 0) return;
    const eased = easeInOutQuad(Math.max(0, Math.min(1, progress)));
    const centerY = bh / 2;
    const maxHalfHeight = bh * 0.35;
    const baseHalf = Math.max(0.5, eased * maxHalfHeight);
    const denom = Math.max(1, bw - 1);
    for(let x=0; x<bw; x++){
      const nx = (x / denom) * 2 - 1;
      const envelope = Math.pow(Math.max(0, 1 - nx*nx), 0.6);
      const half = Math.round(baseHalf * envelope);
      if(half <= 0) continue;
      const top = Math.max(0, Math.round(centerY - half));
      const height = Math.min(bh - top, half * 2);
      bctx.fillStyle = '#fefcf6';
      bctx.fillRect(x, top, 1, height);
      if(height > 3){
        const brightHeight = Math.max(1, Math.floor(height * 0.3));
        const brightTop = Math.max(top, Math.round(centerY - brightHeight/2));
        bctx.fillStyle = '#ffffff';
        bctx.fillRect(x, brightTop, 1, brightHeight);
      }
    }
  }

  function drawPingBox(progress){
    if(progress <= 0) return;
    const eased = easeInOutQuad(Math.max(0, Math.min(1, progress)));
    const targetHeight = Math.max(8, Math.round(bh * 0.26));
    const targetWidth = Math.max(16, Math.round(bw * 0.84));
    const targetTop = Math.round(bh * (2/3));
    const bottomMargin = Math.round(bh * 0.04);
    const bottomY = Math.min(bh - bottomMargin, targetTop + targetHeight);
    const currentHeight = Math.max(2, Math.round(targetHeight * eased));
    const x = Math.round((bw - targetWidth) / 2);
    const y = bottomY - currentHeight;
    const fill = '#d7b48d';
    const border = '#a97b62';
    bctx.save();
    bctx.globalAlpha = Math.min(1, eased);
    bctx.fillStyle = fill;
    bctx.fillRect(x, y, targetWidth, currentHeight);
    bctx.fillStyle = border;
    bctx.fillRect(x, y, targetWidth, 1);
    bctx.fillRect(x, y + currentHeight - 1, targetWidth, 1);
    bctx.fillRect(x, y, 1, currentHeight);
    bctx.fillRect(x + targetWidth - 1, y, 1, currentHeight);
    bctx.restore();

    const padding = 6;
    const innerWidth = targetWidth - padding * 2;
    const innerHeight = currentHeight - padding * 2;
    if(innerWidth <= 4 || innerHeight <= 4) return;

    const promptInfluence = (namePromptState === 'hidden') ? 0 : easeInOutQuad(Math.max(0, Math.min(1, namePromptProgress)));
    const dimFactor = promptInfluence > 0 ? (0.35 + 0.65 * (1 - promptInfluence)) : 1;
    const contentAlpha = Math.min(1, eased) * dimFactor;
    const gap = 6;
    const portraitInfo = getActiveDialoguePortrait();
    const portraitSource = portraitInfo.source || PING_PORTRAIT_SOURCE;
    const sourceAspect = portraitSource.height / Math.max(1, portraitSource.width);
    const maxPortraitWidth = Math.max(12, Math.min(innerWidth * 0.32, innerWidth - gap));
    let portraitWidth = Math.max(8, Math.min(maxPortraitWidth, innerHeight / sourceAspect));
    let portraitHeight = Math.round(portraitWidth * sourceAspect);
    if(portraitHeight > innerHeight){
      portraitHeight = innerHeight;
      portraitWidth = Math.round(portraitHeight / sourceAspect);
    }
    portraitWidth = Math.max(4, portraitWidth);
    portraitHeight = Math.max(4, portraitHeight);
    const portraitX = x + targetWidth - padding - portraitWidth;
    const portraitY = y + padding + Math.max(0, Math.floor((innerHeight - portraitHeight) / 2));
    if(portraitInfo.ready && portraitInfo.image && portraitWidth > 0 && portraitHeight > 0 && contentAlpha > 0){
      dialoguePortraitDraw = {
        image: portraitInfo.image,
        source: portraitSource,
        x: portraitX,
        y: portraitY,
        width: portraitWidth,
        height: portraitHeight,
        alpha: Math.min(1, contentAlpha)
      };
    }else{
      dialoguePortraitDraw = null;
    }

    const textMaxWidth = portraitX - (x + padding) - gap;
    if(textMaxWidth <= 0) return;
    const visibleChars = pingCurrentText.slice(0, Math.min(pingTypeIndex, pingCurrentText.length));
    if(!visibleChars) return;
    const baseFont = 12;
    const lines = wrapPixelText(visibleChars, textMaxWidth, baseFont);
    if(!lines.length) return;
    const textCanvas = makePixelTextCanvasLines(lines, baseFont, '#3E1F19');
    const textX = x + padding;
    let textY = y + padding;
    const maxTextHeight = y + currentHeight - padding - textY;
    if(textCanvas.height > maxTextHeight){
      textY = (y + currentHeight - padding) - textCanvas.height;
    }
    textY = Math.max(y + padding, textY);
    bctx.imageSmoothingEnabled = false;
    bctx.save();
    bctx.globalAlpha = contentAlpha * 0.4;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX + 1, textY + 1, textCanvas.width, textCanvas.height);
    bctx.restore();
    bctx.save();
    bctx.globalAlpha = contentAlpha;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX, textY, textCanvas.width, textCanvas.height);
    bctx.restore();

    if(shouldShowIntroSpaceHint()){
      drawIntroSpaceHint(contentAlpha);
    }
  }

  function drawDialogueOverlay(){
    if(!isDialogueBoxVisible()) return;
    drawPingBox(pingBoxProgress);
  }

  function shouldShowIntroSpaceHint(){
    if(dialogueContext !== 'intro') return false;
    if(pingDialogues.length === 0) return false;
    if(pingDialogueIndex !== 0) return false;
    const expectedLine = INITIAL_PING_DIALOGUES[0];
    const currentLine = pingDialogues[pingDialogueIndex] || '';
    if(!expectedLine || currentLine !== expectedLine) return false;
    if(!isDialogueBoxVisible()) return false;
    return true;
  }

  function drawIntroSpaceHint(alpha){
    if(alpha <= 0) return;
    const textCanvas = makePixelTextCanvasLines([INTRO_SPACE_HINT_TEXT], 11, '#fbeedb');
    const shadowCanvas = makePixelTextCanvasLines([INTRO_SPACE_HINT_TEXT], 11, '#000000');
    const margin = Math.max(6, Math.round(bh * 0.02));
    const x = Math.round((bw - textCanvas.width) / 2);
    const y = Math.max(0, Math.round(bh - margin - textCanvas.height));
    const clampedAlpha = Math.max(0, Math.min(1, alpha));
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.globalAlpha = clampedAlpha * 0.45;
    bctx.drawImage(shadowCanvas, 0, 0, shadowCanvas.width, shadowCanvas.height, x + 1, y + 1, shadowCanvas.width, shadowCanvas.height);
    bctx.globalAlpha = clampedAlpha;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, x, y, textCanvas.width, textCanvas.height);
    bctx.restore();
  }

  function drawNamePromptOverlay(){
    if(namePromptState === 'hidden' && namePromptProgress <= 0){
      namePromptLayout = null;
      return;
    }
    const clamped = Math.max(0, Math.min(1, namePromptProgress));
    const eased = easeInOutQuad(clamped);
    if(eased <= 0){
      namePromptLayout = null;
      return;
    }

    const baseWidth = Math.round(bw * 0.62);
    const baseHeight = Math.round(bh * 0.34);
    const currentWidth = Math.max(48, Math.round(baseWidth * (0.4 + 0.6 * eased)));
    const currentHeight = Math.max(36, Math.round(baseHeight * (0.4 + 0.6 * eased)));
    const x = Math.round((bw - currentWidth) / 2);
    const y = Math.round((bh - currentHeight) / 2);
    const alpha = Math.min(1, eased);
    const fill = '#d6d8dd';
    const border = '#6b6d76';

    bctx.save();
    bctx.globalAlpha = alpha;
    bctx.fillStyle = fill;
    bctx.fillRect(x, y, currentWidth, currentHeight);
    bctx.fillStyle = border;
    bctx.fillRect(x, y, currentWidth, 1);
    bctx.fillRect(x, y + currentHeight - 1, currentWidth, 1);
    bctx.fillRect(x, y, 1, currentHeight);
    bctx.fillRect(x + currentWidth - 1, y, 1, currentHeight);
    bctx.restore();

    const padding = 8;
    const innerWidth = currentWidth - padding * 2;
    const innerHeight = currentHeight - padding * 2;
    if(innerWidth <= 12 || innerHeight <= 20){
      namePromptLayout = null;
      return;
    }

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    const questionLines = wrapPixelText("What's your name?", innerWidth, 12);
    const questionCanvas = makePixelTextCanvasLines(questionLines.length ? questionLines : [' '], 12, '#3E1F19');
    const questionX = x + padding;
    const questionY = y + padding;
    const contentAlpha = alpha;
    bctx.globalAlpha = contentAlpha * 0.35;
    bctx.drawImage(questionCanvas, 0, 0, questionCanvas.width, questionCanvas.height, questionX + 1, questionY + 1, questionCanvas.width, questionCanvas.height);
    bctx.globalAlpha = contentAlpha;
    bctx.drawImage(questionCanvas, 0, 0, questionCanvas.width, questionCanvas.height, questionX, questionY, questionCanvas.width, questionCanvas.height);
    bctx.restore();

    let inputY = questionY + questionCanvas.height + 6;
    const maxInputBottom = y + currentHeight - padding - 34;
    if(inputY > maxInputBottom) inputY = maxInputBottom;
    const inputHeight = Math.min(22, Math.max(14, (y + currentHeight - padding) - inputY - 18));
    const inputWidth = innerWidth;
    const inputX = x + padding;
    const inputPadding = 3;

    bctx.save();
    bctx.globalAlpha = contentAlpha;
    bctx.fillStyle = '#f4f5f9';
    bctx.fillRect(inputX, inputY, inputWidth, inputHeight);
    bctx.fillStyle = '#9ea1b0';
    bctx.fillRect(inputX, inputY, inputWidth, 1);
    bctx.fillRect(inputX, inputY + inputHeight - 1, inputWidth, 1);
    bctx.fillRect(inputX, inputY, 1, inputHeight);
    bctx.fillRect(inputX + inputWidth - 1, inputY, 1, inputHeight);
    bctx.restore();

    const caretVisible = (namePromptState === 'visible') && (namePromptCaretTimer < 0.5);
    let displayText = nameInput;
    if(caretVisible) displayText += '|';
    if(!displayText.length) displayText = caretVisible ? '|' : ' ';
    const displayCanvas = makePixelTextCanvasLines([displayText], 12, '#3E1F19');
    const textX = inputX + inputPadding;
    const textY = inputY + Math.max(0, Math.round((inputHeight - displayCanvas.height) / 2));
    bctx.save();
    bctx.globalAlpha = contentAlpha;
    bctx.drawImage(displayCanvas, 0, 0, displayCanvas.width, displayCanvas.height, textX, textY, displayCanvas.width, displayCanvas.height);
    bctx.restore();

    const buttonLabelCanvas = makePixelTextCanvasLines(['done'], 12, '#3E1F19');
    const buttonWidth = Math.max(buttonLabelCanvas.width + 12, 58);
    const buttonHeight = buttonLabelCanvas.height + 6;
    const buttonX = x + Math.round((currentWidth - buttonWidth) / 2);
    let buttonY = inputY + inputHeight + 10;
    const maxButtonY = y + currentHeight - padding - buttonHeight;
    if(buttonY > maxButtonY) buttonY = maxButtonY;

    bctx.save();
    bctx.globalAlpha = contentAlpha;
    bctx.fillStyle = '#b8bac9';
    bctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    bctx.fillStyle = '#7b7e8b';
    bctx.fillRect(buttonX, buttonY, buttonWidth, 1);
    bctx.fillRect(buttonX, buttonY + buttonHeight - 1, buttonWidth, 1);
    bctx.fillRect(buttonX, buttonY, 1, buttonHeight);
    bctx.fillRect(buttonX + buttonWidth - 1, buttonY, 1, buttonHeight);
    bctx.drawImage(
      buttonLabelCanvas,
      0,
      0,
      buttonLabelCanvas.width,
      buttonLabelCanvas.height,
      buttonX + Math.round((buttonWidth - buttonLabelCanvas.width) / 2),
      buttonY + Math.round((buttonHeight - buttonLabelCanvas.height) / 2),
      buttonLabelCanvas.width,
      buttonLabelCanvas.height
    );
    bctx.restore();

    namePromptLayout = (namePromptState === 'visible') ? {
      box: {x, y, width: currentWidth, height: currentHeight},
      input: {x: inputX, y: inputY, width: inputWidth, height: inputHeight},
      button: {x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight}
    } : null;
  }

  function drawQuestPromptOverlay(){
    if(questPromptState === 'hidden' && questPromptProgress <= 0){
      questPromptLayout = null;
      return;
    }
    const clamped = Math.max(0, Math.min(1, questPromptProgress));
    if(clamped <= 0){
      questPromptLayout = null;
      return;
    }
    const eased = easeInOutQuad(clamped);

    bctx.save();
    bctx.globalAlpha = eased * 0.5;
    bctx.fillStyle = '#000000';
    bctx.fillRect(0,0,bw,bh);
    bctx.restore();

    const baseWidth = Math.round(bw * 0.42);
    const baseHeight = Math.round(bh * 0.24);
    const currentWidth = Math.max(40, Math.round(baseWidth * (0.55 + 0.45 * eased)));
    const currentHeight = Math.max(32, Math.round(baseHeight * (0.55 + 0.45 * eased)));
    const x = Math.round((bw - currentWidth) / 2);
    const y = Math.round((bh - currentHeight) / 2);
    const alpha = Math.min(1, eased);

    const fill = '#d6d8dd';
    const border = '#6b6d76';
    bctx.save();
    bctx.globalAlpha = alpha;
    bctx.fillStyle = fill;
    bctx.fillRect(x, y, currentWidth, currentHeight);
    bctx.fillStyle = border;
    bctx.fillRect(x, y, currentWidth, 1);
    bctx.fillRect(x, y + currentHeight - 1, currentWidth, 1);
    bctx.fillRect(x, y, 1, currentHeight);
    bctx.fillRect(x + currentWidth - 1, y, 1, currentHeight);
    bctx.restore();

    const padding = 8;
    const innerWidth = currentWidth - padding * 2;
    const textCanvas = makePixelTextCanvasLines([QUEST_PROMPT_TEXT], 12, '#3E1F19');
    const textX = x + Math.round((currentWidth - textCanvas.width) / 2);
    const textY = y + padding;
    bctx.save();
    bctx.globalAlpha = alpha * 0.4;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX + 1, textY + 1, textCanvas.width, textCanvas.height);
    bctx.restore();
    bctx.save();
    bctx.globalAlpha = alpha;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX, textY, textCanvas.width, textCanvas.height);
    bctx.restore();

    const buttonLabelCanvas = makePixelTextCanvasLines([QUEST_PROMPT_BUTTON], 12, '#3E1F19');
    const buttonWidth = Math.max(buttonLabelCanvas.width + 12, 54);
    const buttonHeight = buttonLabelCanvas.height + 6;
    const buttonX = x + Math.round((currentWidth - buttonWidth) / 2);
    const buttonY = y + currentHeight - padding - buttonHeight;

    bctx.save();
    bctx.globalAlpha = alpha;
    bctx.fillStyle = '#b8bac9';
    bctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    bctx.fillStyle = '#7b7e8b';
    bctx.fillRect(buttonX, buttonY, buttonWidth, 1);
    bctx.fillRect(buttonX, buttonY + buttonHeight - 1, buttonWidth, 1);
    bctx.fillRect(buttonX, buttonY, 1, buttonHeight);
    bctx.fillRect(buttonX + buttonWidth - 1, buttonY, 1, buttonHeight);
    bctx.drawImage(
      buttonLabelCanvas,
      0,
      0,
      buttonLabelCanvas.width,
      buttonLabelCanvas.height,
      buttonX + Math.round((buttonWidth - buttonLabelCanvas.width) / 2),
      buttonY + Math.round((buttonHeight - buttonLabelCanvas.height) / 2),
      buttonLabelCanvas.width,
      buttonLabelCanvas.height
    );
    bctx.restore();

    questPromptLayout = (questPromptState === 'visible') ? {
      box: {x, y, width: currentWidth, height: currentHeight},
      button: {x: buttonX, y: buttonY, width: buttonWidth, height: buttonHeight}
    } : null;
  }

  function openInventory(){
    if(!inventoryButtonEnabled) return;
    if(inventoryVisible) return;
    cancelAutoMove();
    inventoryVisible = true;
    inventoryViewMode = INVENTORY_VIEW.inventory;
    journalEditing = false;
    journalPanelLayout = null;
    journalButtonRect = null;
    inventoryHoverSlotIndex = -1;
    mcInputState.up = mcInputState.down = mcInputState.left = mcInputState.right = false;
    mcMoving = false;
  }

  function closeInventory(){
    if(!inventoryVisible) return;
    inventoryVisible = false;
    inventoryViewMode = INVENTORY_VIEW.inventory;
    journalEditing = false;
    journalPanelLayout = null;
    journalButtonRect = null;
    inventoryHoverSlotIndex = -1;
  }

  function toggleInventory(){
    if(!inventoryButtonEnabled && !inventoryVisible) return;
    if(inventoryVisible){
      closeInventory();
    }else{
      openInventory();
    }
  }

  function findInventorySlotForType(type){
    for(let i=0; i<inventoryItems.length; i++){
      const item = inventoryItems[i];
      if(item && item.type === type) return i;
    }
    return -1;
  }

  function findEmptyInventorySlot(){
    for(let i=0; i<inventoryItems.length; i++){
      if(!inventoryItems[i]) return i;
    }
    return -1;
  }

  function resetInventoryContents(){
    for(let i=0; i<inventoryItems.length; i++){
      inventoryItems[i] = null;
    }
  }

  function resetBeachCollectibles(){
    for(const deco of beachDecor){
      if(deco) deco.collected = false;
    }
  }

  function addInventoryItem(type){
    if(!COLLECTIBLE_TYPES.has(type)) return false;
    let slotIndex = findInventorySlotForType(type);
    if(slotIndex === -1){
      slotIndex = findEmptyInventorySlot();
      if(slotIndex === -1) return false;
      inventoryItems[slotIndex] = {
        type,
        count: 0,
        countLabelCanvas: null,
        countLabelValue: null
      };
    }
    const slotItem = inventoryItems[slotIndex];
    slotItem.count += 1;
    slotItem.countLabelCanvas = null; // mark dirty so label regenerates
    slotItem.countLabelValue = null;
    return true;
  }

  function getInventoryItemCountCanvas(item){
    if(!item) return null;
    if(!item.countLabelCanvas || item.countLabelValue !== item.count){
      item.countLabelCanvas = makeInventoryCountGlyphCanvas(String(item.count));
      item.countLabelValue = item.count;
    }
    return item.countLabelCanvas;
  }

  function getInventoryCountByType(type){
    let total = 0;
    for(const item of inventoryItems){
      if(item && item.type === type){
        const count = Number(item.count) || 0;
        if(count > 0){
          total += count;
        }
      }
    }
    return total;
  }

  function updateInventoryHoverSlotFromPoint(localX, localY){
    if(!inventoryVisible || !inventoryPanelLayout){
      if(inventoryHoverSlotIndex !== -1) inventoryHoverSlotIndex = -1;
      return;
    }
    let nextIndex = -1;
    for(const slot of inventoryPanelLayout.slots){
      if(localX >= slot.x && localX <= slot.x + slot.width && localY >= slot.y && localY <= slot.y + slot.height){
        nextIndex = slot.index;
        break;
      }
    }
    if(nextIndex !== inventoryHoverSlotIndex){
      inventoryHoverSlotIndex = nextIndex;
    }
  }

  function openJournalView(){
    if(!inventoryVisible) return;
    inventoryViewMode = INVENTORY_VIEW.journal;
    inventoryHoverSlotIndex = -1;
    journalEditing = false;
    journalPanelLayout = null;
    ensureJournalPageInitialized(journalCurrentPage);
  }

  function closeJournalView(){
    if(inventoryViewMode !== INVENTORY_VIEW.journal) return;
    inventoryViewMode = INVENTORY_VIEW.inventory;
    journalEditing = false;
    journalPanelLayout = null;
  }

  function openQuestsPanel(){
    if(questsVisible) return;
    questsVisible = true;
    questsPanelLayout = null;
  }

  function closeQuestsPanel(){
    if(!questsVisible) return;
    questsVisible = false;
    questsPanelLayout = null;
  }

  function toggleQuestsPanel(){
    if(questsVisible){
      closeQuestsPanel();
    }else{
      openQuestsPanel();
    }
  }

  function changeJournalPage(delta){
    if(!delta) return false;
    const next = Math.max(0, Math.min(JOURNAL_PAGE_COUNT - 1, journalCurrentPage + delta));
    if(next === journalCurrentPage) return false;
    journalCurrentPage = next;
    journalEditing = false;
    ensureJournalPageInitialized(journalCurrentPage);
    return true;
  }

  function ensureJournalPageInitialized(index){
    if(index < 0 || index >= JOURNAL_PAGE_COUNT) return;
    const current = journalPages[index];
    if(typeof current !== 'string'){
      journalPages[index] = current == null ? '' : String(current);
    }
  }

  function makeInventoryCountGlyphCanvas(text){
    const chars = String(text).split('');
    const glyphHeight = INVENTORY_COUNT_GLYPH_HEIGHT;
    let width = 0;
    for(let i = 0; i < chars.length; i++){
      width += INVENTORY_COUNT_GLYPH_WIDTH;
      if(i < chars.length - 1) width += INVENTORY_COUNT_GLYPH_SPACING;
    }
    width = Math.max(1, width);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = glyphHeight;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, glyphHeight);
    ctx.fillStyle = '#000000';
    let offsetX = 0;
    for(let i = 0; i < chars.length; i++){
      const ch = chars[i];
      const glyph = INVENTORY_COUNT_GLYPHS[ch] || INVENTORY_COUNT_GLYPHS['?'];
      for(let y = 0; y < glyphHeight; y++){
        const row = glyph[y] || '';
        for(let x = 0; x < INVENTORY_COUNT_GLYPH_WIDTH; x++){
          if(row[x] === '1'){
            ctx.fillRect(offsetX + x, y, 1, 1);
          }
        }
      }
      offsetX += INVENTORY_COUNT_GLYPH_WIDTH;
      if(i < chars.length - 1) offsetX += INVENTORY_COUNT_GLYPH_SPACING;
    }
    return canvas;
  }

  function cancelAutoMove(){
    mcAutoMoveTarget = null;
    mcAutoMoveCollectTarget = null;
  }

  function beginAutoMove(worldX, worldY, collectTarget = null){
    mcAutoMoveTarget = {x: Math.round(worldX), y: Math.round(worldY)};
    mcAutoMoveCollectTarget = collectTarget || null;
  }

  function drawInventoryButton(){
    currencyDisplayRect = null;
    if(!inventoryButtonEnabled && !inventoryVisible) return;
    if(inventoryVisible && inventoryViewMode === INVENTORY_VIEW.journal){
      inventoryButtonRect = null;
      return;
    }
    const label = inventoryVisible ? 'exit inventory' : 'inventory';
    const margin = INVENTORY_BUTTON_MARGIN;
    const paddingX = 6;
    const paddingY = 4;
    const textCanvas = makePixelTextCanvasLines([label], 12, CURRENCY_TEXT_COLOR);
    const buttonWidth = Math.max(60, textCanvas.width + paddingX * 2);
    const buttonHeight = textCanvas.height + paddingY * 2;
    const x = margin;
    const y = margin;

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.fillStyle = '#efd6a8';
    bctx.fillRect(x, y, buttonWidth, buttonHeight);
    bctx.fillStyle = '#a67b49';
    bctx.fillRect(x, y, buttonWidth, 1);
    bctx.fillRect(x, y + buttonHeight - 1, buttonWidth, 1);
    bctx.fillRect(x, y, 1, buttonHeight);
    bctx.fillRect(x + buttonWidth - 1, y, 1, buttonHeight);
    bctx.globalAlpha = 0.35;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, x + paddingX + 1, y + paddingY + 1, textCanvas.width, textCanvas.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, x + paddingX, y + paddingY, textCanvas.width, textCanvas.height);
    bctx.restore();

    inventoryButtonRect = {x, y, width: buttonWidth, height: buttonHeight};

    if(!coinIconReady) return;
    const iconScale = 0.17;
    const iconDrawWidth = Math.max(1, Math.round(coinIcon.width * iconScale));
    const iconDrawHeight = Math.max(1, Math.round(coinIcon.height * iconScale));
    const iconX = x + buttonWidth + CURRENCY_ICON_MARGIN;
    const iconY = Math.max(0, INVENTORY_BUTTON_MARGIN);

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(coinIcon, iconX, iconY, iconDrawWidth, iconDrawHeight);

    const amountText = String(currencyAmount);
    const amountCanvas = makePixelTextCanvasLines([amountText], 12, CURRENCY_AMOUNT_COLOR);
    const shadowCanvas = makePixelTextCanvasLines([amountText], 12, CURRENCY_SHADOW_COLOR);
    const textX = iconX + iconDrawWidth + CURRENCY_ICON_MARGIN;
    const textY = iconY + Math.max(0, Math.round((iconDrawHeight - amountCanvas.height) / 2));
    bctx.globalAlpha = 0.45;
    bctx.drawImage(shadowCanvas, 0, 0, shadowCanvas.width, shadowCanvas.height, textX + 1, textY + 1, shadowCanvas.width, shadowCanvas.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(amountCanvas, 0, 0, amountCanvas.width, amountCanvas.height, textX, textY, amountCanvas.width, amountCanvas.height);
    bctx.restore();

    const currencyLeft = iconX;
    const currencyRight = Math.max(iconX + iconDrawWidth, textX + amountCanvas.width);
    const currencyTop = Math.min(iconY, textY);
    const currencyBottom = Math.max(iconY + iconDrawHeight, textY + amountCanvas.height);
    currencyDisplayRect = {
      x: currencyLeft,
      y: currencyTop,
      width: Math.max(0, currencyRight - currencyLeft),
      height: Math.max(0, currencyBottom - currencyTop),
      right: currencyRight,
      bottom: currencyBottom
    };
  }

  function drawJournalButton(){
    journalButtonRect = null;
    if(!inventoryVisible) return;
    // hide the inventory toggle button when the journal view is active
    if(inventoryViewMode === INVENTORY_VIEW.journal){
      inventoryButtonRect = null;
    }
    const buttonHeight = inventoryButtonRect ? inventoryButtonRect.height : Math.max(22, Math.round(bh * 0.045));
    const margin = INVENTORY_BUTTON_MARGIN;
    const paddingX = 6;
    const paddingY = 4;
    const label = inventoryViewMode === INVENTORY_VIEW.journal ? 'close journal' : 'journal';
    let fontSize = 12;
    let lines = wrapPixelText(label, 400, fontSize);
    let textCanvas = makePixelTextCanvasLines(lines, fontSize, CURRENCY_TEXT_COLOR);
    while(textCanvas.height + paddingY * 2 > buttonHeight && fontSize > 6){
      fontSize -= 1;
      lines = wrapPixelText(label, 400, fontSize);
      textCanvas = makePixelTextCanvasLines(lines, fontSize, CURRENCY_TEXT_COLOR);
    }
    const buttonWidth = Math.max(textCanvas.width + paddingX * 2, Math.round(buttonHeight * 1.25));
    const shadowCanvas = makePixelTextCanvasLines(lines, fontSize, '#000000');
    const x = bw - margin - buttonWidth;
    const y = margin;

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.fillStyle = '#efd6a8';
    bctx.fillRect(x, y, buttonWidth, buttonHeight);
    bctx.fillStyle = '#a67b49';
    bctx.fillRect(x, y, buttonWidth, 1);
    bctx.fillRect(x, y + buttonHeight - 1, buttonWidth, 1);
    bctx.fillRect(x, y, 1, buttonHeight);
    bctx.fillRect(x + buttonWidth - 1, y, 1, buttonHeight);
    const textX = x + buttonWidth - paddingX - textCanvas.width;
    const textY = y + Math.round((buttonHeight - textCanvas.height) / 2);
    bctx.globalAlpha = 0.3;
    bctx.drawImage(shadowCanvas, 0, 0, shadowCanvas.width, shadowCanvas.height, textX + 1, textY + 1, shadowCanvas.width, shadowCanvas.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX, textY, textCanvas.width, textCanvas.height);
    bctx.restore();

    journalButtonRect = {x, y, width: buttonWidth, height: buttonHeight};
  }

  function shouldShowQuestsButton(){
    if(inventoryVisible && inventoryViewMode === INVENTORY_VIEW.journal) return false;
    if(!inventoryButtonEnabled && !inventoryVisible && !questsVisible) return false;
    return true;
  }

  function drawQuestsButton(){
    questButtonRect = null;
    if(!shouldShowQuestsButton()) return;

    const margin = INVENTORY_BUTTON_MARGIN;
    const gap = Math.max(6, Math.round(bw * 0.015));
    const buttonHeight = inventoryButtonRect ? inventoryButtonRect.height : Math.max(22, Math.round(bh * 0.045));
    let leftX = inventoryButtonRect ? inventoryButtonRect.x + inventoryButtonRect.width + gap : margin;
    if(currencyDisplayRect){
      leftX = currencyDisplayRect.right + gap;
    }
    let rightLimit = bw - margin;
    if(journalButtonRect){
      rightLimit = Math.min(rightLimit, journalButtonRect.x - gap);
    }
    if(rightLimit <= leftX + 6) return;

    const availableWidth = rightLimit - leftX;
    const paddingX = 6;
    const paddingY = 4;
    const label = questsVisible ? 'close quests' : 'quests';
    let fontSize = 12;
    let textCanvas = makePixelTextCanvasLines([label], fontSize, CURRENCY_TEXT_COLOR);
    while(textCanvas.height + paddingY * 2 > buttonHeight && fontSize > 6){
      fontSize -= 1;
      textCanvas = makePixelTextCanvasLines([label], fontSize, CURRENCY_TEXT_COLOR);
    }
    const desiredWidth = Math.max(textCanvas.width + paddingX * 2, Math.round(buttonHeight * 1.15));
    const maxWidth = Math.max(48, Math.min(132, availableWidth));
    let buttonWidth = Math.min(desiredWidth, maxWidth);
    if(buttonWidth > availableWidth){
      buttonWidth = availableWidth;
    }
    if(buttonWidth <= 0) return;

    const x = Math.round(leftX);
    const y = margin;
    const shadowCanvas = makePixelTextCanvasLines([label], fontSize, '#000000');
    const fillColor = questsVisible ? '#e3c08c' : '#efd6a8';
    const textX = x + Math.round((buttonWidth - textCanvas.width) / 2);
    const textY = y + Math.round((buttonHeight - textCanvas.height) / 2);

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.fillStyle = fillColor;
    bctx.fillRect(x, y, buttonWidth, buttonHeight);
    bctx.fillStyle = '#a67b49';
    bctx.fillRect(x, y, buttonWidth, 1);
    bctx.fillRect(x, y + buttonHeight - 1, buttonWidth, 1);
    bctx.fillRect(x, y, 1, buttonHeight);
    bctx.fillRect(x + buttonWidth - 1, y, 1, buttonHeight);
    bctx.globalAlpha = 0.3;
    bctx.drawImage(shadowCanvas, 0, 0, shadowCanvas.width, shadowCanvas.height, textX + 1, textY + 1, shadowCanvas.width, shadowCanvas.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX, textY, textCanvas.width, textCanvas.height);
    bctx.restore();

    questButtonRect = {x, y, width: buttonWidth, height: buttonHeight};
  }

  function drawInventoryOverlay(){
    inventoryPanelLayout = null;
    journalPanelLayout = null;
    if(!inventoryVisible) return;

    bctx.save();
    bctx.globalAlpha = 0.45;
    bctx.fillStyle = '#000000';
    bctx.fillRect(0,0,bw,bh);
    bctx.restore();

    if(inventoryViewMode === INVENTORY_VIEW.journal){
      drawJournalOverlayPanel();
      return;
    }

    const rows = Math.ceil(INVENTORY_SLOT_COUNT / INVENTORY_COLUMNS);
    const gridWidth = INVENTORY_COLUMNS * INVENTORY_SLOT_SIZE + (INVENTORY_COLUMNS - 1) * INVENTORY_SLOT_GAP;
    const gridHeight = rows * INVENTORY_SLOT_SIZE + (rows - 1) * INVENTORY_SLOT_GAP;
    const headerText = makePixelTextCanvasLines(['INVENTORY'], INVENTORY_HEADER_FONT, '#2a2117');
    const headerSpacing = Math.max(8, Math.round(INVENTORY_PANEL_PADDING * 0.7));
    const basePanelWidth = gridWidth + INVENTORY_PANEL_PADDING * 2;
    const headerWidthRequirement = headerText.width + INVENTORY_PANEL_PADDING * 2;
    const extendedWidth = Math.max(basePanelWidth + Math.round(INVENTORY_PANEL_PADDING * 3.2), headerWidthRequirement + Math.round(INVENTORY_PANEL_PADDING * 2.2));
    let panelWidth = Math.min(bw - 10, extendedWidth);
    const requiredHeight = INVENTORY_PANEL_PADDING + headerText.height + headerSpacing + gridHeight + INVENTORY_PANEL_PADDING;
    const panelHeight = Math.min(bh - 8, Math.max(requiredHeight, Math.round(bh * 0.52)));
    const tutorialGap = INVENTORY_TUTORIAL_GAP;
    let tutorialWidth = INVENTORY_TUTORIAL_WIDTH;
    const maxTutorialWidth = Math.max(0, bw - panelWidth - tutorialGap - 12);
    if(tutorialWidth > maxTutorialWidth){
      tutorialWidth = Math.max(0, maxTutorialWidth);
    }
    if(tutorialWidth <= 0){
      tutorialWidth = 0;
    }
    const totalWidth = panelWidth + (tutorialWidth > 0 ? tutorialGap + tutorialWidth : 0);
    if(totalWidth + 8 > bw){
      const availableForPanel = Math.max(basePanelWidth, bw - 8 - (tutorialWidth > 0 ? tutorialGap + tutorialWidth : 0));
      panelWidth = Math.min(panelWidth, availableForPanel);
    }
    const combinedWidth = panelWidth + (tutorialWidth > 0 ? tutorialGap + tutorialWidth : 0);
    const panelX = Math.max(4, Math.round((bw - combinedWidth) / 2));
    const tutorialX = tutorialWidth > 0 ? panelX + panelWidth + tutorialGap : 0;
    const panelY = Math.round((bh - panelHeight) / 2);

    const panelFill = '#c89f6b';
    const panelBorder = '#5b3b22';
    bctx.save();
    bctx.fillStyle = panelFill;
    bctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    bctx.fillStyle = panelBorder;
    bctx.fillRect(panelX, panelY, panelWidth, 1);
    bctx.fillRect(panelX, panelY + panelHeight - 1, panelWidth, 1);
    bctx.fillRect(panelX, panelY, 1, panelHeight);
    bctx.fillRect(panelX + panelWidth - 1, panelY, 1, panelHeight);
    bctx.restore();

    let tutorialInnerX = 0;
    let tutorialInnerWidth = 0;
    if(tutorialWidth > 0){
      bctx.save();
      bctx.fillStyle = panelFill;
      bctx.fillRect(tutorialX, panelY, tutorialWidth, panelHeight);
      bctx.fillStyle = panelBorder;
      bctx.fillRect(tutorialX, panelY, tutorialWidth, 1);
      bctx.fillRect(tutorialX, panelY + panelHeight - 1, tutorialWidth, 1);
      bctx.fillRect(tutorialX, panelY, 1, panelHeight);
      bctx.fillRect(tutorialX + tutorialWidth - 1, panelY, 1, panelHeight);
      const innerMargin = Math.max(2, Math.round(INVENTORY_SLOT_GAP * 0.8));
      tutorialInnerX = tutorialX + innerMargin;
      const tutorialInnerY = panelY + innerMargin;
      tutorialInnerWidth = Math.max(0, tutorialWidth - innerMargin * 2);
      const tutorialInnerHeight = Math.max(0, panelHeight - innerMargin * 2);
      if(tutorialInnerWidth > 0 && tutorialInnerHeight > 0){
        bctx.fillStyle = '#f3dfb9';
        bctx.fillRect(tutorialInnerX, tutorialInnerY, tutorialInnerWidth, tutorialInnerHeight);
      }
      bctx.restore();
    }

    const headerY = panelY + INVENTORY_PANEL_PADDING;
    const headerX = panelX + Math.round((panelWidth - headerText.width) / 2);
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.globalAlpha = 0.35;
    bctx.drawImage(headerText, 0, 0, headerText.width, headerText.height, headerX + 1, headerY + 1, headerText.width, headerText.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(headerText, 0, 0, headerText.width, headerText.height, headerX, headerY, headerText.width, headerText.height);
    bctx.restore();

    if(tutorialWidth > 0){
      const hoverSlotIndex = inventoryHoverSlotIndex;
      let tutorialHeaderLabel = 'TUTORIAL';
      let tutorialBodyText = INVENTORY_TUTORIAL_TEXT;
      if(hoverSlotIndex >= 0){
        const slotItem = inventoryItems[hoverSlotIndex];
        if(slotItem && slotItem.count > 0){
          const info = INVENTORY_ITEM_INFO[slotItem.type];
          if(info){
            tutorialHeaderLabel = info.title;
            const countLabel = `You have ${slotItem.count} of these item.`;
            tutorialBodyText = `${info.bio}\n\n${countLabel}`;
          }
        }
      }

      const tutorialHeaderCanvas = makePixelTextCanvasLines([tutorialHeaderLabel], INVENTORY_TUTORIAL_HEADER_FONT, '#2a2117');
      const tutorialHeaderY = panelY + INVENTORY_PANEL_PADDING;
      const headerCenterX = tutorialInnerWidth > 0 ? tutorialInnerX + Math.round((tutorialInnerWidth - tutorialHeaderCanvas.width) / 2) : tutorialX + Math.round((tutorialWidth - tutorialHeaderCanvas.width) / 2);
      const tutorialHeaderX = Math.max(tutorialX + 2, headerCenterX);
      bctx.save();
      bctx.imageSmoothingEnabled = false;
      bctx.globalAlpha = 0.35;
      bctx.drawImage(tutorialHeaderCanvas, 0, 0, tutorialHeaderCanvas.width, tutorialHeaderCanvas.height, tutorialHeaderX + 1, tutorialHeaderY + 1, tutorialHeaderCanvas.width, tutorialHeaderCanvas.height);
      bctx.globalAlpha = 1;
      bctx.drawImage(tutorialHeaderCanvas, 0, 0, tutorialHeaderCanvas.width, tutorialHeaderCanvas.height, tutorialHeaderX, tutorialHeaderY, tutorialHeaderCanvas.width, tutorialHeaderCanvas.height);
      bctx.restore();

      const contentInset = Math.max(4, INVENTORY_PANEL_PADDING);
      const tutorialBodyWidth = Math.max(1, (tutorialInnerWidth > 0 ? tutorialInnerWidth : tutorialWidth) - contentInset * 2);
      const tutorialLines = wrapPixelText(tutorialBodyText, tutorialBodyWidth, INVENTORY_TUTORIAL_BODY_FONT);
      const tutorialBodyCanvas = makePixelTextCanvasLines(tutorialLines, INVENTORY_TUTORIAL_BODY_FONT, '#2a2117');
      const tutorialShadowCanvas = makePixelTextCanvasLines(tutorialLines, INVENTORY_TUTORIAL_BODY_FONT, '#000000');
      const bodyBaseX = tutorialInnerWidth > 0 ? tutorialInnerX + contentInset : tutorialX + contentInset;
      const tutorialBodyX = bodyBaseX;
      const tutorialBodyY = tutorialHeaderY + tutorialHeaderCanvas.height + headerSpacing;
      bctx.save();
      bctx.imageSmoothingEnabled = false;
      bctx.globalAlpha = 0.38;
      bctx.drawImage(tutorialShadowCanvas, 0, 0, tutorialShadowCanvas.width, tutorialShadowCanvas.height, tutorialBodyX + 1, tutorialBodyY + 1, tutorialShadowCanvas.width, tutorialShadowCanvas.height);
      bctx.globalAlpha = 1;
      bctx.drawImage(tutorialBodyCanvas, 0, 0, tutorialBodyCanvas.width, tutorialBodyCanvas.height, tutorialBodyX, tutorialBodyY, tutorialBodyCanvas.width, tutorialBodyCanvas.height);
      bctx.restore();
    }

    const gridY = headerY + headerText.height + headerSpacing;
    const gridX = panelX + Math.round((panelWidth - gridWidth) / 2);
    const slotFill = '#f3dfb9';
    const slotBorder = '#8d6238';

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    let itemIndex = 0;
    const slots = [];
    for(let row=0; row<rows; row++){
      for(let col=0; col<INVENTORY_COLUMNS; col++){
        if(itemIndex >= INVENTORY_SLOT_COUNT) break;
        const sx = gridX + col * (INVENTORY_SLOT_SIZE + INVENTORY_SLOT_GAP);
        const sy = gridY + row * (INVENTORY_SLOT_SIZE + INVENTORY_SLOT_GAP);
        bctx.fillStyle = slotFill;
        bctx.fillRect(sx, sy, INVENTORY_SLOT_SIZE, INVENTORY_SLOT_SIZE);
        bctx.fillStyle = slotBorder;
        bctx.fillRect(sx, sy, INVENTORY_SLOT_SIZE, 1);
        bctx.fillRect(sx, sy + INVENTORY_SLOT_SIZE - 1, INVENTORY_SLOT_SIZE, 1);
        bctx.fillRect(sx, sy, 1, INVENTORY_SLOT_SIZE);
        bctx.fillRect(sx + INVENTORY_SLOT_SIZE - 1, sy, 1, INVENTORY_SLOT_SIZE);
        slots.push({x: sx, y: sy, width: INVENTORY_SLOT_SIZE, height: INVENTORY_SLOT_SIZE, index: itemIndex});
        itemIndex++;
      }
    }
    bctx.restore();

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    for(const slot of slots){
      const slotItem = inventoryItems[slot.index];
      if(!slotItem) continue;
      const img = getBeachDecorImage(slotItem.type);
      if(!img || img.width <= 0 || img.height <= 0) continue;
      const maxWidth = INVENTORY_SLOT_SIZE - 4;
      const maxHeight = INVENTORY_SLOT_SIZE - 4;
      const baseScale = Math.min(1, Math.min(maxWidth / img.width, maxHeight / img.height));
      const iconScaleFactor = INVENTORY_ICON_SCALE_OVERRIDES[slotItem.type] ?? INVENTORY_ICON_BASE_SCALE;
      const scale = Math.max(0.1, baseScale * iconScaleFactor);
      const drawWidth = Math.max(1, Math.round(img.width * scale));
      const drawHeight = Math.max(1, Math.round(img.height * scale));
      const drawX = slot.x + Math.round((slot.width - drawWidth) / 2);
      const drawY = slot.y + Math.round((slot.height - drawHeight) / 2);
      bctx.drawImage(img, 0, 0, img.width, img.height, drawX, drawY, drawWidth, drawHeight);

      const countCanvas = getInventoryItemCountCanvas(slotItem);
      if(countCanvas){
        const labelWidth = countCanvas.width;
        const labelHeight = countCanvas.height;
        const borderWidth = Math.max(0, INVENTORY_COUNT_BORDER_WIDTH);
        const padding = Math.max(0, INVENTORY_COUNT_PADDING);
        const inset = borderWidth + padding;
        const bgWidth = labelWidth + inset * 2;
        const bgHeight = labelHeight + inset * 2;
        const bgX = slot.x + slot.width - bgWidth;
        const bgY = slot.y + slot.height - bgHeight;
        bctx.fillStyle = '#ffffff';
        bctx.fillRect(bgX, bgY, bgWidth, bgHeight);
        if(borderWidth > 0){
          bctx.fillStyle = '#000000';
          bctx.fillRect(bgX, bgY, bgWidth, borderWidth);
          bctx.fillRect(bgX, bgY + bgHeight - borderWidth, bgWidth, borderWidth);
          bctx.fillRect(bgX, bgY, borderWidth, bgHeight);
          bctx.fillRect(bgX + bgWidth - borderWidth, bgY, borderWidth, bgHeight);
        }
        const labelX = bgX + inset;
        const labelY = bgY + inset;
        bctx.drawImage(countCanvas, 0, 0, labelWidth, labelHeight, labelX, labelY, labelWidth, labelHeight);
      }
    }
    bctx.restore();

    inventoryPanelLayout = {
      x: panelX,
      y: panelY,
      width: panelWidth,
      height: panelHeight,
      slots,
      tutorial: tutorialWidth > 0 ? {x: tutorialX, y: panelY, width: tutorialWidth, height: panelHeight} : null
    };
  }

  function drawJournalNavButton(rect, label, enabled){
    if(!rect || rect.width <= 0 || rect.height <= 0) return;
    const paddingX = 5;
    const paddingY = 3;
    const buttonFill = '#efd6a8';
    const buttonBorder = '#a67b49';
    const textWidthLimit = Math.max(1, rect.width - paddingX * 2);
    let fontSize = JOURNAL_BUTTON_FONT;
    let lines = wrapPixelText(label, textWidthLimit, fontSize);
    let textCanvas = makePixelTextCanvasLines(lines, fontSize, '#2a2117');
    if(textCanvas.height + paddingY * 2 > rect.height){
      fontSize = Math.max(6, JOURNAL_BUTTON_FONT - 2);
      lines = wrapPixelText(label, textWidthLimit, fontSize);
      textCanvas = makePixelTextCanvasLines(lines, fontSize, '#2a2117');
    }
    const shadowCanvas = makePixelTextCanvasLines(lines, fontSize, '#000000');
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.globalAlpha = enabled ? 1 : 0.45;
    bctx.fillStyle = buttonFill;
    bctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    bctx.fillStyle = buttonBorder;
    bctx.fillRect(rect.x, rect.y, rect.width, 1);
    bctx.fillRect(rect.x, rect.y + rect.height - 1, rect.width, 1);
    bctx.fillRect(rect.x, rect.y, 1, rect.height);
    bctx.fillRect(rect.x + rect.width - 1, rect.y, 1, rect.height);
    const textX = rect.x + Math.round((rect.width - textCanvas.width) / 2);
    const textY = rect.y + Math.round((rect.height - textCanvas.height) / 2);
    bctx.globalAlpha = enabled ? 0.35 : 0.25;
    bctx.drawImage(shadowCanvas, 0, 0, shadowCanvas.width, shadowCanvas.height, textX + 1, textY + 1, shadowCanvas.width, shadowCanvas.height);
    bctx.globalAlpha = enabled ? 1 : 0.6;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX, textY, textCanvas.width, textCanvas.height);
    bctx.restore();
  }

  function drawQuestsOverlay(){
    questsPanelLayout = null;
    if(!questsVisible) return;

    bctx.save();
    bctx.globalAlpha = 0.45;
    bctx.fillStyle = '#000000';
    bctx.fillRect(0,0,bw,bh);
    bctx.restore();

    const panelFill = '#c89f6b';
    const panelBorder = '#5b3b22';
    const panelWidth = Math.min(bw - 12, Math.round(bw * 0.68));
    const panelHeight = Math.min(bh - 8, Math.round(bh * 0.78));
    const panelX = Math.round((bw - panelWidth) / 2);
    const panelY = Math.round((bh - panelHeight) / 2);

    bctx.save();
    bctx.fillStyle = panelFill;
    bctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    bctx.fillStyle = panelBorder;
    bctx.fillRect(panelX, panelY, panelWidth, 1);
    bctx.fillRect(panelX, panelY + panelHeight - 1, panelWidth, 1);
    bctx.fillRect(panelX, panelY, 1, panelHeight);
    bctx.fillRect(panelX + panelWidth - 1, panelY, 1, panelHeight);
    bctx.restore();

    const innerMargin = Math.max(8, Math.round(panelWidth * 0.05));
    const innerX = panelX + innerMargin;
    const innerY = panelY + innerMargin;
    const innerWidth = Math.max(0, panelWidth - innerMargin * 2);
    const innerHeight = Math.max(0, panelHeight - innerMargin * 2);

    bctx.save();
    bctx.fillStyle = '#f3dfb9';
    bctx.fillRect(innerX, innerY, innerWidth, innerHeight);
    bctx.restore();

    const headerCanvas = makePixelTextCanvasLines(['QUESTS'], JOURNAL_HEADER_FONT, '#2a2117');
    const headerX = innerX + Math.max(2, Math.round((innerWidth - headerCanvas.width) / 2));
    const headerY = innerY + 4;
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.globalAlpha = 0.35;
    bctx.drawImage(headerCanvas, 0, 0, headerCanvas.width, headerCanvas.height, headerX + 1, headerY + 1, headerCanvas.width, headerCanvas.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(headerCanvas, 0, 0, headerCanvas.width, headerCanvas.height, headerX, headerY, headerCanvas.width, headerCanvas.height);
    bctx.restore();

    const questTitleFont = 13;
    const questBodyFont = JOURNAL_BODY_FONT;
    const questGoal = DRIFTWOOD_COUNT;
    const driftwoodCount = getInventoryCountByType('driftwood');
    const clampedProgress = Math.max(0, Math.min(questGoal, driftwoodCount));
    const questComplete = clampedProgress >= questGoal;
    const questSectionTop = headerY + headerCanvas.height + 14;
    const questCardMargin = Math.max(10, Math.round(innerWidth * 0.05));
    const questCardX = innerX + questCardMargin;
    const questCardWidth = Math.max(0, innerWidth - questCardMargin * 2);
    const questCardPadding = Math.max(8, Math.round(questCardWidth * 0.045));
    const questCardY = questSectionTop;

    if(!questComplete){
      const questTextWidth = Math.max(1, questCardWidth - questCardPadding * 2);
      const questTitleCanvas = makePixelTextCanvasLines(['Getting started'], questTitleFont, '#2a2117');
      const questDescription = 'Collect 10 pieces of driftwood for Kierlyn.';
      const questBodyLines = wrapPixelText(questDescription, questTextWidth, questBodyFont);
      const questBodyCanvas = makePixelTextCanvasLines(questBodyLines, questBodyFont, '#2a2117');
      const progressLabel = `driftwood: ${clampedProgress} / ${questGoal}`;
      const progressLabelCanvas = makePixelTextCanvasLines([progressLabel], questBodyFont, '#2a2117');
      const progressBarWidth = questTextWidth;
      const progressBarHeight = 10;
      const questContentHeight = questTitleCanvas.height + 6 + questBodyCanvas.height + 10 + progressLabelCanvas.height + 6 + progressBarHeight;
      const questCardHeight = questContentHeight + questCardPadding * 2;

      bctx.save();
      bctx.fillStyle = '#f7e4c5';
      bctx.fillRect(questCardX, questCardY, questCardWidth, questCardHeight);
      bctx.fillStyle = '#b18554';
      bctx.fillRect(questCardX, questCardY, questCardWidth, 1);
      bctx.fillRect(questCardX, questCardY + questCardHeight - 1, questCardWidth, 1);
      bctx.fillRect(questCardX, questCardY, 1, questCardHeight);
      bctx.fillRect(questCardX + questCardWidth - 1, questCardY, 1, questCardHeight);
      bctx.restore();

      const titleX = questCardX + questCardPadding;
      const titleY = questCardY + questCardPadding;
      const bodyX = titleX;
      const bodyY = titleY + questTitleCanvas.height + 6;
      const progressLabelX = bodyX;
      const progressLabelY = bodyY + questBodyCanvas.height + 10;
      const progressBarX = bodyX;
      const progressBarY = progressLabelY + progressLabelCanvas.height + 6;

      bctx.save();
      bctx.imageSmoothingEnabled = false;
      bctx.globalAlpha = 0.35;
      bctx.drawImage(questTitleCanvas, 0, 0, questTitleCanvas.width, questTitleCanvas.height, titleX + 1, titleY + 1, questTitleCanvas.width, questTitleCanvas.height);
      bctx.globalAlpha = 1;
      bctx.drawImage(questTitleCanvas, 0, 0, questTitleCanvas.width, questTitleCanvas.height, titleX, titleY, questTitleCanvas.width, questTitleCanvas.height);

      bctx.drawImage(questBodyCanvas, 0, 0, questBodyCanvas.width, questBodyCanvas.height, bodyX, bodyY, questBodyCanvas.width, questBodyCanvas.height);
      bctx.drawImage(progressLabelCanvas, 0, 0, progressLabelCanvas.width, progressLabelCanvas.height, progressLabelX, progressLabelY, progressLabelCanvas.width, progressLabelCanvas.height);
      bctx.restore();

      bctx.save();
      bctx.fillStyle = '#d5b48a';
      bctx.fillRect(progressBarX, progressBarY, progressBarWidth, progressBarHeight);
      bctx.fillStyle = '#876034';
      bctx.fillRect(progressBarX, progressBarY, progressBarWidth, 1);
      bctx.fillRect(progressBarX, progressBarY + progressBarHeight - 1, progressBarWidth, 1);
      bctx.fillRect(progressBarX, progressBarY, 1, progressBarHeight);
      bctx.fillRect(progressBarX + progressBarWidth - 1, progressBarY, progressBarWidth, 1);
      const progressRatio = questGoal > 0 ? clampedProgress / questGoal : 0;
      const fillWidth = Math.max(0, Math.round((progressBarWidth - 2) * progressRatio));
      if(fillWidth > 0){
        bctx.fillStyle = '#6aa36f';
        bctx.fillRect(progressBarX + 1, progressBarY + 1, fillWidth, progressBarHeight - 2);
      }
      bctx.restore();

      questsPanelLayout = {
        panel: {x: panelX, y: panelY, width: panelWidth, height: panelHeight},
        questCard: {x: questCardX, y: questCardY, width: questCardWidth, height: questCardHeight},
        progressBar: {x: progressBarX, y: progressBarY, width: progressBarWidth, height: progressBarHeight},
        progressFillWidth: fillWidth
      };
    }else{
      const questTextWidth = Math.max(1, questCardWidth - questCardPadding * 2);
      const emptyMessage = QUEST_EMPTY_MESSAGE_LINES.join('\n');
      const messageLines = wrapPixelText(emptyMessage, questTextWidth, questBodyFont);
      const messageCanvas = makePixelTextCanvasLines(messageLines.length ? messageLines : [' '], questBodyFont, '#2a2117');
      const questCardHeight = messageCanvas.height + questCardPadding * 2;

      bctx.save();
      bctx.fillStyle = '#f7e4c5';
      bctx.fillRect(questCardX, questCardY, questCardWidth, questCardHeight);
      bctx.fillStyle = '#b18554';
      bctx.fillRect(questCardX, questCardY, questCardWidth, 1);
      bctx.fillRect(questCardX, questCardY + questCardHeight - 1, questCardWidth, 1);
      bctx.fillRect(questCardX, questCardY, 1, questCardHeight);
      bctx.fillRect(questCardX + questCardWidth - 1, questCardY, 1, questCardHeight);
      bctx.restore();

      const messageX = questCardX + Math.round((questCardWidth - messageCanvas.width) / 2);
      const messageY = questCardY + Math.round((questCardHeight - messageCanvas.height) / 2);
      bctx.save();
      bctx.imageSmoothingEnabled = false;
      bctx.globalAlpha = 0.35;
      bctx.drawImage(messageCanvas, 0, 0, messageCanvas.width, messageCanvas.height, messageX + 1, messageY + 1, messageCanvas.width, messageCanvas.height);
      bctx.globalAlpha = 1;
      bctx.drawImage(messageCanvas, 0, 0, messageCanvas.width, messageCanvas.height, messageX, messageY, messageCanvas.width, messageCanvas.height);
      bctx.restore();

      questsPanelLayout = {
        panel: {x: panelX, y: panelY, width: panelWidth, height: panelHeight},
        emptyMessage: {x: questCardX, y: questCardY, width: questCardWidth, height: questCardHeight}
      };
    }
  }

  function getActiveDialoguePortrait(){
    if(dialoguePortraitKey === 'kgirl'){
      return {image: pingPortrait, ready: pingPortraitReady, source: PING_PORTRAIT_SOURCE};
    }
    if(dialoguePortraitKey === 'wise'){
      return {image: wisePortrait, ready: wisePortraitReady, source: WISE_PORTRAIT_SOURCE};
    }
    return {image: pingPortrait, ready: pingPortraitReady, source: PING_PORTRAIT_SOURCE};
  }

  function isDialogueBoxVisible(){
    return pingTriggered || pingBoxProgress > 0 || pingTypingActive;
  }

  function isAdventureDialogueActive(){
    if(dialogueContext === 'intro' || dialogueContext === 'none') return false;
    return isDialogueBoxVisible();
  }

  function closeDialogueBox(){
    pingTriggered = false;
    pingBoxProgress = 0;
    pingTypingActive = false;
    pingTypeIndex = 0;
    pingTypeProgress = 0;
    dialogueManager.clear();
    dialoguePortraitDraw = null;
  }

  function resetDialogueInteraction(){
    dialogueOnComplete = null;
    dialogueOnCancel = null;
    if(dialogueContext !== 'intro'){
      dialogueContext = 'none';
    }
    dialoguePortraitKey = 'ping';
  }

  function finishActiveDialogue(){
    closeDialogueBox();
    if(typeof dialogueOnComplete === 'function'){
      dialogueOnComplete();
    }
    resetDialogueInteraction();
  }

  function cancelActiveDialogue(){
    if(!isDialogueBoxVisible()) return;
    closeDialogueBox();
    if(typeof dialogueOnCancel === 'function'){
      dialogueOnCancel();
    }
    resetDialogueInteraction();
  }

  function advanceActiveDialogue(){
    if(!isAdventureDialogueActive()) return;
    if(pingTypingActive){
      dialogueManager.skipTyping();
      return;
    }
    if(dialogueManager.advance()){
      return;
    }
    finishActiveDialogue();
  }

  function beginAdventureDialogue(lines, options = {}){
    if(!Array.isArray(lines)) return;
    const filtered = lines.map(line => typeof line === 'string' ? line : '').filter(Boolean);
    if(filtered.length === 0) return;
    const portraitKey = typeof options.portraitKey === 'string' ? options.portraitKey : 'kgirl';
    const context = typeof options.context === 'string' ? options.context : 'kgirl';
    const startTyping = !!options.startTyping;
    dialogueManager.setSequence(filtered, {startTyping});
    pingTypeIndex = 0;
    pingTypeProgress = 0;
    pingTypingActive = false;
    pingTriggered = true;
    pingBoxProgress = 0;
    dialoguePortraitKey = portraitKey;
    dialogueContext = context;
    dialogueOnComplete = typeof options.onComplete === 'function' ? options.onComplete : null;
    dialogueOnCancel = typeof options.onCancel === 'function' ? options.onCancel : null;
  }

  function buildKgDialogueLines(driftwoodCount){
    const lines = [];
    if(driftwoodCount >= DRIFTWOOD_COUNT){
      if(!kgirlRewardGiven){
        lines.push('this is perfect! you found all 10 pieces!');
        lines.push(`here's ${KGIRL_REWARD_AMOUNT} coins for your help!`);
      }else{
        lines.push(...KGIRL_REPEAT_THANKS_LINES);
      }
    }else{
      const remaining = Math.max(0, DRIFTWOOD_COUNT - driftwoodCount);
      const plural = remaining === 1 ? '' : 's';
      lines.push(`i still need ${remaining} more piece${plural} of driftwood.`);
      lines.push(KGIRL_REMINDER_HINT);
    }
    return lines;
  }

  function startKgDialogue(driftwoodCount){
    const lines = buildKgDialogueLines(driftwoodCount);
    if(lines.length === 0) return;
    if(driftwoodCount >= DRIFTWOOD_COUNT && !kgirlRewardGiven){
      currencyAmount += KGIRL_REWARD_AMOUNT;
      kgirlRewardGiven = true;
    }
    beginAdventureDialogue(lines, {portraitKey: 'kgirl', context: 'kgirl'});
  }

  function buildWiseDialogueLines(){
    const friendlyName = playerName || 'traveler';
    if(!kgirlRewardGiven){
      return [
        `patience, ${friendlyName}. lend Kierlyn your strength first.`,
        'then come listen to what the waves remember.'
      ];
    }
    if(wiseEncounterComplete){
      return [
        'the tide is quiet now.',
        'breathe, and let the ocean keep your story safe.'
      ];
    }
    return [
      "it's always so relaxing to walk along the beach like this...",
      "ah, i don't think we've met before.",
      `you're ${friendlyName}, right?`,
      "it's nice to meet you! the island doesn't get many newcomers these days.",
      "actually, there's someone i'd like you to meet. care to join me?"
    ];
  }

  function triggerWiseFinale(){
    if(finalFadeActive) return;
    wiseEncounterComplete = true;
    finalFadeActive = true;
    finalFadeProgress = 0;
    fadeOutAmbientAudio();
    setTrackTarget(ADVENTURE_MUSIC_TRACK, 0, ADVENTURE_MUSIC_FADE_OUT);
    inventoryVisible = false;
    inventoryButtonEnabled = false;
    inventoryButtonPending = false;
    closeQuestsPanel();
    inventoryPanelLayout = null;
    questsPanelLayout = null;
    questButtonRect = null;
    cancelAutoMove();
  }

  function startWiseDialogue(){
    const lines = buildWiseDialogueLines();
    if(lines.length === 0) return;
    const shouldTriggerFinale = kgirlRewardGiven && !wiseEncounterComplete;
    beginAdventureDialogue(lines, {
      portraitKey: 'wise',
      context: 'wise',
      onComplete: shouldTriggerFinale ? triggerWiseFinale : null
    });
  }

  function dismissAdventureDialogue(){
    if(dialogueContext !== 'intro' && dialogueContext !== 'none'){
      cancelActiveDialogue();
    }
  }

  function drawJournalOverlayPanel(){
    const panelFill = '#c89f6b';
    const panelBorder = '#5b3b22';
    const panelWidth = Math.min(bw - 24, Math.round(bw * 0.6));
    const panelHeight = Math.min(bh - 12, Math.round(bh * 0.82));
    const panelX = Math.round((bw - panelWidth) / 2);
    const panelY = Math.round((bh - panelHeight) / 2);

    bctx.save();
    bctx.fillStyle = panelFill;
    bctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    bctx.fillStyle = panelBorder;
    bctx.fillRect(panelX, panelY, panelWidth, 1);
    bctx.fillRect(panelX, panelY + panelHeight - 1, panelWidth, 1);
    bctx.fillRect(panelX, panelY, 1, panelHeight);
    bctx.fillRect(panelX + panelWidth - 1, panelY, 1, panelHeight);
    bctx.restore();

    const innerMargin = Math.max(4, Math.round(panelWidth * 0.03));
    const innerX = panelX + innerMargin;
    const innerY = panelY + innerMargin;
    const innerWidth = Math.max(0, panelWidth - innerMargin * 2);
    const innerHeight = Math.max(0, panelHeight - innerMargin * 2);
    bctx.save();
    bctx.fillStyle = '#f3dfb9';
    bctx.fillRect(innerX, innerY, innerWidth, innerHeight);
    bctx.restore();

    const headerCanvas = makePixelTextCanvasLines(['JOURNAL'], JOURNAL_HEADER_FONT, '#2a2117');
    const headerInset = Math.max(6, Math.round(innerWidth * 0.03));
    const headerX = innerX + headerInset;
    const headerY = innerY + 4;
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.globalAlpha = 0.35;
    bctx.drawImage(headerCanvas, 0, 0, headerCanvas.width, headerCanvas.height, headerX + 1, headerY + 1, headerCanvas.width, headerCanvas.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(headerCanvas, 0, 0, headerCanvas.width, headerCanvas.height, headerX, headerY, headerCanvas.width, headerCanvas.height);
    bctx.restore();

    const pageLabel = `page ${journalCurrentPage + 1} of ${JOURNAL_PAGE_COUNT}`;
    const pageCanvas = makePixelTextCanvasLines([pageLabel], JOURNAL_BODY_FONT, '#2a2117');
    const pageMinGap = Math.max(6, Math.round(innerWidth * 0.02));
    const pageRightLimit = innerX + innerWidth - pageCanvas.width;
    let pageX = innerX + innerWidth - headerInset - pageCanvas.width;
    if(pageX > pageRightLimit){
      pageX = pageRightLimit;
    }
    const minAllowedPageX = headerX + headerCanvas.width + pageMinGap;
    if(pageX < minAllowedPageX){
      pageX = Math.min(pageRightLimit, minAllowedPageX);
    }
    const rowHeight = Math.max(headerCanvas.height, pageCanvas.height);
    const pageY = headerY + (rowHeight - pageCanvas.height);
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.globalAlpha = 0.35;
    bctx.drawImage(pageCanvas, 0, 0, pageCanvas.width, pageCanvas.height, pageX + 1, pageY + 1, pageCanvas.width, pageCanvas.height);
    bctx.globalAlpha = 1;
    bctx.drawImage(pageCanvas, 0, 0, pageCanvas.width, pageCanvas.height, pageX, pageY, pageCanvas.width, pageCanvas.height);
    bctx.restore();

    const textAreaTop = headerY + rowHeight + 6;
    const navAreaHeight = 22;
    const textAreaHeight = Math.max(80, innerHeight - (textAreaTop - innerY) - navAreaHeight - 6);
    const textAreaWidth = Math.max(24, Math.round(innerWidth * 0.88));
    const textAreaX = innerX + Math.max(4, Math.round((innerWidth - textAreaWidth) / 2));
    const textAreaY = textAreaTop;

    bctx.save();
    bctx.fillStyle = '#fff4d9';
    bctx.fillRect(textAreaX, textAreaY, textAreaWidth, textAreaHeight);
    bctx.fillStyle = '#8d6238';
    bctx.fillRect(textAreaX, textAreaY, textAreaWidth, 1);
    bctx.fillRect(textAreaX, textAreaY + textAreaHeight - 1, textAreaWidth, 1);
    bctx.fillRect(textAreaX, textAreaY, 1, textAreaHeight);
    bctx.fillRect(textAreaX + textAreaWidth - 1, textAreaY, 1, textAreaHeight);
    bctx.restore();

    ensureJournalPageInitialized(journalCurrentPage);
    let content = journalPages[journalCurrentPage] || '';
    let placeholder = false;
    if(content.length === 0 && !journalEditing){
      placeholder = true;
      content = JOURNAL_PLACEHOLDER_TEXT;
    }
    const caretVisible = journalEditing && ((Math.floor(Date.now() / 500) % 2) === 0);
    if(journalEditing){
      if(content.length < JOURNAL_MAX_CHARS && caretVisible){
        content += '|';
      }else if(content.length >= JOURNAL_MAX_CHARS && caretVisible){
        content = content.slice(0, JOURNAL_MAX_CHARS) + '|';
      }
    }
    const textWidthLimit = Math.max(1, textAreaWidth - JOURNAL_TEXT_PADDING * 2);
    const lines = wrapPixelText(content, textWidthLimit, JOURNAL_BODY_FONT);
    if(lines.length === 0){
      lines.push('');
    }
    const textColor = placeholder ? '#6b5b45' : '#2a2117';
    const textCanvas = makePixelTextCanvasLines(lines, JOURNAL_BODY_FONT, textColor);
    const textClipHeight = Math.max(0, textAreaHeight - JOURNAL_TEXT_PADDING * 2);
    const textX = textAreaX + JOURNAL_TEXT_PADDING;
    const textY = textAreaY + JOURNAL_TEXT_PADDING;
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.beginPath();
    bctx.rect(textX, textY, textWidthLimit, textClipHeight);
    bctx.clip();
    bctx.globalAlpha = placeholder ? 0.55 : 1;
    bctx.drawImage(textCanvas, 0, 0, textCanvas.width, textCanvas.height, textX, textY, textCanvas.width, textCanvas.height);
    bctx.restore();

    const navY = textAreaY + textAreaHeight + 6;
    const halfWidth = Math.max(12, Math.floor(textAreaWidth / 2));
    const desiredWidth = Math.max(48, Math.round(textAreaWidth * 0.36));
    const buttonWidth = Math.min(desiredWidth, halfWidth);
    const buttonHeight = 20;
    const prevRect = {
      x: textAreaX,
      y: navY,
      width: buttonWidth,
      height: buttonHeight
    };
    const nextRect = {
      x: textAreaX + textAreaWidth - buttonWidth,
      y: navY,
      width: buttonWidth,
      height: buttonHeight
    };

    const prevEnabled = journalCurrentPage > 0;
    const nextEnabled = journalCurrentPage < JOURNAL_PAGE_COUNT - 1;
    drawJournalNavButton(prevRect, 'previous page', prevEnabled);
    drawJournalNavButton(nextRect, 'next page', nextEnabled);

    journalPanelLayout = {
      panel: {x: panelX, y: panelY, width: panelWidth, height: panelHeight},
      textArea: {x: textAreaX, y: textAreaY, width: textAreaWidth, height: textAreaHeight},
      prevButton: prevRect,
      nextButton: nextRect
    };
  }

  function playPickupSound(){
    const track = setTrackTarget('pickup', 0.85, 0.04);
    if(!track) return;
    setTimeout(()=>{
      setTrackTarget('pickup', 0, 0.18);
    }, 140);
  }

  function showPickupMessage(type){
    const label = PICKUP_DISPLAY_NAMES[type] || type;
    pickupMessage = `you have acquired 1 ${label}`;
    pickupMessageElapsed = 0;
    pickupMessageCanvas = makePixelTextCanvasLines([pickupMessage], PICKUP_MESSAGE_FONT, '#ffffff');
    pickupMessageShadowCanvas = makePixelTextCanvasLines([pickupMessage], PICKUP_MESSAGE_FONT, '#000000');
  }

  function handleInventoryPointer(e){
    const rect = canvas.getBoundingClientRect();
    if(!rect || rect.width === 0 || rect.height === 0) return false;
    const scaleX = bw / rect.width;
    const scaleY = bh / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if(isAdventureDialogueActive()){
      e.preventDefault();
      advanceActiveDialogue();
      return true;
    }

    const questsButtonActive = shouldShowQuestsButton();
    if(questsButtonActive && questButtonRect && x >= questButtonRect.x && x <= questButtonRect.x + questButtonRect.width && y >= questButtonRect.y && y <= questButtonRect.y + questButtonRect.height){
      e.preventDefault();
      toggleQuestsPanel();
      return true;
    }

    if(questsVisible){
      const handled = handleQuestsPointer(x, y);
      e.preventDefault();
      if(handled) return true;
    }

    if((inventoryButtonEnabled || inventoryVisible) && inventoryButtonRect && x >= inventoryButtonRect.x && x <= inventoryButtonRect.x + inventoryButtonRect.width && y >= inventoryButtonRect.y && y <= inventoryButtonRect.y + inventoryButtonRect.height){
      e.preventDefault();
      toggleInventory();
      return true;
    }

    if(inventoryVisible){
      if(journalButtonRect && x >= journalButtonRect.x && x <= journalButtonRect.x + journalButtonRect.width && y >= journalButtonRect.y && y <= journalButtonRect.y + journalButtonRect.height){
        e.preventDefault();
        if(inventoryViewMode === INVENTORY_VIEW.journal){
          closeJournalView();
        }else{
          openJournalView();
        }
        return true;
      }

      if(inventoryViewMode === INVENTORY_VIEW.journal){
        const handled = handleJournalPointer(x, y);
        e.preventDefault();
        return handled;
      }
      if(questsVisible){
        e.preventDefault();
        return true;
      }

      updateInventoryHoverSlotFromPoint(x, y);
      if(inventoryPanelLayout){
        const {x: px, y: py, width, height} = inventoryPanelLayout;
        if(x >= px && x <= px + width && y >= py && y <= py + height){
          e.preventDefault();
          return true;
        }
      }
      inventoryHoverSlotIndex = -1;
      e.preventDefault();
      return true;
    }

    if(inventoryHoverSlotIndex !== -1){
      inventoryHoverSlotIndex = -1;
    }
    return false;
  }

  function getAdventurePointerWorldPosition(e){
    const rect = canvas.getBoundingClientRect();
    if(!rect || rect.width === 0 || rect.height === 0) return null;
    const scaleX = bw / rect.width;
    const scaleY = bh / rect.height;
    const localX = (e.clientX - rect.left) * scaleX;
    const localY = (e.clientY - rect.top) * scaleY;
    if(localX < 0 || localY < 0 || localX > bw || localY > bh) return null;
    const cameraOffset = Math.round(cameraX);
    return {
      localX,
      localY,
      worldX: localX + cameraOffset,
      worldY: localY
    };
  }

  function findCollectibleAt(worldX, worldY){
    for(let i = beachDecor.length - 1; i >= 0; i--){
      const deco = beachDecor[i];
      if(!deco || deco.collected) continue;
      if(!COLLECTIBLE_TYPES.has(deco.type)) continue;
      const rect = getBeachDecorDrawRect(deco);
      if(!rect) continue;
      if(worldX >= rect.x && worldX <= rect.x + rect.width && worldY >= rect.y && worldY <= rect.y + rect.height){
        return deco;
      }
    }
    return null;
  }

  function withinPickupRange(deco){
    if(!deco) return false;
    const dx = mcPosition.x - deco.x;
    const dy = mcPosition.y - deco.y;
    return Math.hypot(dx, dy) <= PICKUP_RANGE;
  }

  function collectBeachDecor(deco){
    if(!deco || deco.collected) return false;
    const added = addInventoryItem(deco.type);
    if(!added) return false;
    deco.collected = true;
    playPickupSound();
    showPickupMessage(deco.type);
    return true;
  }

  function updateWiseWalkBounds(){
    const baseFrames = WISE_FRAME_RECTS.down || null;
    const reference = baseFrames && baseFrames[1] ? baseFrames[1] : {sw: 35, sh: 95};
    const destWidth = Math.max(1, Math.round(reference.sw * WISE_RENDER_SCALE));
    const destHeight = Math.max(1, Math.round(reference.sh * WISE_RENDER_SCALE));
    const halfWidth = Math.max(6, destWidth / 2);
    const minX = halfWidth + WISE_WALK_PADDING.x;
    const maxX = ADVENTURE_WORLD_WIDTH - (halfWidth + WISE_WALK_PADDING.x);
    const minY = Math.max(destHeight + WISE_WALK_PADDING.top, waveCollisionY + 6);
    const maxY = Math.min(bh - WISE_WALK_PADDING.bottom, Math.round(bh * 0.84));
    wiseBaseX = Math.max(minX, Math.min(maxX, wiseBaseX));
    const span = Math.max(12, maxY - minY);
    const proposedTop = minY + Math.round(span * 0.12);
    const proposedBottom = minY + Math.round(span * 0.6);
    wisePathTop = Math.max(minY, Math.min(maxY - 8, proposedTop));
    wisePathBottom = Math.max(wisePathTop + 8, Math.min(maxY, proposedBottom));
    wisePosition.x = wiseBaseX;
    wisePosition.y = Math.max(wisePathTop, Math.min(wisePathBottom, wisePosition.y));
  }

  function resetWiseWalker(){
    updateWiseWalkBounds();
    wiseDirection = MC_DIRECTIONS.down;
    wiseFrameIndex = 1;
    wiseFrameTimer = 0;
    wiseMoving = false;
    wiseTargetY = null;
    wisePauseTimer = randomBetween(1.2, 2.6);
    wiseHeadingUp = false;
    wisePosition.x = wiseBaseX;
    wisePosition.y = wisePathBottom;
  }

  function resetKgWalker(){
    kgirlDirection = MC_DIRECTIONS.down;
    kgirlFrameIndex = 1;
    kgirlFrameTimer = 0;
    kgirlMoving = false;
    kgirlTarget = null;
    kgirlPauseTimer = randomBetween(0.8, 2.4);
    const baseFrames = KGIRL_FRAME_RECTS[MC_DIRECTIONS.down];
    const reference = baseFrames ? baseFrames[1] : {sw: KGIRL_FRAME_WIDTH, sh: KGIRL_FRAME_HEIGHT};
    const destWidth = Math.max(1, Math.round(reference.sw * KGIRL_RENDER_SCALE));
    const destHeight = Math.max(1, Math.round(reference.sh * KGIRL_RENDER_SCALE));
    const halfWidth = Math.max(6, destWidth / 2);
    const minX = halfWidth + KGIRL_WALK_PADDING.x;
    const maxX = ADVENTURE_WORLD_WIDTH - (halfWidth + KGIRL_WALK_PADDING.x);
    const minY = Math.max(destHeight + KGIRL_WALK_PADDING.top, waveCollisionY + 6);
    const maxY = bh - KGIRL_WALK_PADDING.bottom;
    const spawnX = Math.max(minX, Math.min(maxX, Math.round((minX + maxX) / 2 + bw * 0.18)));
    const spawnY = Math.max(minY, Math.min(maxY, Math.round(bh * 0.82)));
    kgirlPosition.x = spawnX;
    kgirlPosition.y = spawnY;
  }

  function pickKgWalkerTarget(minX, maxX, minY, maxY){
    for(let attempt = 0; attempt < 6; attempt++){
      const tx = randomBetween(minX, maxX);
      const ty = randomBetween(minY, maxY);
      if(Math.hypot(tx - kgirlPosition.x, ty - kgirlPosition.y) >= 28){
        return {x: tx, y: ty};
      }
    }
    return {
      x: Math.max(minX, Math.min(maxX, kgirlPosition.x)),
      y: Math.max(minY, Math.min(maxY, kgirlPosition.y))
    };
  }

  function updateKgWalker(dt){
    if(isAdventureDialogueActive()){
      kgirlTarget = null;
      if(kgirlMoving){
        kgirlMoving = false;
        kgirlFrameIndex = 1;
        kgirlFrameTimer = 0;
      }
      kgirlPauseTimer = Math.max(kgirlPauseTimer, 0.4);
      return;
    }
    const framesForDirection = KGIRL_FRAME_RECTS[kgirlDirection] || KGIRL_FRAME_RECTS[MC_DIRECTIONS.down];
    const referenceFrame = framesForDirection ? framesForDirection[Math.min(framesForDirection.length - 1, Math.max(0, kgirlFrameIndex))] : {sw: KGIRL_FRAME_WIDTH, sh: KGIRL_FRAME_HEIGHT};
    const destWidth = Math.max(1, Math.round(referenceFrame.sw * KGIRL_RENDER_SCALE));
    const destHeight = Math.max(1, Math.round(referenceFrame.sh * KGIRL_RENDER_SCALE));
    const halfWidth = Math.max(6, destWidth / 2);
    const minX = halfWidth + KGIRL_WALK_PADDING.x;
    const maxX = ADVENTURE_WORLD_WIDTH - (halfWidth + KGIRL_WALK_PADDING.x);
    const minY = Math.max(destHeight + KGIRL_WALK_PADDING.top, waveCollisionY + 4);
    const maxY = bh - KGIRL_WALK_PADDING.bottom;

    if(kgirlTarget){
      kgirlTarget.x = Math.max(minX, Math.min(maxX, kgirlTarget.x));
      kgirlTarget.y = Math.max(minY, Math.min(maxY, kgirlTarget.y));
    }

    if(!kgirlTarget){
      if(kgirlPauseTimer > 0){
        kgirlPauseTimer = Math.max(0, kgirlPauseTimer - dt);
      }else{
        kgirlTarget = pickKgWalkerTarget(minX, maxX, minY, maxY);
      }
    }

    if(kgirlTarget){
      const dx = kgirlTarget.x - kgirlPosition.x;
      const dy = kgirlTarget.y - kgirlPosition.y;
      const dist = Math.hypot(dx, dy);
      if(dist > 1.2){
        const step = KGIRL_WALK_SPEED * dt;
        const travel = Math.min(step, dist);
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        kgirlPosition.x += nx * travel;
        kgirlPosition.y += ny * travel;
        kgirlMoving = true;
        if(Math.abs(nx) > Math.abs(ny)){
          kgirlDirection = nx > 0 ? MC_DIRECTIONS.right : MC_DIRECTIONS.left;
        }else{
          kgirlDirection = ny > 0 ? MC_DIRECTIONS.down : MC_DIRECTIONS.up;
        }
        kgirlFrameTimer += dt;
        if(kgirlFrameTimer >= KGIRL_FRAME_DURATION){
          kgirlFrameTimer -= KGIRL_FRAME_DURATION;
          kgirlFrameIndex = (kgirlFrameIndex + 1) % KGIRL_FRAME_COUNT;
        }
      }else{
        kgirlPosition.x = kgirlTarget.x;
        kgirlPosition.y = kgirlTarget.y;
        kgirlTarget = null;
        kgirlMoving = false;
        kgirlFrameIndex = 1;
        kgirlFrameTimer = 0;
        kgirlPauseTimer = randomBetween(2.4, 4.6);
      }
    }else if(kgirlMoving){
      kgirlMoving = false;
      kgirlFrameIndex = 1;
      kgirlFrameTimer = 0;
    }

    kgirlPosition.x = Math.max(minX, Math.min(maxX, kgirlPosition.x));
    kgirlPosition.y = Math.max(minY, Math.min(maxY, kgirlPosition.y));
  }

  function updateWiseWalker(dt){
    updateWiseWalkBounds();
    wisePosition.x = wiseBaseX;
    if(finalFadeActive){
      wiseTargetY = null;
      if(wiseMoving){
        wiseMoving = false;
        wiseFrameIndex = 1;
        wiseFrameTimer = 0;
      }
      return;
    }
    if(dialogueContext === 'wise' && isDialogueBoxVisible()){
      wiseTargetY = null;
      if(wiseMoving){
        wiseMoving = false;
        wiseFrameIndex = 1;
        wiseFrameTimer = 0;
      }
      wisePauseTimer = Math.max(wisePauseTimer, 0.4);
      return;
    }
    if(isAdventureDialogueActive()){
      wiseTargetY = null;
      if(wiseMoving){
        wiseMoving = false;
        wiseFrameIndex = 1;
        wiseFrameTimer = 0;
      }
      return;
    }
    if(!wiseTargetY){
      if(wisePauseTimer > 0){
        wisePauseTimer = Math.max(0, wisePauseTimer - dt);
      }else{
        wiseHeadingUp = !wiseHeadingUp;
        wiseTargetY = wiseHeadingUp ? wisePathTop : wisePathBottom;
      }
    }
    if(typeof wiseTargetY === 'number'){
      const dy = wiseTargetY - wisePosition.y;
      const dist = Math.abs(dy);
      if(dist > 0.6){
        const step = WISE_WALK_SPEED * dt;
        const travel = Math.min(step, dist);
        wisePosition.y += Math.sign(dy) * travel;
        wiseDirection = dy > 0 ? MC_DIRECTIONS.down : MC_DIRECTIONS.up;
        wiseMoving = true;
        wiseFrameTimer += dt;
        if(wiseFrameTimer >= WISE_FRAME_DURATION){
          wiseFrameTimer -= WISE_FRAME_DURATION;
          wiseFrameIndex = (wiseFrameIndex + 1) % WISE_FRAME_COUNT;
        }
      }else{
        wisePosition.y = wiseTargetY;
        wiseTargetY = null;
        wiseMoving = false;
        wiseFrameIndex = 1;
        wiseFrameTimer = 0;
        wisePauseTimer = randomBetween(1.6, 3.4);
      }
    }else if(wiseMoving){
      wiseMoving = false;
      wiseFrameIndex = 1;
      wiseFrameTimer = 0;
    }
    wisePosition.y = Math.max(wisePathTop, Math.min(wisePathBottom, wisePosition.y));
  }

  function getWiseWalkerDrawRect(){
    const frames = WISE_FRAME_RECTS[wiseDirection] || WISE_FRAME_RECTS[MC_DIRECTIONS.down];
    if(!frames || frames.length === 0) return null;
    const frame = frames[(wiseFrameIndex + WISE_FRAME_COUNT) % WISE_FRAME_COUNT];
    const width = Math.max(1, Math.round(frame.sw * WISE_RENDER_SCALE));
    const height = Math.max(1, Math.round(frame.sh * WISE_RENDER_SCALE));
    return {
      x: Math.round(wisePosition.x - width / 2),
      y: Math.round(wisePosition.y - height),
      width,
      height
    };
  }

  function getKgWalkerDrawRect(){
    const frames = KGIRL_FRAME_RECTS[kgirlDirection] || KGIRL_FRAME_RECTS[MC_DIRECTIONS.down];
    if(!frames || frames.length === 0) return null;
    const frame = frames[(kgirlFrameIndex + KGIRL_FRAME_COUNT) % KGIRL_FRAME_COUNT];
    const width = Math.max(1, Math.round(frame.sw * KGIRL_RENDER_SCALE));
    const height = Math.max(1, Math.round(frame.sh * KGIRL_RENDER_SCALE));
    return {
      x: Math.round(kgirlPosition.x - width / 2),
      y: Math.round(kgirlPosition.y - height),
      width,
      height
    };
  }

  function handleAdventureClick(e){
    const pointer = getAdventurePointerWorldPosition(e);
    if(!pointer) return false;
    if(finalFadeActive){
      e.preventDefault();
      return true;
    }
    if(isAdventureDialogueActive()){
      e.preventDefault();
      advanceActiveDialogue();
      return true;
    }
    const wiseRect = getWiseWalkerDrawRect();
    if(wiseRect && pointer.worldX >= wiseRect.x && pointer.worldX <= wiseRect.x + wiseRect.width && pointer.worldY >= wiseRect.y && pointer.worldY <= wiseRect.y + wiseRect.height){
      e.preventDefault();
      cancelAutoMove();
      startWiseDialogue();
      return true;
    }
    const kgRect = getKgWalkerDrawRect();
    if(kgRect && pointer.worldX >= kgRect.x && pointer.worldX <= kgRect.x + kgRect.width && pointer.worldY >= kgRect.y && pointer.worldY <= kgRect.y + kgRect.height){
      e.preventDefault();
      cancelAutoMove();
      const driftwoodCount = getInventoryCountByType('driftwood');
      startKgDialogue(driftwoodCount);
      return true;
    }
    const target = findCollectibleAt(pointer.worldX, pointer.worldY);
    if(target){
      if(withinPickupRange(target)){
        if(!collectBeachDecor(target)) return false;
        cancelAutoMove();
        e.preventDefault();
        return true;
      }
      beginAutoMove(target.x, target.y, target);
      e.preventDefault();
      return true;
    }

    beginAutoMove(pointer.worldX, pointer.worldY, null);
    e.preventDefault();
    return true;
  }

  function drawAdventureWaves(){
    const baseSurface = WAVE_BASELINE + waveVerticalOffset;
    const foamSurface = Math.min(bh - 1, Math.max(0, waveSurfaceY));
    const troughLimit = Math.max(12, waveForeshoreY);
    const foamPhase = waveShapePhase * 0.6;

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    for(let x=0; x<ADVENTURE_WORLD_WIDTH; x++){
      const crestPrimary = Math.sin(waveShapePhase + x * WAVE_PRIMARY_FREQUENCY) * WAVE_EDGE_AMPLITUDE;
      const crestSecondary = Math.sin(waveShapePhase * 0.55 + x * WAVE_SECONDARY_FREQUENCY) * (WAVE_EDGE_AMPLITUDE * 0.4);
      const targetHeight = Math.round(baseSurface + crestPrimary + crestSecondary);
      const columnHeight = Math.max(troughLimit, Math.min(bh - 2, targetHeight));
      const foamThickness = 2 + Math.floor((Math.sin(foamPhase + x * 0.18) + 1) * 1.2);
      for(let y=0; y<columnHeight; y++){
        const distanceFromSurface = columnHeight - y;
        let color;
        if(distanceFromSurface <= foamThickness){
          color = WAVE_FOAM_COLORS[distanceFromSurface % WAVE_FOAM_COLORS.length];
        }else{
          const depthRatio = y / Math.max(1, columnHeight - 1);
          const paletteIndex = Math.min(WAVE_DEPTH_COLORS.length - 1, Math.floor(depthRatio * WAVE_DEPTH_COLORS.length));
          color = WAVE_DEPTH_COLORS[paletteIndex];
          if(paletteIndex >= 2 && pseudoRandom(x * 131 + y * 197) > 0.997){
            color = '#4c91c2';
          }
        }
        bctx.fillStyle = color;
        bctx.fillRect(x, y, 1, 1);
      }
    }

    const foamBandY = foamSurface;
    const foamBaseHeight = 1;
    bctx.globalAlpha = 0.45;
    bctx.fillStyle = '#f2fbff';
    for(let x=0; x<ADVENTURE_WORLD_WIDTH; x+=3){
      const offset = Math.round(Math.sin(foamPhase + x * 0.17) * 1.4);
      const y = Math.max(0, Math.min(bh - 1, foamBandY - 1 + offset));
      bctx.fillRect(x, y, 3, foamBaseHeight + 1);
    }
    bctx.globalAlpha = 0.22;
    bctx.fillStyle = '#ffffff';
    for(let x=1; x<ADVENTURE_WORLD_WIDTH; x+=4){
      const offset = Math.round(Math.sin(foamPhase * 0.8 + x * 0.21 + Math.PI / 3) * 1.1);
      const y = Math.max(0, Math.min(bh - 1, foamBandY + offset));
      bctx.fillRect(x, y, 1, 1);
    }
    bctx.restore();
  }

  function getBeachDecorDrawRect(deco){
    if(!deco) return null;
    const img = getBeachDecorImage(deco.type);
    if(!img) return null;
    if(img.width <= 0 || img.height <= 0) return null;
    const scale = getBeachDecorScale(deco.type);
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));
    if(width <= 0 || height <= 0) return null;
    const baseY = Math.round(deco.y);
    return {
      img,
      x: Math.round(deco.x - width / 2),
      y: baseY - height,
      width,
      height
    };
  }

  function drawBeachDecor(){
    if(beachDecor.length === 0) return;
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    for(const deco of beachDecor){
      if(deco.collected) continue;
      const rect = getBeachDecorDrawRect(deco);
      if(!rect) continue;
      const {img, x: destX, y: destY, width, height} = rect;
      if(!img) continue;
      if(deco.flip){
        bctx.save();
        bctx.scale(-1, 1);
        bctx.drawImage(img, -(destX + width), destY, width, height);
        bctx.restore();
      }else{
        bctx.drawImage(img, destX, destY, width, height);
      }
    }
    bctx.restore();
  }

  function drawWiseWalker(){
    if(!wiseSpriteReady) return;
    const frames = WISE_FRAME_RECTS[wiseDirection] || WISE_FRAME_RECTS[MC_DIRECTIONS.down];
    if(!frames || frames.length === 0) return;
    const frame = frames[(wiseFrameIndex + WISE_FRAME_COUNT) % WISE_FRAME_COUNT];
    const destWidth = Math.max(1, Math.round(frame.sw * WISE_RENDER_SCALE));
    const destHeight = Math.max(1, Math.round(frame.sh * WISE_RENDER_SCALE));
    const destX = Math.round(wisePosition.x - destWidth / 2);
    const destY = Math.round(wisePosition.y - destHeight);
    const shadowWidth = Math.max(6, Math.round(destWidth * 0.72));
    const shadowHeight = Math.max(2, Math.round(destHeight * 0.24));
    const shadowY = Math.round(wisePosition.y - Math.max(1, shadowHeight / 2));

    bctx.save();
    bctx.globalAlpha = 0.24;
    bctx.fillStyle = '#b29264';
    bctx.beginPath();
    bctx.ellipse(wisePosition.x, shadowY + shadowHeight / 2, shadowWidth / 2, shadowHeight / 2, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(
      wiseSprite,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      destX,
      destY,
      destWidth,
      destHeight
    );
    bctx.restore();
  }

  function drawKgWalker(){
    if(!kgirlSpriteReady) return;
    const frames = KGIRL_FRAME_RECTS[kgirlDirection] || KGIRL_FRAME_RECTS[MC_DIRECTIONS.down];
    if(!frames || frames.length === 0) return;
    const frame = frames[(kgirlFrameIndex + KGIRL_FRAME_COUNT) % KGIRL_FRAME_COUNT];
    const destWidth = Math.max(1, Math.round(frame.sw * KGIRL_RENDER_SCALE));
    const destHeight = Math.max(1, Math.round(frame.sh * KGIRL_RENDER_SCALE));
    const destX = Math.round(kgirlPosition.x - destWidth / 2);
    const destY = Math.round(kgirlPosition.y - destHeight);
    const shadowWidth = Math.max(4, Math.round(destWidth * 0.68));
    const shadowHeight = Math.max(2, Math.round(destHeight * 0.22));
    const shadowY = Math.round(kgirlPosition.y - Math.max(1, shadowHeight / 2));

    bctx.save();
    bctx.globalAlpha = 0.22;
    bctx.fillStyle = '#b29264';
    bctx.beginPath();
    bctx.ellipse(kgirlPosition.x, shadowY + shadowHeight / 2, shadowWidth / 2, shadowHeight / 2, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(
      kgirlSprite,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      destX,
      destY,
      destWidth,
      destHeight
    );
    bctx.restore();
  }

  function drawMainCharacter(){
    if(!mcSpriteReady) return;
    const frames = MC_FRAME_RECTS[mcDirection] || MC_FRAME_RECTS[MC_DIRECTIONS.down];
    const frame = frames[(mcFrameIndex + MC_FRAME_COUNT) % MC_FRAME_COUNT];
    const destWidth = Math.max(1, Math.round(frame.sw * MC_RENDER_SCALE));
    const destHeight = Math.max(1, Math.round(frame.sh * MC_RENDER_SCALE));
    const destX = Math.round(mcPosition.x - destWidth / 2);
    const destY = Math.round(mcPosition.y - destHeight);

    const shadowWidth = Math.max(4, Math.round(destWidth * 0.82));
    const shadowHeight = Math.max(2, Math.round(destHeight * 0.22));
    const shadowY = Math.round(mcPosition.y - Math.max(1, shadowHeight / 2));
    bctx.save();
    bctx.globalAlpha = 0.25;
    bctx.fillStyle = '#b29264';
    bctx.beginPath();
    bctx.ellipse(mcPosition.x, shadowY + shadowHeight / 2, shadowWidth / 2, shadowHeight / 2, 0, 0, Math.PI * 2);
    bctx.fill();
    bctx.restore();

    bctx.imageSmoothingEnabled = false;
    bctx.drawImage(
      mcSprite,
      frame.sx,
      frame.sy,
      frame.sw,
      frame.sh,
      destX,
      destY,
      destWidth,
      destHeight
    );
  }

  function drawAdventureScene(){
    bctx.fillStyle = SAND_COLOR;
    bctx.fillRect(0,0,bw,bh);

    const cameraOffset = Math.round(cameraX);
    bctx.save();
    bctx.translate(-cameraOffset, 0);

    bctx.fillStyle = SAND_COLOR;
    bctx.fillRect(0,0,ADVENTURE_WORLD_WIDTH,bh);

    drawAdventureWaves();
    const sandStartY = Math.max(0, Math.min(bh, waveForeshoreY + 2));

    const shorelineHeight = Math.min(6, Math.max(0, bh - sandStartY));
    if(shorelineHeight > 0){
      bctx.save();
      bctx.globalAlpha = 0.18;
      bctx.fillStyle = '#e3cc96';
      bctx.fillRect(0, Math.max(0, sandStartY - 2), ADVENTURE_WORLD_WIDTH, shorelineHeight);
      bctx.restore();
    }

    bctx.save();
    bctx.imageSmoothingEnabled = false;
    for(let y=0; y<bh; y+=6){
      if(y < sandStartY) continue;
      const t = y / bh;
      const shade = lerpColor('#e8c491', '#f9e3bd', Math.min(1, t * 0.85));
      bctx.globalAlpha = 0.08;
      bctx.fillStyle = shade;
      bctx.fillRect(0, y, ADVENTURE_WORLD_WIDTH, 3);
    }
    bctx.restore();

    bctx.save();
    const grainColors = ['#d9ba82', '#f6e0b7', '#cfa974'];
    for(let gy=0; gy<bh; gy+=3){
      if(gy < sandStartY) continue;
      const offset = (gy % 6 === 0) ? 0 : 2;
      for(let gx=offset; gx<ADVENTURE_WORLD_WIDTH; gx+=4){
        const seed = gy * 971 + gx * 233;
        if(pseudoRandom(seed) > 0.68) continue;
        const color = grainColors[Math.floor(pseudoRandom(seed * 1.7) * grainColors.length)];
        bctx.globalAlpha = 0.22 + pseudoRandom(seed * 3.3) * 0.2;
        bctx.fillStyle = color;
        bctx.fillRect(gx, gy, 1, 1);
        if(pseudoRandom(seed * 5.1) < 0.2){
          bctx.fillRect(gx + 1, gy, 1, 1);
        }
      }
    }
    bctx.restore();

    drawBeachDecor();
    const actors = [
      {y: wisePosition.y, draw: drawWiseWalker},
      {y: kgirlPosition.y, draw: drawKgWalker},
      {y: mcPosition.y, draw: drawMainCharacter}
    ];
    actors.sort((a, b) => a.y - b.y);
    for(const actor of actors){
      if(typeof actor.draw === 'function') actor.draw();
    }

    bctx.restore();

    drawPickupNotification();
  }

  function drawPickupNotification(){
    if(!pickupMessage || !pickupMessageCanvas) return;
    const duration = PICKUP_MESSAGE_DURATION;
    const fade = PICKUP_MESSAGE_FADE;
    const t = pickupMessageElapsed;
    if(t >= duration) return;
    let alpha = 1;
    if(t < fade){
      alpha = Math.max(0, Math.min(1, t / fade));
    }else if(t > duration - fade){
      alpha = Math.max(0, Math.min(1, (duration - t) / fade));
    }
    if(alpha <= 0.001) return;
    const drawX = Math.round((bw - pickupMessageCanvas.width) / 2);
    const drawY = Math.max(0, bh - pickupMessageCanvas.height - 6);
    bctx.save();
    bctx.imageSmoothingEnabled = false;
    if(pickupMessageShadowCanvas){
      bctx.globalAlpha = alpha * 0.45;
      bctx.drawImage(
        pickupMessageShadowCanvas,
        0,
        0,
        pickupMessageShadowCanvas.width,
        pickupMessageShadowCanvas.height,
        drawX + 1,
        drawY + 1,
        pickupMessageShadowCanvas.width,
        pickupMessageShadowCanvas.height
      );
    }
    bctx.globalAlpha = alpha;
    bctx.drawImage(
      pickupMessageCanvas,
      0,
      0,
      pickupMessageCanvas.width,
      pickupMessageCanvas.height,
      drawX,
      drawY,
      pickupMessageCanvas.width,
      pickupMessageCanvas.height
    );
    bctx.restore();
  }

  function easeInOutQuad(t){
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  // Draw pixelated leafless trees (background, in front of sky but behind plank)
  // Requirements implemented:
  // - multiple trees across the horizon
  // - trunks thicker at the bottom and taper upward
  // - branching forks that recursively split and get thinner
  // - branches are pixelated (drawn with fillRect) and end before the very top
  function drawTrees(){ drawTreesTo(bctx); }

  // Draw pixelated leafless trees (background, in front of sky but behind plank)
  // This variant draws into a provided context so we can cache it into an offscreen canvas.
  function drawTreesTo(ctx){
    const bctx = ctx; // shadow outer bctx
    // Two opaque layers for depth (both opaque per request)
    const treeLayers = [
      {count: 16, dark: palette.woodDarker, maxWidth: 10, seedOffset: 3}, // farther but opaque
      {count: 14, dark: palette.woodDarker, maxWidth: 18, seedOffset: 97} // nearer, darker
    ];

  // end branches lower on the screen: increase topLimit so branches stop sooner (lower Y)
  const topLimit = Math.floor(bh * 0.50); // branches will stop around halfway down the buffer

    for(const layer of treeLayers){
      // leaf palette (light greens, multiple shades)
      const leafColors = ['#dff7d6','#c9f0b8','#b2e99a','#94d86a','#6fbe3a'];
      for(let i=0;i<layer.count;i++){
        const s = i * 11.13 + (layer.seedOffset||0);
        // spread trees evenly across width with small jitter to avoid empty edges
        const frac = (i + pseudoRandom(s*2.0)*0.8) / Math.max(1, (layer.count - 1));
        const baseX = Math.floor(frac * (bw - 8)) + 4;
        const x0 = Math.max(4, Math.min(bw-4, baseX + Math.floor((pseudoRandom(s*3.3)-0.5) * 8)));

        // trunk width and height
        const trunkBase = 4 + Math.floor(pseudoRandom(s*2.2) * (layer.maxWidth - 4));
  // make trunks shorter so branches extend above them
  // previous: 0.36 + random*0.48 (taller trunks)
  // new: 0.12 + random*0.18 => trunks ~12%..30% of buffer height
  const trunkHeight = Math.floor(bh * (0.12 + pseudoRandom(s*3.3) * 0.18));
        const bottomY = bh - 2;
        const topY = bottomY - trunkHeight;

        // draw trunk as stacked pixel columns that taper upward
        // but make the top portion split smoothly into branches instead of ending thick
        const upperSplitStart = topY + Math.floor(trunkHeight * 0.35); // start splitting here
        for(let y = bottomY; y > topY; y--){
          const t = (bottomY - y) / trunkHeight; // 0..1
          // stronger taper near the top so trunk narrows earlier
          let taperFactor = 1 - t * 0.9;
          if(y <= upperSplitStart) taperFactor = 0.18 + (t * 0.3); // make it thin near split region
          const w = Math.max(1, Math.round(trunkBase * taperFactor));
          const jitter = Math.floor((pseudoRandom((s+y)*0.7)-0.5) * 1.6);
          const px = Math.round(x0 - w/2 + jitter);
          bctx.fillStyle = layer.dark;
          bctx.fillRect(px, y, w, 1);
        }

  // Branch generator: more origins and stronger branching so trunks split into many forks
        const branches = [];
        const originCount = 5 + Math.floor(pseudoRandom(s*4.4)*6); // even more origins
        for(let oi=0; oi<originCount; oi++){
          // bias more origins toward upper trunk so many branches come off near the top
          const frac = (oi + 1) / (originCount + 1);
          const oy = bottomY - Math.floor(frac * trunkHeight) - Math.floor(pseudoRandom(s*5.1+oi)*3);
          const dir = pseudoRandom(s*6.2 + oi) > 0.5 ? -1 : 1;
          const len = 8 + Math.floor(pseudoRandom(s*7.3 + oi) * 26);
          const thickness = Math.max(1, Math.round(trunkBase * (0.9 - (frac)*0.85)));
          branches.push({x: x0, y: oy, len, thickness, angle: dir * (0.08 + pseudoRandom(s*8.9+oi)*0.9), depth:0, seed: s + oi});
        }

        // Add a cluster of branches at the very top of the trunk so trunk visually splits
        // Ensure these branches are not thicker than the trunk at that height to avoid sudden fat spikes
        const topClusterCount = 2 + Math.floor(pseudoRandom(s*9.9)*4);
        for(let ci=0; ci<topClusterCount; ci++){
          const angleDir = (pseudoRandom(s*11.1 + ci) > 0.5) ? 1 : -1;
          const ang = angleDir * (0.35 + pseudoRandom(s*12.3 + ci) * 0.9);
          const l = Math.floor(trunkHeight * (0.22 + pseudoRandom(s*13.7 + ci) * 0.7)) + 6;
          // candidate thickness based on trunkBase but capped so it doesn't exceed a safe fraction
          const thCandidate = Math.max(1, Math.round(trunkBase * (0.45 + pseudoRandom(s*14.2+ci)*0.5)));
          const thCap = Math.max(1, Math.round(trunkBase * 0.7));
          const th = Math.min(thCandidate, thCap);
          branches.push({x: x0, y: topY + Math.floor(pseudoRandom(s*14.9+ci)*4), len: l, thickness: th, angle: ang, depth:0, seed: s + 100 + ci});
        }

  // collect branch pixel positions so we can place leaf clumps behind them
  const branchPixels = [];

  while(branches.length){
          const b = branches.shift();
          const steps = Math.max(3, Math.floor(b.len));
          let bx = b.x;
          let by = b.y;
          const angle = b.angle;
          let lastThickness = b.thickness; // track last drawn thickness to avoid thickening
          for(let si=0; si<steps; si++){
            const t = si / steps;
            // base taper along branch length
            const rawThickness = Math.max(1, Math.round(b.thickness * (1 - t*0.92)));
            const wob = (pseudoRandom(b.seed + si*1.7)-0.5) * 1.1; // more wobble
            bx += Math.round(Math.sin(angle + wob) * (1 + Math.floor(pseudoRandom(b.seed+si)*1)));
            by -= 1; // climb up
            if(by < topLimit) break;

            // enforce vertical taper cap: by the time branch approaches topLimit it must have tapered by ~2/3
            const verticalSpan = Math.max(1, b.y - topLimit);
            const verticalProgress = Math.min(1, (b.y - by) / verticalSpan);
            // much stronger taper so branches thin earlier and finish lower on screen
            const strongFactor = 1.2; // stronger taper multiplier
            const eased = Math.pow(verticalProgress, 1.35); // stronger ease-in so taper happens earlier
            const taperCap = Math.max(1, Math.round(b.thickness * (1 - strongFactor * eased)));

            // choose the smaller of raw taper and vertical cap, and never allow thickening
            let curThickness = Math.min(rawThickness, taperCap);
            if(curThickness > lastThickness) curThickness = lastThickness;
            lastThickness = curThickness;

            for(let tw=0; tw<curThickness; tw++){
              const drawX = Math.round(bx) - Math.floor(curThickness/2) + tw;
              const drawY = Math.round(by);
              // record branch pixel (we'll draw branches after leaves so leaves appear behind)
              branchPixels.push({x: drawX, y: drawY, seed: b.seed + si + tw});
            }
          }

          // higher branching chance and allow deeper recursion for lots of forks
          // also allow very thin branches to occasionally spawn children so the network fans out
          if(b.depth < 5 && by > topLimit + 2){
            // base child count depends on thickness but thin branches still sometimes fork
            const bias = Math.min(0.9, Math.max(0.1, b.thickness / 6));
            const childCount = Math.max(1, Math.floor(bias * (1 + Math.floor(pseudoRandom(b.seed*3.1)*3))));
            for(let ci=0; ci<childCount; ci++){
              const newLen = Math.max(2, Math.floor(b.len * (0.28 + pseudoRandom(b.seed*4.2+ci)*0.75)));
              // compute child thickness as a fraction of parent so it never exceeds parent thickness
              const frac = (0.28 + pseudoRandom(b.seed*5.7+ci)*0.6); // 0.28..0.88
              let newTh = Math.max(1, Math.round(b.thickness * frac));
              if(newTh >= b.thickness && b.thickness > 1) newTh = Math.max(1, b.thickness - 1);
              const dirSign = (pseudoRandom(b.seed*6.3+ci) > 0.5) ? 1 : -1;
              // wider angle variation so branches fan out more
              const newAngle = angle + dirSign * (0.15 + pseudoRandom(b.seed*7.4+ci)*1.1);
              branches.push({x: bx, y: by, len: newLen, thickness: newTh, angle: newAngle, depth: b.depth+1, seed: b.seed + ci + 1});
            }
          }
        }

        // Draw leaves behind branches: larger, denser clumps to reduce negative sky space
        for(const bp of branchPixels){
          // much higher density: more likely to place leaves (about 85% chance)
          if(pseudoRandom(bp.seed * 1.7) > 0.85) continue;
          // clump size 3..12 for fluffy look
          const clump = 3 + Math.floor(pseudoRandom(bp.seed * 2.9) * 10);
          // choose a primary cluster shape size (1..3) - sometimes draw 2x2/3x3 blocks
          for(let ci=0; ci<clump; ci++){
            // offsets biased upward and around to create fluffy clusters
            const angle = pseudoRandom(bp.seed * (3.3 + ci)) * Math.PI * 2;
            const radius = Math.floor(pseudoRandom(bp.seed * (4.4 + ci)) * 4.5);
            const ox = Math.round(Math.cos(angle) * radius + (pseudoRandom(bp.seed*7.1+ci)-0.5) * 1.5);
            const oy = -Math.abs(Math.round(Math.sin(angle) * radius + (pseudoRandom(bp.seed*8.2+ci)-0.2) * 1.2));
            const lx = bp.x + ox;
            const ly = bp.y + oy;
            if(lx < 0 || lx >= bw || ly < 0 || ly >= bh) continue;
            const color = leafColors[Math.floor(pseudoRandom(bp.seed * (5.1 + ci)) * leafColors.length)];
            // sometimes draw a small block (2x2 or 3x3) to make leaves look chunkier
            const blockChance = pseudoRandom(bp.seed * (9.1 + ci));
            if(blockChance > 0.6){
              const blockSize = 2 + Math.floor(pseudoRandom(bp.seed * (10.2 + ci)) * 2); // 2 or 3
              for(let bx=0; bx<blockSize; bx++){
                for(let by=0; by<blockSize; by++){
                  const px = lx + bx - Math.floor(blockSize/2);
                  const py = ly + by - Math.floor(blockSize/2);
                  if(px < 0 || px >= bw || py < 0 || py >= bh) continue;
                  bctx.fillStyle = color;
                  bctx.fillRect(px, py, 1, 1);
                }
              }
            }else{
              bctx.fillStyle = color;
              bctx.fillRect(lx, ly, 1, 1);
            }

            // add a few scattered tiny filler leaves around the clump to close gaps
            if(pseudoRandom(bp.seed * (11.3 + ci)) > 0.6){
              const fillerCount = 1 + Math.floor(pseudoRandom(bp.seed * (12.4 + ci)) * 3);
              for(let f=0; f<fillerCount; f++){
                const fx = lx + Math.round((pseudoRandom(bp.seed*(13.5+f+ci))-0.5) * 3);
                const fy = ly - Math.abs(Math.round((pseudoRandom(bp.seed*(14.6+f+ci))-0.2) * 3));
                if(fx < 0 || fx >= bw || fy < 0 || fy >= bh) continue;
                const fcol = leafColors[Math.floor(pseudoRandom(bp.seed * (15.7 + f + ci)) * leafColors.length)];
                bctx.fillStyle = fcol;
                bctx.fillRect(fx, fy, 1, 1);
              }
            }
          }
        }

        // Now draw branch pixels on top of leaves so branches remain visible
        for(const bp of branchPixels){
          bctx.fillStyle = layer.dark;
          bctx.fillRect(bp.x, bp.y, 1, 1);
        }
      }
    }
  }

  function draw(){
    try{
      bctx.clearRect(0,0,bw,bh);
      dialoguePortraitDraw = null;
      inventoryButtonRect = null;

      if(currentScene === SCENE.title){
        if(postState === POST_STATE.idle){
          function renderStaticIfNeeded(){
            if(!staticDirty) return;
            staticCtx.clearRect(0,0,bw,bh);
            drawSkyTo(staticCtx);
            drawTreesTo(staticCtx);
            staticDirty = false;
          }
          renderStaticIfNeeded();

          // blit cached static background into the working buffer
          bctx.drawImage(staticCanvas, 0, 0);

          // draw dynamic parts on top of cached background
          const plankW = Math.round(bw * 0.64);
          const plankH = Math.round(bh * 0.32); // taller plank per request
          const px = Math.round(bw/2);
          const py = Math.round(bh/2);
          drawPetals('back');
          drawPlank(px, py, plankW, plankH);
          const titleY = Math.round(py - Math.max(6, plankH * 0.18));
          drawTitleText(px, titleY, 'driftwood rpg', 'cooler than an AI girlfriend');
          drawPressPrompt(px, py, plankH);
          drawPetals('front');
          drawClouds();

          if(typeof fadeT !== 'undefined' && fadeT > 0){
            bctx.save();
            bctx.globalAlpha = Math.min(1, fadeT);
            bctx.fillStyle = FADE_TARGET;
            bctx.fillRect(0,0,bw,bh);
            bctx.restore();
          }

          const hasMessages = messages.length > 0;
          const currentIndex = Math.min(messageIndex, Math.max(0, messages.length - 1));
          const alpha = Math.max(0, Math.min(1, messageAlpha));
          if(hasMessages && alpha > 0 && currentIndex >= 0){
            drawFinalMessage(messages[currentIndex], alpha);
            if(messageIndex < messages.length && !messageFadeOut){
              drawBottomScreenPrompt(alpha);
            }
          }
        }else{
          // maintain the soft fade target colour behind the post-sequence overlays
          bctx.fillStyle = FADE_TARGET;
          bctx.fillRect(0,0,bw,bh);
        }

        drawPostSequenceOverlay();
        drawNamePromptOverlay();
        drawQuestPromptOverlay();
      }else if(currentScene === SCENE.adventure){
        drawAdventureScene();
        drawDialogueOverlay();
      }
      if(currentScene === SCENE.adventure && (adventureFadeActive || adventureFade > 0)){
        const fadeAlpha = Math.max(0, Math.min(1, adventureFade));
        if(fadeAlpha > 0){
          bctx.save();
          bctx.globalAlpha = fadeAlpha;
          bctx.fillStyle = '#000';
          bctx.fillRect(0,0,bw,bh);
          bctx.restore();
        }
      }

      drawInventoryOverlay();
      drawQuestsOverlay();
      drawInventoryButton();
      drawJournalButton();
      drawQuestsButton();

      if(finalFadeActive || finalFadeProgress > 0){
        const fadeAlpha = Math.max(0, Math.min(1, finalFadeProgress));
        if(fadeAlpha > 0){
          bctx.save();
          bctx.globalAlpha = fadeAlpha;
          bctx.fillStyle = '#000';
          bctx.fillRect(0,0,bw,bh);
          bctx.restore();
        }
      }
    }catch(err){
      // show error message in buffer so it's visible in preview
      bctx.clearRect(0,0,bw,bh);
      bctx.fillStyle = '#000';
      bctx.fillRect(0,0,bw,bh);
      bctx.fillStyle = '#ffaaaa';
      bctx.font = '10px monospace';
      bctx.fillText('Render error:', 8, 20);
      bctx.fillText(err && err.message ? err.message : String(err), 8, 36);
      console.error('Title-screen render error:', err);
    }

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    drawPortraitOverlay();
  }

  function drawPortraitOverlay(){
    if(!dialoguePortraitDraw) return;
    const {image, source, x, y, width, height, alpha} = dialoguePortraitDraw;
    if(!image || !source) return;
    if(image === pingPortrait && !pingPortraitReady) return;
    if(width <= 0 || height <= 0 || alpha <= 0) return;
    let fadeMultiplier = 1;
    if(finalFadeActive || finalFadeProgress > 0){
      fadeMultiplier = Math.max(0, 1 - Math.max(0, Math.min(1, finalFadeProgress)));
    }
    const combinedAlpha = Math.max(0, Math.min(1, alpha * fadeMultiplier));
    if(combinedAlpha <= 0) return;
    const scaleX = canvas.width / bw;
    const scaleY = canvas.height / bh;
    const drawX = x * scaleX;
    const drawY = y * scaleY;
    const drawW = width * scaleX;
    const drawH = height * scaleY;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = combinedAlpha;
    ctx.drawImage(
      image,
      source.x,
      source.y,
      source.width,
      source.height,
      drawX,
      drawY,
      drawW,
      drawH
    );
    ctx.restore();
  }

  function init(){
    const maxWidth = Math.min(window.innerWidth * 0.9, 960);
    canvas.style.width = maxWidth + 'px';
    canvas.style.height = (maxWidth * (bh/bw)) + 'px';
    window.addEventListener('resize', debounce(resizeCanvas, 120));
    resizeCanvas();
    // create petals and start animation loop
  createPetals(34);
  createClouds(6);
  resetAudioTracks();
  setTrackTarget(TITLE_MUSIC_TRACK, TITLE_MUSIC_TARGET_VOLUME, TITLE_MUSIC_FADE_IN);
  ensureTypeSoundPool();
    let last = performance.now();
    function tick(now){
      // Use the real elapsed time but cap to a reasonable upper bound so
      // slow frames still advance animations instead of appearing to crawl.
      // Previous cap (0.05) was too small when the drawing got heavier; raise
      // it so petals and other time-based motion keep up even at lower FPS.
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;

      if(currentScene === SCENE.title){
        updatePetals(dt);
        updateClouds(dt);
        // advance fade when active
        if(fadeActive && fadeT < 1){
          fadeT = Math.min(1, fadeT + dt / FADE_DURATION);
        }
        if(fadeActive && fadeT >= 1 && messageIndex < messages.length && !messageFadeOut){
          messageTargetAlpha = 1;
        }
        if(messageAlpha < messageTargetAlpha){
          messageAlpha = Math.min(messageTargetAlpha, messageAlpha + MESSAGE_FADE_SPEED * dt);
        }else if(messageAlpha > messageTargetAlpha){
          messageAlpha = Math.max(messageTargetAlpha, messageAlpha - MESSAGE_FADE_SPEED * dt);
        }
        if(messageFadeOut && messageAlpha <= 0.001){
          messageAlpha = 0;
          messageFadeOut = false;
          messageTargetAlpha = 0;
          if(messageIndex === 0){
            setTrackTarget(TITLE_MUSIC_TRACK, 0, TITLE_MUSIC_FADE_OUT);
          }
          messageIndex++;
          if(messageIndex < messages.length){
            messageTargetAlpha = 1;
          }else{
            messageSequenceDone = true;
            beginPostSequence();
          }
        }
        updatePostSequence(dt);
        if(finalFadeActive && finalFadeProgress < 1){
          finalFadeProgress = Math.min(1, finalFadeProgress + dt / FINAL_FADE_DURATION);
        }
        if(adventureScenePending && finalFadeProgress >= 1){
          beginAdventureScene();
        }
      }else if(currentScene === SCENE.adventure){
        updateAdventure(dt);
      }

      // redraw buffer and blit
      draw();
      requestAnimationFrame(tick);
    }
  requestAnimationFrame(tick);
  // key/click handlers to start transition and to respond to space after fade
    function startFade(){
      if(!fadeActive){
        primeTypeSoundPool();
        fadeActive = true;
        fadeT = 0;
        setTrackTarget(ADVENTURE_MUSIC_TRACK, 0, ADVENTURE_MUSIC_FADE_OUT);
        messageIndex = 0;
        messageSequenceDone = false;
        messageAlpha = 0;
        messageTargetAlpha = 0;
        messageFadeOut = false;
        postState = POST_STATE.idle;
        blackFade = 0;
        blackHoldTimer = 0;
        eyeCrackProgress = 0;
        eyeCloseProgress = 0;
        eyeFinalProgress = 0;
        ambienceSoftened = false;
        huhTriggered = false;
        huhTimer = 0;
        huhPlaying = false;
        ambienceFullFadeQueued = false;
        ambienceFullFadeTimer = 0;
        pingPending = false;
        pingDelayTimer = 0;
        pingTriggered = false;
        pingBoxProgress = 0;
        dialogueManager.setSequence(INITIAL_PING_DIALOGUES);
        namePromptCompleted = false;
        namePromptState = 'hidden';
        namePromptProgress = 0;
        namePromptCaretTimer = 0;
        namePromptLayout = null;
        nameInput = '';
        playerName = '';
        postGreetingPending = false;
        questPromptState = 'hidden';
        questPromptProgress = 0;
        questPromptLayout = null;
        questPromptPending = false;
        questAccepted = false;
        questPromptReady = false;
        finalFadeActive = false;
        finalFadeProgress = 0;
        inventoryButtonEnabled = false;
        inventoryButtonPending = false;
        inventoryVisible = false;
        questsVisible = false;
        questsPanelLayout = null;
        questButtonRect = null;
        currencyDisplayRect = null;
        inventoryPanelLayout = null;
        dismissAdventureDialogue();
        dialogueContext = 'intro';
        dialoguePortraitKey = 'ping';
        cancelAutoMove();
        resetAudioTracks([TITLE_MUSIC_TRACK]);
        const titleTrack = getTrackByName(TITLE_MUSIC_TRACK);
        if(titleTrack && titleTrack.currentTargetVolume <= 0){
          setTrackTarget(TITLE_MUSIC_TRACK, TITLE_MUSIC_TARGET_VOLUME, TITLE_MUSIC_FADE_IN);
        }
      }
    }
    function onKeyDown(e){
      if(currentScene === SCENE.adventure && isAdventureDialogueActive()){
        if(handleAdventureKeyDown(e)) return;
      }
      if(currentScene === SCENE.title){
        if(TITLE_SCREEN_IGNORED_KEY_CODES.has(e.code) || TITLE_SCREEN_IGNORED_KEYS.has(e.key)){
          return;
        }
        if(namePromptState === 'visible'){
          if(handleNamePromptKey(e)) return;
          e.preventDefault();
          return;
        }
      }
      if(e.code === 'KeyI'){
        if(currentScene === SCENE.adventure && isAdventureDialogueActive()){
          e.preventDefault();
          return;
        }
        if(inventoryVisible && inventoryViewMode === INVENTORY_VIEW.journal && journalEditing){
          // allow typing the letter "i" while journaling
        }else{
          if(!inventoryButtonEnabled && !inventoryVisible) return;
          e.preventDefault();
          if(questsVisible){
            closeQuestsPanel();
          }
          toggleInventory();
          return;
        }
      }
      if(questsVisible){
        if(e.code === 'Escape'){
          e.preventDefault();
          closeQuestsPanel();
        }else if(e.code === 'KeyQ'){
          e.preventDefault();
          closeQuestsPanel();
          return;
        }else{
          e.preventDefault();
          return;
        }
      }
      let journalHandled = false;
      if(inventoryVisible && inventoryViewMode === INVENTORY_VIEW.journal){
        journalHandled = handleJournalKeyDown(e);
        if(journalHandled) return;
      }
      if(inventoryVisible){
        if(e.code === 'Escape'){
          if(inventoryViewMode === INVENTORY_VIEW.journal){
            closeJournalView();
          }else{
            closeInventory();
          }
        }
        e.preventDefault();
        return;
      }
      if(currentScene === SCENE.adventure){
        if(handleAdventureKeyDown(e)) return;
        return;
      }
      // first key press starts fade
      if(!fadeActive){ startFade(); return; }
      if(handleQuestPromptKey(e)) return;
      if(questPromptState !== 'hidden'){ e.preventDefault(); return; }
      if(handleNamePromptKey(e)) return;
      // when fade complete, space can be used to continue (placeholder action)
      if(fadeT >= 1 && e.code === 'Space'){
        if(e.repeat){
          e.preventDefault();
          return;
        }
        if(messageIndex < messages.length){
          if(!messageFadeOut && messageAlpha > 0.05){
            if(messageIndex === 0){
              setTrackTarget(TITLE_MUSIC_TRACK, 0, TITLE_MUSIC_FADE_OUT);
            }
            messageTargetAlpha = 0;
            messageFadeOut = true;
          }
        }else if(postState === POST_STATE.idle){
          console.log('Space pressed after message dismissed — ready for next scene.');
        }else if(postState === POST_STATE.done && pingTriggered){
          if(pingTypingActive){
            dialogueManager.skipTyping();
          }else if(pingDialogueIndex < pingDialogues.length - 1){
            dialogueManager.advance();
          }else if(postGreetingPending){
            dialogueManager.setSequence(POST_GREETING_DIALOGUES, {startTyping: true});
            postGreetingPending = false;
            questPromptPending = true;
            questPromptReady = false;
          }else if(questPromptPending && questPromptState === 'hidden'){
            if(!questPromptReady){
              e.preventDefault();
              return;
            }
            e.preventDefault();
            pingTriggered = false;
            pingBoxProgress = 0;
            dialogueManager.clear();
            startQuestPrompt();
          }
        }
      }
    }
    function onKeyUp(e){
      if(currentScene === SCENE.adventure){
        handleAdventureKeyUp(e);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    function onCanvasMouseMove(e){
      if(!inventoryVisible) return;
      const rect = canvas.getBoundingClientRect();
      if(!rect || rect.width === 0 || rect.height === 0){
        if(inventoryHoverSlotIndex !== -1) inventoryHoverSlotIndex = -1;
        return;
      }
      const scaleX = bw / rect.width;
      const scaleY = bh / rect.height;
      const localX = (e.clientX - rect.left) * scaleX;
      const localY = (e.clientY - rect.top) * scaleY;
      if(localX < 0 || localY < 0 || localX > bw || localY > bh){
        if(inventoryHoverSlotIndex !== -1) inventoryHoverSlotIndex = -1;
        return;
      }
      if(inventoryViewMode === INVENTORY_VIEW.journal){
        if(inventoryHoverSlotIndex !== -1) inventoryHoverSlotIndex = -1;
        return;
      }
      updateInventoryHoverSlotFromPoint(localX, localY);
    }
    function onCanvasMouseLeave(){
      if(inventoryHoverSlotIndex !== -1){
        inventoryHoverSlotIndex = -1;
      }
    }
    canvas.addEventListener('mousemove', onCanvasMouseMove);
    canvas.addEventListener('mouseleave', onCanvasMouseLeave);
    window.addEventListener('click', (e)=>{
      if(handleInventoryPointer(e)) return;
      if(inventoryVisible) return;
      if(currentScene === SCENE.adventure){
        if(handleAdventureClick(e)) return;
        return;
      }
      if(questPromptState === 'visible' && handleQuestPromptClick(e)) return;
      if(namePromptState === 'visible' && handleNamePromptClick(e)) return;
      if(questPromptState !== 'hidden') return;
      if(!fadeActive) startFade();
    });
  }

  function debounce(fn, t){
    let id = null;
    return (...args) => {
      clearTimeout(id);
      id = setTimeout(()=>fn(...args), t);
    };
  }

  window.addEventListener('load', init);
  try{ window.matchMedia('(resolution)').addEventListener('change', resizeCanvas, {passive:true}); }catch(e){}

})();
