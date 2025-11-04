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
    draw();
  }

  // Draw sky gradient on buffer
  function drawSky(){
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

  // --- petals (cherry blossom blocks) ---
  const petals = [];
  function createPetals(n = 28){
    petals.length = 0;
    for(let i=0;i<n;i++){
      const size = 1 + Math.floor(pseudoRandom(i*1.3) * 4); // 1..4
      const baseX = Math.floor(pseudoRandom(i*3.7) * bw);
      const y = Math.floor(-pseudoRandom(i*5.1) * bh);
      const speed = 8 + Math.floor(pseudoRandom(i*7.9) * 24); // pixels per second
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
        p.speed = 8 + Math.floor(pseudoRandom(p.phase*5.9) * 24);
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

  function draw(){
    try{
      drawSky();
      // draw a background layer of pixelated bare trees (no leaves)
      drawTrees();
      const plankW = Math.round(bw * 0.64);
      const plankH = Math.round(bh * 0.32); // taller plank per request
      const px = Math.round(bw/2);
      const py = Math.round(bh/2);
  // draw petals that are behind the plank first
  drawPetals('back');
  drawPlank(px, py, plankW, plankH);
  drawTitleText(px, py, 'driftwood rpg', 'cooler than an AI girlfriend');
  // draw petals in front of the plank after
  drawPetals('front');
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
  }

  function init(){
    const maxWidth = Math.min(window.innerWidth * 0.9, 960);
    canvas.style.width = maxWidth + 'px';
    canvas.style.height = (maxWidth * (bh/bw)) + 'px';
    window.addEventListener('resize', debounce(resizeCanvas, 120));
    resizeCanvas();
    // create petals and start animation loop
    createPetals(34);
    let last = performance.now();
    function tick(now){
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      updatePetals(dt);
      // redraw buffer and blit
      draw();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
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
