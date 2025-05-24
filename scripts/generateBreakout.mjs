import fs from "node:fs/promises";
import { request, gql } from "graphql-request";
import { createCanvas } from "canvas";
import GIFEncoder from "gifencoder";

/* ── env ─────────────────────────────────────────────────────────── */
const token    = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USER;
const endpoint = "https://api.github.com/graphql";

/* ── 1. fetch calendar ───────────────────────────────────────────── */
const { user } = await request(
  endpoint,
  gql`
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays { weekday contributionCount color }
            }
          }
        }
      }
    }`,
  { login: username },
  { Authorization: `Bearer ${token}` }
);

const weeks = user.contributionsCollection.contributionCalendar.weeks;
const rows = 7, cols = weeks.length;
const grid = Array.from({ length: rows }, () => Array(cols).fill(null));
weeks.forEach((w, c) =>
  w.contributionDays.forEach(d => {
    if (d.contributionCount) grid[d.weekday][c] = d.color ?? "#9be9a8";
  })
);

/* ── 2. HTML output ──────────────────────────────────────────────── */
const bricksJson = JSON.stringify(grid);
const html = `<!doctype html><html lang="en"><meta charset="utf-8">
<title>${username} • GitHub Breakout</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;display:flex;align-items:center;justify-content:center;background:#0d1117;color:#c9d1d9;font-family:system-ui,Roboto,sans-serif}canvas{box-shadow:0 0 8px #000a;border-radius:4px}</style>
<canvas id=c></canvas><script>
const bricks=${bricksJson},CELL=12,GAP=2,R=5,rows=bricks.length,cols=bricks[0].length;
const cv=document.getElementById('c');cv.width=cols*(CELL+GAP)-GAP;cv.height=rows*(CELL+GAP)-GAP+60;
const cx=cv.getContext('2d'),pad={w:60,h:10,x:cv.width/2-30,y:cv.height-30,s:4},ball={x:cv.width/2,y:cv.height-60,r:R,vx:3,vy:-3};
function step(){ball.x+=ball.vx;ball.y+=ball.vy;
  if(ball.x<R||ball.x>cv.width-R)ball.vx*=-1;if(ball.y<R)ball.vy*=-1;if(ball.y>cv.height){ball.x=cv.width/2;ball.y=cv.height-60;ball.vx=Math.random()>.5?3:-3;ball.vy=-3;}
  pad.x+=Math.sign(ball.x-(pad.x+pad.w/2))*pad.s;pad.x=Math.max(0,Math.min(cv.width-pad.w,pad.x));
  if(ball.y+R>pad.y&&ball.x>pad.x&&ball.x<pad.x+pad.w)ball.vy=-Math.abs(ball.vy);
  const c=Math.floor(ball.x/(CELL+GAP)),r=Math.floor(ball.y/(CELL+GAP));
  if(r>=0&&r<rows&&c>=0&&c<cols&&bricks[r][c]){bricks[r][c]=null;ball.vy*=-1;}}
function draw(){cx.clearRect(0,0,cv.width,cv.height);
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const col=bricks[r][c];if(!col)continue;cx.fillStyle=col;cx.fillRect(c*(CELL+GAP),r*(CELL+GAP),CELL,CELL);}
  cx.fillStyle='#ff6a00';cx.beginPath();cx.arc(ball.x,ball.y,R,0,6.283);cx.fill();
  cx.fillStyle='#58a6ff';cx.fillRect(pad.x,pad.y,pad.w,pad.h);}
(function loop(){step();draw();requestAnimationFrame(loop);})();
<\/script>`;
await fs.mkdir("dist", { recursive: true });
await fs.writeFile("dist/breakout.html", html, "utf8");

/* ── 3. GIF output ──────────────────────────────────────────────── */
const CELL = 12, GAP = 2, R = 5;
const W = cols * (CELL + GAP) - GAP;
const H = rows * (CELL + GAP) - GAP + 60;

const canvas = createCanvas(W, H);
const ctx    = canvas.getContext("2d");
const enc    = new GIFEncoder(W, H);
enc.start();
enc.setRepeat(0);      // loop forever
enc.setDelay(10);      // 10 ms → 100 fps (minimum reliable delay)
enc.setQuality(12);    // bigger number = smaller file; 10→8 000f ≈ 14 MB

const pad2  = { w: 60, h: 10, x: W / 2 - 30, y: H - 30, s: 4 };
const ball2 = { x: W / 2, y: H - 60, r: R, vx: 4, vy: -4 };   // ↑ speed a bit
const bricks2 = grid.map(r => r.slice());

function bricksLeft() {
  for (const row of bricks2) for (const cell of row) if (cell) return true;
  return false;
}
function step2() {
  ball2.x += ball2.vx; ball2.y += ball2.vy;
  if (ball2.x < R || ball2.x > W - R) ball2.vx *= -1;
  if (ball2.y < R) ball2.vy *= -1;
  if (ball2.y > H) { ball2.x = W / 2; ball2.y = H - 60; }
  pad2.x += Math.sign(ball2.x - (pad2.x + pad2.w / 2)) * pad2.s;
  pad2.x = Math.max(0, Math.min(W - pad2.w, pad2.x));
  if (ball2.y + R > pad2.y && ball2.x > pad2.x && ball2.x < pad2.x + pad2.w) ball2.vy = -Math.abs(ball2.vy);
  const c = Math.floor(ball2.x / (CELL + GAP));
  const r = Math.floor(ball2.y / (CELL + GAP));
  if (r >= 0 && r < rows && c >= 0 && c < cols && bricks2[r][c]) {
    bricks2[r][c] = null;
    ball2.vy *= -1;
  }
}
function draw2() {
  ctx.fillStyle = "#0d1117"; ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (bricks2[r][c]) { ctx.fillStyle = bricks2[r][c]; ctx.fillRect(c*(CELL+GAP), r*(CELL+GAP), CELL, CELL); }
  ctx.fillStyle = "#ff6a00"; ctx.beginPath(); ctx.arc(ball2.x, ball2.y, R, 0, 6.283); ctx.fill();
  ctx.fillStyle = "#58a6ff"; ctx.fillRect(pad2.x, pad2.y, pad2.w, pad2.h);
}

/* --- speed tuning --- */
const SPEED_MULT = 7;    // 3‒6 is a good range; higher = faster
const FRAME_CAP  = 8000; // safety to keep file < 100 MB

for (let f = 0; f < FRAME_CAP && bricksLeft(); f++) {
  /* advance physics SPEED_MULT times before we draw 1 frame */
  for (let s = 0; s < SPEED_MULT; s++) step2();
  draw2();
  enc.addFrame(ctx);
}

enc.finish();
await fs.writeFile("dist/breakout.gif", enc.out.getData());
