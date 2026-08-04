// src/main.js — build mode, shop, save/load, simulated rewarded ad
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const moneyLabel = document.getElementById('money');
  const btnSpeed = document.getElementById('btn-speed');
  const btnReset = document.getElementById('btn-reset');
  const btnSave = document.getElementById('btn-save');
  const btnLoad = document.getElementById('btn-load');
  const btnWatchAd = document.getElementById('btn-watch-ad');
  const adOverlay = document.getElementById('adOverlay');
  const adCountdown = document.getElementById('adCountdown');

  const GRID = {cols:12, rows:10, size:64};
  const offsetX = 20;
  const offsetY = 20;
  canvas.width = 960; canvas.height = 640;

  // Map of tiles
  const map = [];
  for(let y=0;y<GRID.rows;y++){
    const row = [];
    for(let x=0;x<GRID.cols;x++) row.push({type:'empty'});
    map.push(row);
  }

  // Initial money
  let money = 500;
  let speedMultiplier = 1;

  // Tools
  let currentTool = null;
  document.querySelectorAll('.shop-item').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      document.querySelectorAll('.shop-item').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      currentTool = btn.dataset.tool;
    });
  });

  // Prepopulate conveyors and entities to match previous demo path for instant play
  const initialPath = [
    {x:1,y:4},{x:2,y:4},{x:3,y:4},{x:4,y:4},{x:5,y:4},{x:6,y:4},{x:7,y:4},{x:8,y:4},{x:9,y:4},{x:10,y:4},
    {x:10,y:5},{x:10,y:6},{x:9,y:6},{x:8,y:6},{x:7,y:6},{x:6,y:6},{x:5,y:6},{x:4,y:6},{x:3,y:6},{x:2,y:6},{x:1,y:6}
  ];
  // fill conveyors with direction based on next cell
  for(let i=0;i<initialPath.length;i++){
    const c = initialPath[i];
    const next = initialPath[Math.min(i+1, initialPath.length-1)];
    let dir = 'right';
    if(next.x > c.x) dir='right';
    else if(next.x < c.x) dir='left';
    else if(next.y > c.y) dir='down';
    else if(next.y < c.y) dir='up';
    map[c.y][c.x] = {type:'conveyor', dir};
  }
  // place printer and seller where before
  map[3][1] = {type:'printer', dir:'down', printerType:'basic'}; // at PRINTER_CELL x:1 y:3
  map[7][1] = {type:'seller'}; // SELLER_CELL x:1 y:7

  // Products
  let products = [];
  let lastSpawn = 0;

  // helper
  function drawText(ctx, text, x, y){ ctx.fillText(text, x, y); }

  function spawnFromPrinter(printerCell){
    // spawn only if there is a conveyor in forward direction
    const dx = ({left:-1,right:1,up:0,down:0}[printerCell.dir]||0);
    const dy = ({left:0,right:0,up:-1,down:1}[printerCell.dir]||0);
    const nx = printerCell.x + dx, ny = printerCell.y + dy;
    if(nx<0||ny<0||nx>=GRID.cols||ny>=GRID.rows) return;
    if(map[ny][nx].type !== 'conveyor') return; // needs a conveyor to output
    const baseVal = printerCell.printerType === 'fast' ? 20 : 10;
    const p = {
      id: Math.random().toString(36).slice(2,9),
      value: baseVal,
      cell:{x:nx,y:ny},
      offset: 0, // pixels along direction
      dir: map[ny][nx].dir,
      size: 14,
      spawnTime: performance.now()
    };
    products.push(p);
  }

  function update(dt){
    // spawn from printers
    lastSpawn += dt * speedMultiplier;
    // each printer has its own speed: for simplicity, basic 2500ms, fast 900ms
    for(let y=0;y<GRID.rows;y++){
      for(let x=0;x<GRID.cols;x++){
        const t = map[y][x];
        if(t.type==='printer'){
          const interval = t.printerType==='fast' ? 900 : 2500;
          if(!t._timer) t._timer = 0;
          t._timer += dt * speedMultiplier;
          if(t._timer >= interval){ spawnFromPrinter({x,y, ...t}); t._timer = 0; }
        }
      }
    }

    // move products along conveyors
    const pixelsPerMs = 0.06 * GRID.size; // baseline
    for(let i=products.length-1;i>=0;i--){
      const prod = products[i];
      // determine movement direction from current tile
      const tile = map[prod.cell.y][prod.cell.x];
      if(!tile) { products.splice(i,1); continue; }
      if(tile.type === 'seller'){
        money += prod.value; products.splice(i,1); continue;
      }
      // direction from tile
      const dir = tile.dir || prod.dir;
      const move = pixelsPerMs * dt * speedMultiplier;
      prod.offset += move;
      while(prod.offset >= GRID.size){
        // step to next cell
        prod.offset -= GRID.size;
        let nx = prod.cell.x + (dir==='right'?1:dir==='left'?-1:0);
        let ny = prod.cell.y + (dir==='down'?1:dir==='up'?-1:0);
        if(nx<0||ny<0||nx>=GRID.cols||ny>=GRID.rows){ products.splice(i,1); break; }
        prod.cell.x = nx; prod.cell.y = ny;
        const nextTile = map[ny][nx];
        if(!nextTile || nextTile.type === 'empty'){
          // fall off conveyor: remove
          products.splice(i,1); break;
        }
        if(nextTile.type === 'seller'){
          money += prod.value; products.splice(i,1); break;
        }
        // update dir to new tile's dir
        if(nextTile.type === 'conveyor') prod.dir = nextTile.dir;
        // loop continues
      }
    }
  }

  function gridToPixel(cell){ return {x: cell.x * GRID.size + GRID.size/2 + offsetX, y: cell.y * GRID.size + GRID.size/2 + offsetY}; }

  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save(); ctx.translate(offsetX, offsetY);
    // grid
    ctx.lineWidth = 1; ctx.strokeStyle = '#e6eef5';
    for(let x=0;x<=GRID.cols;x++){ ctx.beginPath(); ctx.moveTo(x*GRID.size,0); ctx.lineTo(x*GRID.size,GRID.rows*GRID.size); ctx.stroke(); }
    for(let y=0;y<=GRID.rows;y++){ ctx.beginPath(); ctx.moveTo(0,y*GRID.size); ctx.lineTo(GRID.cols*GRID.size,y*GRID.size); ctx.stroke(); }

    // draw tiles
    for(let y=0;y<GRID.rows;y++){
      for(let x=0;x<GRID.cols;x++){
        const t = map[y][x];
        const px = x*GRID.size + GRID.size/2, py = y*GRID.size + GRID.size/2;
        if(t.type === 'conveyor'){
          ctx.fillStyle = '#dceff6'; roundRect(ctx, px - GRID.size/2 + 8, py - 12, GRID.size-16, 24, 6); ctx.fill();
          // arrow
          ctx.fillStyle = '#a6cbe0';
          ctx.beginPath();
          if(t.dir === 'right'){ ctx.moveTo(px-6,py); ctx.lineTo(px+2,py-6); ctx.lineTo(px+2,py+6); }
          else if(t.dir === 'left'){ ctx.moveTo(px+6,py); ctx.lineTo(px-2,py-6); ctx.lineTo(px-2,py+6); }
          else if(t.dir === 'up'){ ctx.moveTo(px,py+6); ctx.lineTo(px-6,py-2); ctx.lineTo(px+6,py-2); }
          else if(t.dir === 'down'){ ctx.moveTo(px,py-6); ctx.lineTo(px-6,py+2); ctx.lineTo(px+6,py+2); }
          ctx.closePath(); ctx.fill();
        } else if(t.type === 'printer'){
          ctx.save(); ctx.translate(px,py);
          ctx.fillStyle = '#ffd59e'; roundRect(ctx,-28,-28,56,56,8); ctx.fill(); ctx.fillStyle='#ff7a7a'; ctx.fillRect(-6,-30,12,10);
          ctx.fillStyle='#0f172a'; ctx.font='10px sans-serif'; ctx.fillText(t.printerType==='fast'?'Fast':'Basic',-20,26);
          ctx.restore();
        } else if(t.type === 'seller'){
          ctx.save(); ctx.translate(px,py);
          ctx.fillStyle = '#e7f9f9'; roundRect(ctx,-28,-20,56,40,8); ctx.fill(); ctx.fillStyle = '#4cc0c0'; ctx.fillRect(-26,-12,16,24); ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.fillText('$', -22, 6);
          ctx.restore();
        }
      }
    }

    // draw products
    for(const prod of products){
      const cellPx = gridToPixel(prod.cell);
      // compute position offset in direction
      const dir = prod.dir;
      let dx = 0, dy = 0;
      if(dir==='right') dx = prod.offset; else if(dir==='left') dx = -prod.offset;
      else if(dir==='down') dy = prod.offset; else if(dir==='up') dy = -prod.offset;
      ctx.save(); ctx.translate(cellPx.x + dx - offsetX, cellPx.y + dy - offsetY);
      ctx.fillStyle = '#ffdf5e'; ctx.beginPath(); ctx.arc(0,0,prod.size,0,Math.PI*2); ctx.fill(); ctx.fillStyle='#8b5cf6'; ctx.font='10px sans-serif'; ctx.fillText('$'+prod.value, -10, 4);
      ctx.restore();
    }

    ctx.restore();
  }

  function roundRect(ctx,x,y,w,h,r){ const radius=r||4; ctx.beginPath(); ctx.moveTo(x+radius,y); ctx.arcTo(x+w,y,x+w,y+h,radius); ctx.arcTo(x+w,y+h,x,y+h,radius); ctx.arcTo(x,y+h,x,y,radius); ctx.arcTo(x,y,x+w,y,radius); ctx.closePath(); }

  // input handling: place items
  canvas.addEventListener('contextmenu', e=>e.preventDefault());
  canvas.addEventListener('mousedown', e=>{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left - offsetX; const my = e.clientY - rect.top - offsetY;
    const gx = Math.floor(mx / GRID.size); const gy = Math.floor(my / GRID.size);
    if(gx<0||gy<0||gx>=GRID.cols||gy>=GRID.rows) return;
    if(e.button === 2){ // right click: erase
      const prev = map[gy][gx]; if(prev.type !== 'empty') map[gy][gx] = {type:'empty'}; return;
    }
    if(!currentTool) return;
    if(currentTool === 'erase'){ map[gy][gx] = {type:'empty'}; return; }
    // purchase and place
    const costMap = { 'printer-basic':100, 'printer-fast':400, 'conveyor':25, 'seller':200 };
    const cost = costMap[currentTool] || 0;
    if(money < cost){ alert('Not enough money'); return; }
    // place logic
    if(currentTool === 'conveyor'){
      // default direction to right; if clicking near top/bottom/left/right edge of cell, rotate
      const dir = 'right'; map[gy][gx] = {type:'conveyor', dir}; money -= cost; return;
    }
    if(currentTool.startsWith('printer')){
      const printerType = currentTool === 'printer-fast' ? 'fast' : 'basic'; map[gy][gx] = {type:'printer', dir:'right', printerType}; money -= cost; return;
    }
    if(currentTool === 'seller'){
      map[gy][gx] = {type:'seller'}; money -= cost; return;
    }
  });

  // save/load
  btnSave.addEventListener('click', ()=>{
    const state = {money, map}; localStorage.setItem('factory_save_v1', JSON.stringify(state)); alert('Saved');
  });
  btnLoad.addEventListener('click', ()=>{
    const raw = localStorage.getItem('factory_save_v1'); if(!raw){ alert('No save found'); return; }
    try{ const state = JSON.parse(raw); if(state.map) { for(let y=0;y<GRID.rows;y++) for(let x=0;x<GRID.cols;x++) map[y][x] = state.map[y][x] || {type:'empty'}; money = state.money || 0; alert('Loaded'); }
    }catch(e){ alert('Failed to load'); }
  });

  // watch ad (simulated). Replace this with real ad SDK integration when ready.
  btnWatchAd.addEventListener('click', ()=>{
    adOverlay.classList.remove('hidden'); let sec = 3; adCountdown.textContent = sec; const iv = setInterval(()=>{ sec--; adCountdown.textContent=sec; if(sec<=0){ clearInterval(iv); adOverlay.classList.add('hidden'); money += 50; alert('Ad reward: $50'); } }, 1000);
  });

  // speed/reset
  document.getElementById('btn-speed').addEventListener('click', ()=>{
    const options=[1,2,4,8]; const idx = options.indexOf(speedMultiplier); speedMultiplier = options[(idx+1)%options.length]; btnSpeed.textContent = `Speed x${speedMultiplier}`;
  });
  btnReset.addEventListener('click', ()=>{ // reset map to initial demo
    for(let y=0;y<GRID.rows;y++) for(let x=0;x<GRID.cols;x++) map[y][x]={type:'empty'};
    // reapply initial path
    for(let i=0;i<initialPath.length;i++){ const c = initialPath[i]; const next = initialPath[Math.min(i+1, initialPath.length-1)]; let dir='right'; if(next.x>c.x)dir='right';else if(next.x<c.x)dir='left';else if(next.y>c.y)dir='down';else if(next.y<c.y)dir='up'; map[c.y][c.x]={type:'conveyor',dir}; }
    map[3][1] = {type:'printer', dir:'down', printerType:'basic'}; map[7][1] = {type:'seller'}; products=[]; money=500; lastSpawn=0;
  });

  // main loop
  let last = performance.now();
  function loop(now){ const dt = now-last; last=now; update(dt); draw(); moneyLabel.textContent = '$'+money; requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  // expose for debugging
  window.__factory = {map, products};
})();
