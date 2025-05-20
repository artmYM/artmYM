import fs from "node:fs/promises";
import { request, gql } from "graphql-request";

const token    = process.env.GITHUB_TOKEN;
const username = process.env.GITHUB_USER;
const endpoint = "https://api.github.com/graphql";

const query = gql`
  query ($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              weekday          # 0 = Sun … 6 = Sat
              date
              contributionCount
              color            # GitHub’s colour ramp
            }
          }
        }
      }
    }
  }
`;

const { user } = await request(
  endpoint,
  query,
  { login: username },
  { Authorization: `Bearer ${token}` }
);

const weeks = user.contributionsCollection.contributionCalendar.weeks;

const rows = 7;
const cols = weeks.length;
const grid = Array.from({ length: rows }, () => Array(cols).fill(null));

weeks.forEach((week, col) => {
  week.contributionDays.forEach(day => {
    const { weekday, contributionCount, color } = day;
    grid[weekday][col] =
      contributionCount === 0 ? null : color ?? "#9be9a8";
  });
});

const bricksJson = JSON.stringify(grid);

const html = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${username} 🔹 GitHub Breakout</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    html,body{margin:0;padding:0;background:#0d1117;color:#c9d1d9;
      display:flex;align-items:center;justify-content:center;
      height:100vh;font-family:system-ui,Segoe UI,Roboto,sans-serif;}
    canvas{box-shadow:0 0 8px #000a;border-radius:4px;}
    h1{position:absolute;top:12px;font-size:1rem;left:12px;margin:0;
       opacity:.6;user-select:none;}
  </style>
</head>
<body>
<h1>Breakout ↺ auto-play &middot; refresh to reset</h1>
<canvas id="c"></canvas>
<script>
/* ==== Brick data injected by generator ================================================ */
const bricksData = ${bricksJson};  // 2-D array, null = empty cell
/* ==== Canvas + game loop ============================================================== */
const cell = 12, gap = 2;
const rows = bricksData.length;
const cols = bricksData[0].length;

const canvas  = document.getElementById("c");
canvas.width  = cols * (cell + gap) - gap;
canvas.height = rows * (cell + gap) - gap + 60;
const ctx = canvas.getContext("2d");

const paddle = { w: 60, h: 10, x: canvas.width/2 - 30, y: canvas.height - 30, speed: 4 };
const ball   = { x: canvas.width/2, y: canvas.height - 60, r:5, vx:3, vy:-3 };

function resetBall(){
  ball.x = canvas.width/2; ball.y = canvas.height - 60;
  ball.vx = Math.random()>.5?3:-3; ball.vy = -3;
}

function step(){
  /* move ball */
  ball.x += ball.vx; ball.y += ball.vy;
  if (ball.x < ball.r || ball.x > canvas.width - ball.r) ball.vx *= -1;
  if (ball.y < ball.r) ball.vy *= -1;
  if (ball.y > canvas.height) resetBall();

  /* auto-paddle follows ball */
  if (paddle.x + paddle.w/2 < ball.x) paddle.x += paddle.speed;
  else if (paddle.x + paddle.w/2 > ball.x) paddle.x -= paddle.speed;
  paddle.x = Math.max(0, Math.min(canvas.width - paddle.w, paddle.x));

  /* paddle hit */
  if (ball.y + ball.r > paddle.y &&
      ball.x > paddle.x && ball.x < paddle.x + paddle.w){
    ball.vy *= -1; ball.y = paddle.y - ball.r;
  }

  /* brick collisions */
  const col = Math.floor(ball.x / (cell+gap));
  const row = Math.floor(ball.y / (cell+gap));
  if (row >=0 && row < rows && col >=0 && col < cols && bricksData[row][col]){
    bricksData[row][col] = null;
    ball.vy *= -1;
  }
}

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  /* bricks */
  for (let r=0;r<rows;++r){
    for (let c=0;c<cols;++c){
      const colr = bricksData[r][c];
      if (!colr) continue;
      const x = c*(cell+gap), y = r*(cell+gap);
      ctx.fillStyle = colr;
      ctx.fillRect(x,y,cell,cell);
    }
  }

  /* ball */
  ctx.beginPath();
  ctx.arc(ball.x,ball.y,ball.r,0,2*Math.PI);
  ctx.fillStyle = "#ff6a00";
  ctx.fill();

  /* paddle */
  ctx.fillStyle = "#58a6ff";
  ctx.fillRect(paddle.x,paddle.y,paddle.w,paddle.h);
}

(function loop(){
  step(); draw(); requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;

await fs.mkdir("dist", { recursive: true });
await fs.writeFile("dist/breakout.html", html, "utf8");
console.log("✅  dist/breakout.html generated");
