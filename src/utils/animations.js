// ============================================================
// Castro Agency Hub — Centralized Animations
// Place this file at: src/utils/animations.js
// ============================================================

/**
 * Confetti burst — used for sales, referral closes, goal hits
 * @param {object} options - { count, duration }
 */
export function launchConfetti({ count = 160, duration = 220 } = {}) {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const ctx     = canvas.getContext('2d')
  const colors  = ['#C8102E','#1B3A6B','#FFD700','#16a34a','#f97316','#8b5cf6','#ec4899','#06b6d4']
  const fadeAt  = duration - 80

  const particles = Array.from({ length: count }, () => ({
    x:       Math.random() * canvas.width,
    y:       -20 - Math.random() * 80,
    w:       Math.random() * 12 + 5,
    h:       Math.random() * 6 + 4,
    color:   colors[Math.floor(Math.random() * colors.length)],
    speed:   Math.random() * 5 + 2,
    angle:   Math.random() * 360,
    spin:    (Math.random() - 0.5) * 10,
    drift:   (Math.random() - 0.5) * 3,
    opacity: 1,
  }))

  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.y += p.speed; p.x += p.drift; p.angle += p.spin
      if (frame > fadeAt) p.opacity = Math.max(0, p.opacity - 0.016)
      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle * Math.PI / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    })
    frame++
    if (frame < duration) requestAnimationFrame(animate)
    else canvas.parentNode?.removeChild(canvas)
  }
  animate()
}

/**
 * Star burst — used for reviews left
 */
export function launchStars() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const ctx = canvas.getContext('2d')
  const cx  = canvas.width / 2
  const cy  = canvas.height / 2

  const starEmojis = ['⭐','🌟','✨']
  const stars = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * Math.PI * 2 + Math.random() * 0.3
    const speed = Math.random() * 12 + 6
    return {
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size:     Math.random() * 18 + 10,
      emoji:    starEmojis[Math.floor(Math.random() * 3)],
      opacity:  1,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.2,
    }
  })

  const confettiColors = ['#FFD700','#FFC0CB','#FFE4B5','#FFFACD','#F0E68C','#1B3A6B','#C8102E']
  const confetti = Array.from({ length: 80 }, () => ({
    x:       cx + (Math.random() - 0.5) * 100,
    y:       cy + (Math.random() - 0.5) * 100,
    vx:      (Math.random() - 0.5) * 14,
    vy:      -Math.random() * 12 - 4,
    gravity: 0.35,
    w:       Math.random() * 10 + 5,
    h:       Math.random() * 5 + 3,
    color:   confettiColors[Math.floor(Math.random() * confettiColors.length)],
    angle:   Math.random() * 360,
    spin:    (Math.random() - 0.5) * 8,
    opacity: 1,
  }))

  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    stars.forEach(s => {
      s.x += s.vx; s.y += s.vy
      s.vx *= 0.97; s.vy *= 0.97; s.vy += 0.15
      s.rotation += s.rotSpeed
      if (frame > 60) s.opacity = Math.max(0, s.opacity - 0.02)
      ctx.save()
      ctx.globalAlpha = s.opacity
      ctx.font = `${s.size}px serif`
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rotation)
      ctx.fillText(s.emoji, -s.size / 2, s.size / 2)
      ctx.restore()
    })
    confetti.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity; p.angle += p.spin
      if (frame > 80) p.opacity = Math.max(0, p.opacity - 0.015)
      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.translate(p.x, p.y)
      ctx.rotate(p.angle * Math.PI / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    })
    frame++
    if (frame < 180) requestAnimationFrame(animate)
    else canvas.parentNode?.removeChild(canvas)
  }
  animate()
}

/**
 * Sad emoji rain — used for Not Interested / OCC No
 */
export function launchSadRain() {
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const ctx     = canvas.getContext('2d')
  const emojis  = ['😤','😩','😞','💔','😒','😬']

  const particles = Array.from({ length: 40 }, () => ({
    x:      Math.random() * canvas.width,
    y:      -40 - Math.random() * 60,
    size:   Math.random() * 22 + 18,
    speed:  Math.random() * 3 + 1.5,
    drift:  (Math.random() - 0.5) * 1.5,
    emoji:  emojis[Math.floor(Math.random() * emojis.length)],
    opacity: 1,
    wobble: Math.random() * Math.PI * 2,
  }))

  let frame = 0
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    particles.forEach(p => {
      p.y += p.speed
      p.x += p.drift + Math.sin(p.wobble + frame * 0.05) * 0.5
      if (frame > 80) p.opacity = Math.max(0, p.opacity - 0.02)
      ctx.save()
      ctx.globalAlpha = p.opacity
      ctx.font = `${p.size}px serif`
      ctx.fillText(p.emoji, p.x, p.y)
      ctx.restore()
    })
    frame++
    if (frame < 150) requestAnimationFrame(animate)
    else canvas.parentNode?.removeChild(canvas)
  }
  animate()
}

/**
 * Ascending arpeggio fanfare — used when logging a sale
 */
export function playFanfare() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext
    if (!AudioCtx) return
    const ctx   = new AudioCtx()
    const notes = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'triangle'
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.28, t + 0.04)
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
      osc.start(t)
      osc.stop(t + 0.4)
    })
  } catch {
    // Audio not supported — silent fail is fine
  }
}
