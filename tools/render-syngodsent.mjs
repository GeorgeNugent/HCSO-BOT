import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

(async ()=>{
  const out = path.join(process.cwd(),'generated-welcome-syngodsent.png');
  const avatar = path.join(process.cwd(),'tmp_avatar.png');
  const template = path.join(process.cwd(),'assets','banners','welcome-template.png');
  if (!fs.existsSync(avatar)) { console.error('Avatar not found:', avatar); process.exit(1); }
  if (!fs.existsSync(template)) { console.error('Template not found:', template); process.exit(1); }

  const targetW = 1200;
  const targetH = 441;

  try {
    const tplBuf = fs.readFileSync(template);
    // resize template to target
    const base = await sharp(tplBuf).resize(targetW, targetH, { fit: 'cover' }).png().toBuffer();

    // avatar sizing and position
    const avatarSize = 240; // diameter
    const avatarX = 20; // left offset
    const avatarY = Math.round((targetH - avatarSize) / 2);

    // We'll create the circular avatar after we analyze the template area
    const avBuf = fs.readFileSync(avatar);

    // username text SVG (we'll place just the username, template already contains big WELCOME)
    const username = 'syngodsent';
    // position username below the big WELCOME text to avoid overlap
    // Detect left edge of the large white 'WELCOME' artwork (to align first letter)
    // and detect the right-side vertical 'WELCOME' start so we can avoid overlap.
    let usernameX = Math.round(targetW * 0.5);
    let safeRight = Math.round(targetW * 0.95);
    try {
      const { data, info } = await sharp(base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const y0 = Math.floor(info.height * 0.15);
      const y1 = Math.floor(info.height * 0.75);

      // find leftmost bright pixel (the W left edge)
      const leftSearchMinX = Math.floor(info.width * 0.15);
      const leftSearchMaxX = Math.floor(info.width * 0.6);
      let foundLeft = info.width;
      for (let y = y0; y < y1; y++) {
        for (let x = leftSearchMinX; x < leftSearchMaxX; x++) {
          const idx = (y * info.width + x) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
          if (a > 200 && r > 200 && g > 200 && b > 200) {
            if (x < foundLeft) foundLeft = x;
          }
        }
      }
      if (foundLeft < info.width) {
        // map to canvas pixels (base is already resized to target)
        // nudge slightly left so the first letter lines up more with the big 'W'
        usernameX = Math.max(8, foundLeft - 8);
      }

      // find the start of the right vertical 'WELCOME' by scanning from right
      const rightSearchMinX = Math.floor(info.width * 0.6);
      const rightSearchMaxX = Math.floor(info.width * 0.98);
      let foundRightStart = 0;
      for (let x = rightSearchMaxX; x > rightSearchMinX; x--) {
        let colWhiteCount = 0;
        for (let y = y0; y < y1; y++) {
          const idx = (y * info.width + x) * 4;
          const r = data[idx], g = data[idx+1], b = data[idx+2], a = data[idx+3];
          if (a > 200 && r > 200 && g > 200 && b > 200) colWhiteCount++;
        }
        if (colWhiteCount > (y1 - y0) * 0.15) { // column has significant white pixels
          foundRightStart = x;
        }
      }
      if (foundRightStart > 0) {
        safeRight = Math.max( Math.round(foundRightStart - 24), Math.round(info.width * 0.75) );
      }

      // Detect if default avatar placement overlaps existing artwork/logos
      try {
        const circleCx = avatarX + Math.round(avatarSize / 2);
        const circleCy = avatarY + Math.round(avatarSize / 2);
        const r = Math.round(avatarSize / 2);
        let pixelsInCircle = 0;
        let nonBackground = 0;
        const thresholdBrightness = 24;
        const minX = Math.max(0, circleCx - r);
        const maxX = Math.min(info.width - 1, circleCx + r);
        const minY = Math.max(0, circleCy - r);
        const maxY = Math.min(info.height - 1, circleCy + r);
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const dx = x - circleCx;
            const dy = y - circleCy;
            if (dx * dx + dy * dy <= r * r) {
              pixelsInCircle++;
              const idx = (y * info.width + x) * 4;
              const rpx = data[idx], gpx = data[idx+1], bpx = data[idx+2], apx = data[idx+3];
              const brightness = (rpx + gpx + bpx) / 3;
              if (apx > 200 && brightness > thresholdBrightness) nonBackground++;
            }
          }
        }
        if (pixelsInCircle > 0 && (nonBackground / pixelsInCircle) > 0.06) {
          // area is busy — shrink avatar and nudge right to avoid covering logos
          const shrinkFactor = 0.78;
          const newSize = Math.max(64, Math.floor(avatarSize * shrinkFactor));
          const shift = Math.max(24, Math.round(avatarSize * 0.14));
          avatarSize = newSize;
          avatarX = Math.min(info.width - avatarSize - 8, avatarX + shift);
        }
      } catch (ex) {
        // ignore avatar collision detection failures
      }
    } catch (err) {
      // fallback: keep defaults
    }

    // shrink username so it fits between usernameX and safeRight
    const usernameY = Math.round(targetH * 0.68);
    let usernameSize = 78;
    const maxWidth = Math.max(120, safeRight - usernameX - 20);
    // heuristic per-char pixel width factor
    const shrinkToFit = (size) => {
      const approxCharWidth = size * 0.58; // heuristic
      return approxCharWidth * username.length <= maxWidth;
    };
    while (usernameSize > 24 && !shrinkToFit(usernameSize)) {
      usernameSize = Math.max(24, Math.floor(usernameSize * 0.9));
    }
    const textSvg = `<svg width="${targetW}" height="${targetH}" xmlns="http://www.w3.org/2000/svg"><text x="${usernameX}" y="${usernameY}" text-anchor="start" fill="#ffffff" font-size="${usernameSize}" font-family="WelcomeFont, Segoe UI, Arial, sans-serif" font-weight="900" letter-spacing="1">${username.toUpperCase()}</text></svg>`;

    // create circular avatar with possibly adjusted size/position
    const maskSvg = `<svg width="${avatarSize}" height="${avatarSize}" xmlns="http://www.w3.org/2000/svg"><circle cx="${avatarSize/2}" cy="${avatarSize/2}" r="${avatarSize/2}" fill="white"/></svg>`;
    const rounded = await sharp(avBuf)
      .resize(avatarSize, avatarSize, { fit: 'cover' })
      .composite([{ input: Buffer.from(maskSvg), blend: 'dest-in' }])
      .png()
      .toBuffer();

    // a filled white backing circle to fully cover any template artwork under the avatar
    const backingRadius = Math.round(avatarSize/2 + 8);
    const backingCx = avatarX + Math.round(avatarSize/2);
    const backingCy = avatarY + Math.round(avatarSize/2);
    const backingSvg = `<svg width="${targetW}" height="${targetH}" xmlns="http://www.w3.org/2000/svg"><circle cx="${backingCx}" cy="${backingCy}" r="${backingRadius}" fill="#ffffff" /></svg>`;

    // border svg
    const borderSvg = `<svg width="${targetW}" height="${targetH}" xmlns="http://www.w3.org/2000/svg"><circle cx="${avatarX + avatarSize/2}" cy="${avatarY + avatarSize/2}" r="${avatarSize/2 + 6}" fill="none" stroke="#e6e6e6" stroke-width="6" /></svg>`;

    const composites = [
      { input: Buffer.from(backingSvg), blend: 'over' },
      { input: rounded, left: avatarX, top: avatarY },
      { input: Buffer.from(borderSvg), blend: 'over' },
      { input: Buffer.from(textSvg), blend: 'over' }
    ];

    await sharp(base).composite(composites).png().toFile(out);
    console.log('Wrote', out);
  } catch (err) {
    console.error('Render failed', err);
    process.exit(1);
  }
})();
