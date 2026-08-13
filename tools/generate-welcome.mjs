import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const outFile = path.join(process.cwd(), 'generated-welcome.png');
const name = process.argv[2] || 'New Member';
const avatarPath = process.argv[3] || null; // optional local avatar path
const usernameX = parseInt(process.argv[4], 10) || 420; // override X position
const usernameSize = parseInt(process.argv[5], 10) || 72; // override font size for username

function findTemplate() {
  const bannersDir = path.join(process.cwd(), 'assets', 'banners');
  if (!fs.existsSync(bannersDir)) return null;
  const files = fs.readdirSync(bannersDir);
  const candidates = files.filter(f => /welcome-template|completed|other-template|completed/i.test(f) || /\.png$|\.jpe?g$/i.test(f));
  if (candidates.length === 0) return null;
  // prefer welcome-template.* if present
  let pick = candidates.find(f => /welcome-template/i.test(f));
  if (!pick) pick = candidates[0];
  return path.join(bannersDir, pick);
}

function embedFontCss() {
  try {
    const fontsDir = path.join(process.cwd(), 'assets', 'fonts');
    if (!fs.existsSync(fontsDir)) return '';
    const files = fs.readdirSync(fontsDir);
    const fp = files.find(f => /welcome-font\.(ttf|otf|woff)$/i.test(f));
    if (!fp) return '';
    const full = path.join(fontsDir, fp);
    const ext = path.extname(full).toLowerCase();
    const buf = fs.readFileSync(full);
    const b64 = buf.toString('base64');
    let mime = 'font/ttf';
    let fmt = 'truetype';
    if (ext === '.otf') { mime = 'font/otf'; fmt = 'opentype'; }
    if (ext === '.woff') { mime = 'font/woff'; fmt = 'woff'; }
    return `@font-face { font-family: 'WelcomeFont'; src: url('data:${mime};base64,${b64}') format('${fmt}'); font-weight: normal; font-style: normal; }`;
  } catch (err) {
    return '';
  }
}

(async () => {
  const template = findTemplate();
  if (!template) {
    console.error('No template found in assets/banners.');
    process.exit(1);
  }
  const templateBuffer = fs.readFileSync(template);
  const meta = await sharp(templateBuffer).metadata();
  const canvasW = meta.width || 1280;
  const canvasH = meta.height || 360;

  // Attempt to auto-detect a good X position for the username by finding
  // the left edge of bright/white pixels (assumes the big 'WELCOME' text is white).
  let autoUsernameXViewbox = null;
  try {
    const { data, info } = await sharp(templateBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const searchMinX = Math.floor(info.width * 0.15); // skip left logo area
    const searchMaxX = Math.floor(info.width * 0.95);
    const y0 = Math.floor(info.height * 0.1);
    const y1 = Math.floor(info.height * 0.9);
    let foundMinX = info.width;

    for (let y = y0; y < y1; y++) {
      for (let x = searchMinX; x < searchMaxX; x++) {
        const idx = (y * info.width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        if (a > 200 && r > 200 && g > 200 && b > 200) {
          if (x < foundMinX) foundMinX = x;
        }
      }
    }

    if (foundMinX < info.width) {
      // map foundMinX (template pixels) to viewBox (1280 width)
      const scale = 1280 / info.width;
      autoUsernameXViewbox = Math.round(foundMinX * scale) + 12; // add small padding
    }
  } catch (err) {
    // ignore auto-detect errors
  }
  const fontCss = embedFontCss();

  let avatarImageTag = `<circle cx=\"140\" cy=\"180\" r=\"120\" fill=\"#ffffff\" />`;
  let avatarComposite = null;
  const avatarSize = 240;
  const avatarX = 20;
  const avatarY = Math.round((canvasH - avatarSize) / 2);

  if (avatarPath && fs.existsSync(avatarPath)) {
    const avBuf = fs.readFileSync(avatarPath);
    try {
      // Create circular avatar by masking with an SVG circle using 'dest-in'
      const maskSvg = `<svg width="${avatarSize}" height="${avatarSize}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="black"/><circle cx="${avatarSize / 2}" cy="${avatarSize / 2}" r="${avatarSize / 2}" fill="white"/></svg>`;
      const rounded = await sharp(avBuf)
        .resize(avatarSize, avatarSize, { fit: 'cover' })
        .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
        .png()
        .toBuffer();

      avatarComposite = { input: rounded, left: avatarX, top: avatarY };
      // draw a circular border stroke as SVG later in composites
    } catch (err) {
      avatarComposite = null;
    }
  }

  // Determine final username X in viewBox coords
  let finalUsernameX = usernameX;
  if ((process.argv[4] === 'auto' || typeof process.argv[4] === 'undefined') && autoUsernameXViewbox) {
    finalUsernameX = autoUsernameXViewbox;
  }

  const overlaySvg = `
    <svg width="${canvasW}" height="${canvasH}" viewBox="0 0 1280 360" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="avatarClip"><circle cx="140" cy="180" r="120"/></clipPath>
        <style><![CDATA[ ${fontCss} ]]></style>
      </defs>
      <rect width="1280" height="360" fill="transparent" />
      ${avatarImageTag}
      <circle cx="140" cy="180" r="124" fill="none" stroke="#e6e6e6" stroke-width="6" />
      <!-- Removed duplicate 'Welcome' text because template already contains it -->
      <text x="${finalUsernameX}" y="210" text-anchor="start" fill="#ffffff" font-size="${usernameSize}" font-family="WelcomeFont, Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="2">${escapeXml(name)}</text>
    </svg>
  `;

  try {
    // Compose: template -> avatar (masked) -> border -> text overlay
    const composites = [];
    if (avatarComposite) composites.push(avatarComposite);
    // circle border SVG positioned at avatarX/avatarY
    const borderSvg = `<svg width="${canvasW}" height="${canvasH}" xmlns="http://www.w3.org/2000/svg"><circle cx="${avatarX + avatarSize/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 4}" fill="none" stroke="#e6e6e6" stroke-width="6"/></svg>`;
    composites.push({ input: Buffer.from(borderSvg), blend: 'over' });
    composites.push({ input: Buffer.from(overlaySvg), blend: 'over' });

    await sharp(templateBuffer)
      .composite(composites)
      .png()
      .toFile(outFile);
    console.log('Wrote', outFile);
  } catch (err) {
    console.error('Failed to composite:', err);
    // fallback: render the overlay alone
    const fallback = overlaySvg.replace('fill="transparent"', 'fill="#05080b"');
    await sharp(Buffer.from(fallback)).png().toFile(outFile);
    console.log('Wrote fallback', outFile);
  }
})();

function escapeXml(s) {
  return String(s).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&apos;'}[c]));
}
