// The painter: everything on screen is drawn from shapes, gradients and the
// world's own state — no images, no sprites, no assets. The canvas keeps a fixed
// 1280x720 backing store and is scaled with CSS to fit the window, so the game
// looks the same at any window size and exactly 1:1 at 1280x720.

import { BLOOM, FIELD, FONT, PALETTE, TURRET, WARDEN } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  const soil = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  soil.addColorStop(0, '#24382a');
  soil.addColorStop(0.55, PALETTE.soil);
  soil.addColorStop(1, PALETTE.soilDark);
  const vignette = ctx.createRadialGradient(640, 360, 300, 640, 360, 760);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.42)');

  function resize() {
    const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
    const width = Math.floor(FIELD.width * scale);
    const height = Math.floor(FIELD.height * scale);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.left = `${Math.floor((window.innerWidth - width) / 2)}px`;
    canvas.style.top = `${Math.floor((window.innerHeight - height) / 2)}px`;
  }
  window.addEventListener('resize', resize);
  resize();

  function circle(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function glowDot(x, y, radius, color, alpha) {
    ctx.globalAlpha = alpha * 0.3;
    circle(x, y, radius * 2.2, color);
    ctx.globalAlpha = alpha;
    circle(x, y, radius, color);
    ctx.globalAlpha = 1;
  }

  function drawDecor(state) {
    for (const item of state.decor) {
      const sway = Math.sin(state.time * 1.2 + item.x * 0.05) * 0.06;
      if (item.kind === 'grass') {
        ctx.strokeStyle = PALETTE.grassTip;
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i += 1) {
          ctx.beginPath();
          ctx.moveTo(item.x + i * 4, item.y);
          ctx.quadraticCurveTo(item.x + i * 5 + sway * 20, item.y - 10 * item.size, item.x + i * 7 + sway * 30, item.y - 16 * item.size);
          ctx.stroke();
        }
      } else if (item.kind === 'flower') {
        const petal = item.hue < 0.5 ? '#ff9ad5' : '#ffd76a';
        ctx.strokeStyle = PALETTE.grassTip;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(item.x, item.y);
        ctx.lineTo(item.x + sway * 20, item.y - 12 * item.size);
        ctx.stroke();
        for (let p = 0; p < 5; p += 1) {
          const a = (p / 5) * Math.PI * 2 + item.angle;
          circle(item.x + Math.cos(a) * 4 * item.size + sway * 20, item.y - 12 * item.size + Math.sin(a) * 4 * item.size, 2.6 * item.size, petal);
        }
        circle(item.x + sway * 20, item.y - 12 * item.size, 2.4 * item.size, '#fff6c9');
      } else if (item.kind === 'stone') {
        ctx.fillStyle = '#3a4a3e';
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, 9 * item.size, 6 * item.size, item.angle, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4d6152';
        ctx.beginPath();
        ctx.ellipse(item.x - 2 * item.size, item.y - 2 * item.size, 4 * item.size, 2.5 * item.size, item.angle, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#d8e6d0';
        ctx.fillRect(item.x - 1.5 * item.size, item.y - 7 * item.size, 3 * item.size, 7 * item.size);
        ctx.fillStyle = item.hue < 0.5 ? '#7ec8ff' : '#c9a7ff';
        ctx.beginPath();
        ctx.arc(item.x, item.y - 7 * item.size, 6 * item.size, Math.PI, 0);
        ctx.fill();
        circle(item.x - 2.5 * item.size, item.y - 9 * item.size, 1.2 * item.size, '#ffffff');
        circle(item.x + 2.5 * item.size, item.y - 8 * item.size, 1 * item.size, '#ffffff');
      }
    }
  }

  function drawBloom(state) {
    const bloom = state.bloom;
    const pulse = 1 + Math.sin(bloom.pulse * 2.1) * 0.045;
    const glow = ctx.createRadialGradient(BLOOM.x, BLOOM.y, 10, BLOOM.x, BLOOM.y, 155);
    const hurt = bloom.hurtFlash > 0;
    glow.addColorStop(0, hurt ? 'rgba(255, 93, 93, 0.5)' : PALETTE.bloomGlow);
    glow.addColorStop(1, 'rgba(255, 122, 217, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(BLOOM.x, BLOOM.y, 155, 0, Math.PI * 2);
    ctx.fill();

    // A ring of stones guards the clearing.
    ctx.fillStyle = '#3a4a3e';
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(BLOOM.x + Math.cos(a) * 62, BLOOM.y + Math.sin(a) * 62, 7, 5, a, 0, Math.PI * 2);
      ctx.fill();
    }

    const petals = 8;
    for (let i = 0; i < petals; i += 1) {
      const a = (i / petals) * Math.PI * 2 + bloom.pulse * 0.25;
      const px = BLOOM.x + Math.cos(a) * 24 * pulse;
      const py = BLOOM.y + Math.sin(a) * 24 * pulse;
      ctx.fillStyle = hurt ? '#ff8f8f' : PALETTE.petal;
      ctx.beginPath();
      ctx.ellipse(px, py, 17 * pulse, 10 * pulse, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(px - Math.cos(a) * 4, py - Math.sin(a) * 4, 8 * pulse, 4.5 * pulse, a, 0, Math.PI * 2);
      ctx.fill();
    }
    glowDot(BLOOM.x, BLOOM.y, 13 * pulse, PALETTE.petalCore, 1);
    circle(BLOOM.x, BLOOM.y, 6 * pulse, '#fff6c9');
  }

  function drawPickups(state) {
    for (const pickup of state.pickups) {
      const blink = pickup.life < 3 && Math.sin(pickup.life * 14) > 0;
      if (blink) continue;
      const bob = Math.sin(state.time * 3 + pickup.x) * 2;
      if (pickup.kind === 'shard') {
        ctx.save();
        ctx.translate(pickup.x, pickup.y + bob);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = PALETTE.shard;
        ctx.fillRect(-5, -5, 10, 10);
        ctx.fillStyle = '#fff6c9';
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
      } else if (pickup.kind === 'heart') {
        ctx.fillStyle = PALETTE.heart;
        ctx.beginPath();
        ctx.moveTo(pickup.x, pickup.y + 6 + bob);
        ctx.bezierCurveTo(pickup.x - 10, pickup.y - 2 + bob, pickup.x - 6, pickup.y - 9 + bob, pickup.x, pickup.y - 3 + bob);
        ctx.bezierCurveTo(pickup.x + 6, pickup.y - 9 + bob, pickup.x + 10, pickup.y - 2 + bob, pickup.x, pickup.y + 6 + bob);
        ctx.fill();
      } else {
        glowDot(pickup.x, pickup.y + bob, 7, PALETTE.mend, 0.9);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pickup.x, pickup.y - 4 + bob);
        ctx.lineTo(pickup.x, pickup.y + 4 + bob);
        ctx.moveTo(pickup.x - 4, pickup.y + bob);
        ctx.lineTo(pickup.x + 4, pickup.y + bob);
        ctx.stroke();
      }
    }
  }

  function drawTurrets(state) {
    for (const turret of state.turrets) {
      const grow = turret.grow > 0 ? 1 - turret.grow / 0.25 : 1;
      const r = TURRET.radius * (0.5 + 0.5 * grow);
      ctx.fillStyle = '#3f7a4a';
      ctx.beginPath();
      ctx.moveTo(turret.x, turret.y + r);
      ctx.lineTo(turret.x - r * 0.8, turret.y - r * 0.4);
      ctx.lineTo(turret.x + r * 0.8, turret.y - r * 0.4);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        ctx.strokeStyle = PALETTE.turret;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(turret.x + Math.cos(a) * r * 0.4, turret.y + Math.sin(a) * r * 0.4);
        ctx.lineTo(turret.x + Math.cos(a) * r, turret.y + Math.sin(a) * r);
        ctx.stroke();
      }
      circle(turret.x, turret.y, r * 0.45, '#d8ffd0');
      // The barrel thorn points at its target.
      ctx.strokeStyle = '#eaffea';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(turret.x, turret.y);
      ctx.lineTo(turret.x + Math.cos(turret.angle) * (r + 8), turret.y + Math.sin(turret.angle) * (r + 8));
      ctx.stroke();
      if (turret.hp < turret.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(turret.x - 14, turret.y - r - 9, 28, 4);
        ctx.fillStyle = PALETTE.turret;
        ctx.fillRect(turret.x - 14, turret.y - r - 9, 28 * (turret.hp / turret.maxHp), 4);
      }
    }
  }

  function drawEnemy(enemy, time) {
    const flash = enemy.hitFlash > 0;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    if (enemy.kind === 'mote') {
      ctx.rotate(enemy.wobble * 0.7);
      ctx.fillStyle = PALETTE.mote;
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const outer = i % 2 === 0 ? enemy.radius + 4 : enemy.radius - 2;
        const px = Math.cos(a) * outer;
        const py = Math.sin(a) * outer;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      circle(0, 0, enemy.radius * 0.45, '#2b1a4a');
      circle(-3, -3, 2.5, '#ffffff');
    } else if (enemy.kind === 'bramble') {
      ctx.rotate(enemy.wobble * 0.15);
      ctx.fillStyle = PALETTE.bramble;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2d44';
      ctx.lineWidth = 4;
      for (let i = 0; i < 9; i += 1) {
        const a = (i / 9) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * enemy.radius * 0.6, Math.sin(a) * enemy.radius * 0.6);
        ctx.lineTo(Math.cos(a) * (enemy.radius + 8), Math.sin(a) * (enemy.radius + 8));
        ctx.stroke();
      }
      circle(-6, -5, 4, '#ff5d5d');
      circle(7, -4, 4, '#ff5d5d');
    } else if (enemy.kind === 'spitter') {
      const squash = 1 + Math.sin(time * 4 + enemy.wobble) * 0.08;
      ctx.scale(1, squash);
      circle(0, 0, enemy.radius, PALETTE.spitter);
      circle(0, 0, enemy.radius * 0.55, '#1d5a50');
      circle(0, 2, 4, '#9dff57');
    } else if (enemy.kind === 'dart') {
      const aim = Math.atan2(enemy.lockY - enemy.y, enemy.lockX - enemy.x);
      if (enemy.mode === 'telegraph') {
        ctx.strokeStyle = 'rgba(255, 107, 107, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(aim) * 200, Math.sin(aim) * 200);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.rotate(enemy.mode === 'telegraph' || enemy.mode === 'lunge' ? aim : enemy.wobble);
      ctx.fillStyle = enemy.mode === 'telegraph' ? '#ffd0d0' : PALETTE.dart;
      ctx.beginPath();
      ctx.moveTo(enemy.radius + 8, 0);
      ctx.lineTo(-enemy.radius, -7);
      ctx.lineTo(-enemy.radius + 4, 0);
      ctx.lineTo(-enemy.radius, 7);
      ctx.closePath();
      ctx.fill();
    } else if (enemy.kind === 'wisp') {
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = PALETTE.wisp;
      ctx.beginPath();
      ctx.arc(0, -2, enemy.radius * 0.8, Math.PI, 0);
      ctx.quadraticCurveTo(enemy.radius, enemy.radius * 0.9, enemy.radius * 0.5, enemy.radius * 0.5 + Math.sin(time * 6 + enemy.wobble) * 3);
      ctx.quadraticCurveTo(0, enemy.radius + 3, -enemy.radius * 0.5, enemy.radius * 0.5 - Math.sin(time * 6 + enemy.wobble) * 3);
      ctx.quadraticCurveTo(-enemy.radius, enemy.radius * 0.9, -enemy.radius * 0.8, -2);
      ctx.fill();
      ctx.globalAlpha = 1;
      circle(-3.5, -4, 2.2, '#0d2a33');
      circle(3.5, -4, 2.2, '#0d2a33');
    } else if (enemy.kind === 'herald') {
      const enraged = enemy.hp < enemy.maxHp * 0.3;
      ctx.rotate(enemy.burstAngle * 0.6);
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2;
        ctx.fillStyle = enraged ? '#ff6b9d' : '#6b4a8f';
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 34, Math.sin(a) * 34, 20, 11, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.rotate(-enemy.burstAngle * 1.2);
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        ctx.fillStyle = enraged ? '#ffb4d0' : PALETTE.herald;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 18, Math.sin(a) * 18, 12, 7, a, 0, Math.PI * 2);
        ctx.fill();
      }
      circle(0, 0, 13, enraged ? '#ff2d55' : '#2b1a4a');
      circle(0, 0, 6, '#ffffff');
      circle(0, 0, 3, enraged ? '#ff2d55' : '#1a0f2e');
    }
    if (flash) {
      ctx.globalAlpha = 0.65;
      circle(0, 0, enemy.radius, '#ffffff');
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (enemy.hp < enemy.maxHp && enemy.kind !== 'herald') {
      const width = enemy.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 9, width, 4);
      ctx.fillStyle = '#ff8f8f';
      ctx.fillRect(enemy.x - width / 2, enemy.y - enemy.radius - 9, width * (enemy.hp / enemy.maxHp), 4);
    }
  }

  function drawWarden(state) {
    const warden = state.warden;
    if (warden.mercy > 0 && Math.sin(state.time * 40) > 0) return; // Mercy flicker.
    if (warden.dashTimer > 0) {
      ctx.globalAlpha = 0.3;
      circle(warden.x - warden.dashDirX * 22, warden.y - warden.dashDirY * 22, WARDEN.radius, PALETTE.warden);
      ctx.globalAlpha = 0.18;
      circle(warden.x - warden.dashDirX * 40, warden.y - warden.dashDirY * 40, WARDEN.radius, PALETTE.warden);
      ctx.globalAlpha = 1;
    }
    const charged = warden.overTime > 0;
    glowDot(warden.x, warden.y, WARDEN.radius + 2, charged ? '#ffe066' : '#7ee6a2', charged ? 0.55 : 0.22);
    // Cloak.
    ctx.fillStyle = PALETTE.wardenCloak;
    ctx.beginPath();
    ctx.moveTo(warden.x, warden.y - WARDEN.radius - 2);
    ctx.quadraticCurveTo(warden.x + WARDEN.radius + 3, warden.y + 4, warden.x + WARDEN.radius - 2, warden.y + WARDEN.radius);
    ctx.quadraticCurveTo(warden.x, warden.y + WARDEN.radius - 4, warden.x - WARDEN.radius + 2, warden.y + WARDEN.radius);
    ctx.quadraticCurveTo(warden.x - WARDEN.radius - 3, warden.y + 4, warden.x, warden.y - WARDEN.radius - 2);
    ctx.fill();
    // Hood and face.
    circle(warden.x, warden.y - 6, 10, '#3f8f5f');
    circle(warden.x, warden.y - 6, 7, '#12351f');
    const lookX = Math.cos(warden.aim) * 2.5;
    const lookY = Math.sin(warden.aim) * 2.5;
    circle(warden.x - 2.5 + lookX, warden.y - 6 + lookY, 1.6, '#d8ffd0');
    circle(warden.x + 2.5 + lookX, warden.y - 6 + lookY, 1.6, '#d8ffd0');
    // Staff, pointing at the aim.
    const handX = warden.x + Math.cos(warden.aim + Math.PI / 2) * 9;
    const handY = warden.y + Math.sin(warden.aim + Math.PI / 2) * 9;
    const tipX = handX + Math.cos(warden.aim) * 26;
    const tipY = handY + Math.sin(warden.aim) * 26;
    ctx.strokeStyle = '#8a6b4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(handX - Math.cos(warden.aim) * 8, handY - Math.sin(warden.aim) * 8);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    glowDot(tipX, tipY, 5, charged ? '#ffe066' : '#c8ffd9', 0.95);
  }

  function draw(state, screen) {
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
    }
    ctx.fillStyle = soil;
    ctx.fillRect(-20, -20, FIELD.width + 40, FIELD.height + 40);
    drawDecor(state);
    for (const fly of state.fireflies) {
      const twinkle = 0.4 + 0.6 * Math.max(0, Math.sin(fly.phase * 1.7));
      glowDot(fly.x, fly.y, 2.5, '#d8ff9a', twinkle * 0.8);
    }
    drawPickups(state);
    drawTurrets(state);
    drawBloom(state);
    for (const enemy of state.enemies) drawEnemy(enemy, state.time);
    for (const bullet of state.bullets) {
      glowDot(bullet.x, bullet.y, bullet.radius, bullet.charged ? '#ffe066' : PALETTE.bullet, 0.95);
    }
    for (const shot of state.ebullets) {
      glowDot(shot.x, shot.y, shot.radius, shot.kind === 'glob' ? PALETTE.glob : '#d8a7ff', 0.95);
    }
    if (screen !== SCREEN_TITLE) drawWarden(state);
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      circle(p.x, p.y, p.size, p.color);
    }
    ctx.globalAlpha = 1;
    ctx.font = `bold 16px ${FONT}`;
    ctx.textAlign = 'center';
    for (const f of state.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(5, 10, 7, 0.45)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    ctx.restore();
  }

  return { draw, resize };
}
