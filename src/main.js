// src/main.js — minimal prototype: Printer -> Conveyor -> Seller
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const moneyLabel = document.getElementById('money');
  const btnSpeed = document.getElementById('btn-speed');
  const btnReset = document.getElementById('btn-reset');

  const GRID = {cols:12, rows:10, size:64};
  const gridW = GRID.cols * GRID.size;
  const gridH = GRID.rows * GRID.size;

  // Center canvas content if needed
  canvas.width = 960;
  canvas.height = 640;

  // Simple world definition (coordinates in grid cells)
  // Define a conveyor path from printer to seller as an ordered list of cells
  const conveyorPath = [
    {x:1,y:4}, {x:2,y:4}, {x:3,y:4}, {x:4,y:4}, {x:5,y:4}, {x:6,y:4}, {x:7,y:4}, {x:8,y:4}, {x:9,y:4}, {x:10,y:4},
    {x:10,y:5}, {x:10,y:6}, {x:9,y:6}, {x:8,y:6}, {x:7,y:6}, {x:6,y:6}, {x:5,y:6}, {x:4,y:6}, {x:3,y:6}, {x:2,y:6}, {x:1,y:6}
  ];

  const PRINTER_CELL = {x:1,y:3};
  const SELLER_CELL = {x:1,y:7};

  let money = 500;
  let speedMultiplier = 1;

  let products = [];

  // Spawn control
  let lastSpawn = 0;
  const spawnIntervalBase = 2500; // ms

  function gridToPixel(cell){
    return {x: cell.x * GRID.size + GRID.size/2, y: cell.y * GRID.size + GRID.size/2};
  }

  function spawnProduct(){
    const value = 10; // base value
    const size = 18; // visual size
    const start = conveyorPath[0];
    const p = {
      id: Math.random().toString(36).slice(2,9),
      value,
      size,
      pathIndex: 0,
      progress: 0, // 0..1 between path[pathIndex] and path[pathIndex+1]
      spawnTime: performance.now(),
      bounce: 0
    };
    products.push(p);
    console.log('spawn', p.id);
  }

  function sellProduct(p){
    money += p.value;
    console.log('sold', p.id, 'for $'+p.value, 'money now', money);
  }

  function update(dt){ // dt in ms
    // spawn logic (printer speed could be an upgrade later)
    lastSpawn += dt * speedMultiplier;
    const interval = spawnIntervalBase; // could be affected by printer speed
    if(lastSpawn >= interval){
      const toSpawn = Math.floor(lastSpawn / interval);
      for(let i=0;i<toSpawn;i++) spawnProduct();
      lastSpawn = lastSpawn % interval;
    }

    // update products along conveyor
    const speedPerMs = 0.0006 * GRID.size; // pixels per ms baseline
    for(let i = products.length -1; i>=0; i--){
      const prod = products[i];
      // progress along segments
      const segIdx = prod.pathIndex;
      const a = conveyorPath[segIdx];
      const b = conveyorPath[Math.min(segIdx+1, conveyorPath.length-1)];
      const ax = a.x, ay = a.y, bx = b.x, by = b.y;
      // distance in pixels
      const dist = Math.hypot((bx-ax)*GRID.size, (by-ay)*GRID.size) || GRID.size;
      const travel = (speedPerMs * dt * speedMultiplier) / dist;
      prod.progress += travel;
      prod.bounce = Math.sin((performance.now()-prod.spawnTime)/120) * 2;
      if(prod.progress >= 1){
        if(prod.pathIndex >= conveyorPath.length-1){
          // reached end: drop/sell
          sellProduct(prod);
          products.splice(i,1);
          continue;
        }else{
          prod.pathIndex++;
          prod.progress = prod.progress - 1;
        }
      }
    }
  }

  function getProductPixel(prod){
    // interpolate between path[pathIndex] and next
    const i = prod.pathIndex;
    const a = conveyorPath[i];
    const b = conveyorPath[Math.min(i+1, conveyorPath.length-1)];
    const ax = a.x * GRID.size + GRID.size/2;
    const ay = a.y * GRID.size + GRID.size/2;
    const bx = b.x * GRID.size + GRID.size/2;
    const by = b.y * GRID.size + GRID.size/2;
    const t = prod.progress;
    return {x: ax + (bx-ax)*t, y: ay + (by-ay)*t};
  }

  function drawGrid(){
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#e6eef5';
    for(let x=0;x<=GRID.cols;x++){
      ctx.beginPath(); ctx.moveTo(x*GRID.size,0); ctx.lineTo(x*GRID.size,GRID.rows*GRID.size); ctx.stroke();
    }
    for(let y=0;y<=GRID.rows;y++){
      ctx.beginPath(); ctx.moveTo(0,y*GRID.size); ctx.lineTo(GRID.cols*GRID.size,y*GRID.size); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPrinter(){
    const p = gridToPixel(PRINTER_CELL);
    ctx.save();
    ctx.translate(p.x,p.y);
    // base
    ctx.fillStyle = '#ffd59e';
    roundRect(ctx,-28,-28,56,56,8); ctx.fill();
    // nozzle
    ctx.fillStyle = '#ff7a7a';
    ctx.fillRect(-6,-30,12,10);
    // bed
    ctx.fillStyle = '#fff7f0';
    roundRect(ctx,-18,8,36,8,4); ctx.fill();
    ctx.restore();
  }

  function drawSeller(){
    const p = gridToPixel(SELLER_CELL);
    ctx.save();
    ctx.translate(p.x,p.y);
    ctx.fillStyle = '#e7f9f9'; roundRect(ctx,-28,-20,56,40,8); ctx.fill();
    ctx.fillStyle = '#4cc0c0'; ctx.fillRect(-26,-12,16,24); ctx.fillStyle='#fff'; ctx.font='12px sans-serif'; ctx.fillText('$', -22, 6);
    ctx.restore();
  }

  function drawConveyors(){
    ctx.save();
    ctx.fillStyle = '#dceff6';
    for(const cell of conveyorPath){
      const p = gridToPixel(cell);
      roundRect(ctx, p.x - GRID.size/2 + 6, p.y - 10, GRID.size - 12, 20, 6);
      ctx.fill();
      // arrow
      ctx.fillStyle = '#a6cbe0';
      ctx.beginPath(); ctx.moveTo(p.x-6,p.y); ctx.lineTo(p.x+2,p.y-6); ctx.lineTo(p.x+2,p.y+6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#dceff6';
    }
    ctx.restore();
  }

  function drawProducts(){
    for(const prod of products){
      const pos = getProductPixel(prod);
      ctx.save();
      ctx.translate(pos.x, pos.y - prod.bounce);
      ctx.fillStyle = '#ffdf5e';
      ctx.beginPath(); ctx.arc(0,0,prod.size,0,Math.PI*2); ctx.fill();
      // value mark
      ctx.fillStyle = '#8b5cf6'; ctx.font='10px sans-serif'; ctx.fillText('$'+prod.value, -8, 4);
      ctx.restore();
    }
  }

  function roundRect(ctx,x,y,w,h,r){
    const radius = r || 4;
    ctx.beginPath();
    ctx.moveTo(x+radius,y);
    ctx.arcTo(x+w,y,x+w,y+h,radius);
    ctx.arcTo(x+w,y+h,x,y+h,radius);
    ctx.arcTo(x,y+h,x,y,radius);
    ctx.arcTo(x,y,x+w,y,radius);
    ctx.closePath();
  }

  function render(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    // center grid on canvas
    const offsetX = 20;
    const offsetY = 20;
    ctx.translate(offsetX, offsetY);
    drawGrid();
    drawConveyors();
    drawPrinter();
    drawSeller();
    drawProducts();
    ctx.restore();
  }

  // UI
  btnSpeed.addEventListener('click', ()=>{
    const options = [1,2,4,8];
    const idx = options.indexOf(speedMultiplier);
    speedMultiplier = options[(idx+1)%options.length];
    btnSpeed.textContent = `Speed x${speedMultiplier}`;
  });
  btnReset.addEventListener('click', ()=>{
    products = [];
    money = 500;
    moneyLabel.textContent = '$'+money;
    lastSpawn = 0;
  });

  // main loop
  let last = performance.now();
  function frame(now){
    const dt = now - last;
    last = now;
    update(dt);
    render();
    moneyLabel.textContent = '$'+money;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // initial spawn so the factory begins working
  setTimeout(()=>spawnProduct(), 200);

  // expose for debugging
  window.__factory = {products, spawnProduct, conveyorPath};
})();
