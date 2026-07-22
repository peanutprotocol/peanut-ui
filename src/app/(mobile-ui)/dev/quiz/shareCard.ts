export interface ShareCardData {
    quizTitle: string
    emoji: string
    score: number
    total: number
    points: number
    gradeTitle: string
    bestStreak: number
    mascotSrc: string
}

const W = 1080
const H = 1080

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
    // hard black drop shadow, peanut-DS style
    ctx.fillStyle = '#000000'
    roundRect(ctx, x + 10, y + 10, w, h, 24)
    ctx.fill()
    ctx.fillStyle = fill
    roundRect(ctx, x, y, w, h, 24)
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = '#000000'
    roundRect(ctx, x, y, w, h, 24)
    ctx.stroke()
}

function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new window.Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = src
    })
}

/** Renders the end-of-quiz share card and returns it as a PNG blob. */
export async function renderShareCard(data: ShareCardData): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')

    // lavender field with scattered peanuts
    ctx.fillStyle = '#EFE4FF'
    ctx.fillRect(0, 0, W, H)
    ctx.font = '44px sans-serif'
    ctx.globalAlpha = 0.18
    for (let i = 0; i < 9; i++) {
        ctx.fillText('🥜', 60 + (i % 3) * 380 + (i % 2) * 90, 120 + Math.floor(i / 3) * 400)
    }
    ctx.globalAlpha = 1
    ctx.lineWidth = 12
    ctx.strokeStyle = '#000000'
    ctx.strokeRect(0, 0, W, H)

    // main card
    panel(ctx, 90, 120, 900, 840, '#FFFFFF')

    // mascot (first frame of the animated webp)
    try {
        const mascot = await loadImage(data.mascotSrc)
        ctx.drawImage(mascot, W / 2 - 130, 160, 260, 260)
    } catch {
        ctx.font = '200px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(data.emoji, W / 2, 380)
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#000000'
    ctx.font = '700 52px sans-serif'
    ctx.fillText(`${data.emoji} ${data.quizTitle}`, W / 2, 500)

    ctx.font = '800 140px sans-serif'
    ctx.fillText(`${data.score}/${data.total}`, W / 2, 660)

    // grade ribbon (pink)
    panel(ctx, 190, 700, 700, 90, '#FF90E8')
    ctx.fillStyle = '#000000'
    ctx.font = '700 44px sans-serif'
    ctx.fillText(data.gradeTitle, W / 2, 760)

    // points + streak (yellow)
    panel(ctx, 190, 830, 700, 80, '#FFC900')
    ctx.fillStyle = '#000000'
    ctx.font = '700 40px sans-serif'
    const streakPart = data.bestStreak >= 3 ? `   ·   🔥 best streak ${data.bestStreak}` : ''
    ctx.fillText(`⭐ ${data.points} pts${streakPart}`, W / 2, 884)

    ctx.font = '600 34px sans-serif'
    ctx.fillStyle = '#000000'
    ctx.fillText('Peanut Quiz — peanut.me/dev/quiz — can you beat me?', W / 2, 1020)

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png')
    })
}
