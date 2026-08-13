 (function(){
  const el = document;
  const templateSelect = el.getElementById('templateSelect');
  const uploadInput = el.getElementById('uploadInput');
  const uploadBtn = el.getElementById('uploadBtn');
  const uploadResult = el.getElementById('uploadResult');
  const avatarSelect = el.getElementById('avatarSelect');
  const avatarX = el.getElementById('avatarX');
  const avatarY = el.getElementById('avatarY');
  const avatarSize = el.getElementById('avatarSize');
  const usernameX = el.getElementById('usernameX');
  const usernameY = el.getElementById('usernameY');
  const usernameSize = el.getElementById('usernameSize');
  const previewBtn = el.getElementById('previewBtn');
  const saveBtn = el.getElementById('saveBtn');
  const saveResult = el.getElementById('saveResult');
  const zoomFitBtn = el.getElementById('zoomFitBtn');
  const zoom100Btn = el.getElementById('zoom100Btn');
  const zoom200Btn = el.getElementById('zoom200Btn');
  const zoomInput = el.getElementById('zoomInput');
  const konvaContainer = el.getElementById('konvaContainer');

  // Konva stage and layers
  let stage, layer, bgImage, pfpImageNode, pfpGroup, templateTextGroup, templateTextNode, usernameNode, transformer;
  let bannerWidth = 1280, bannerHeight = 360;

  function ensureKonva() {
    if (typeof Konva === 'undefined') {
      console.error('Konva not loaded');
      return false;
    }
    if (!stage) {
      stage = new Konva.Stage({
        container: 'konvaContainer',
        width: konvaContainer.clientWidth,
        height: konvaContainer.clientHeight,
        draggable: false
      });
      layer = new Konva.Layer();
      stage.add(layer);
    }
    return true;
  }

  function loadImage(url) {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  }

  async function setTemplate(url) {
    if (!ensureKonva()) return;
    try {
      const img = await loadImage(url);
      bannerWidth = img.naturalWidth || 1280;
      bannerHeight = img.naturalHeight || 360;
      if (bgImage) {
        bgImage.image(img);
        bgImage.width(bannerWidth);
        bgImage.height(bannerHeight);
      } else {
        bgImage = new Konva.Image({
          x: 0, y: 0,
          image: img,
          width: bannerWidth,
          height: bannerHeight,
          listening: false
        });
        layer.add(bgImage);
        // ensure bg is at bottom
        bgImage.moveToBottom();
      }
      layer.batchDraw();
      fitToScreen();
    } catch (err) {
      console.error('Failed to load template', err);
    }
  }

  function fitToScreen() {
    if (!stage) return;
    const containerW = konvaContainer.clientWidth;
    const containerH = konvaContainer.clientHeight;
    const scale = Math.min(containerW / bannerWidth, containerH / bannerHeight);
    stage.width(containerW);
    stage.height(containerH);
    stage.scale({ x: scale, y: scale });
    stage.position({ x: (containerW - bannerWidth * scale) / 2, y: (containerH - bannerHeight * scale) / 2 });
    stage.batchDraw();
    zoomInput.value = Math.round(scale * 100);
  }

  function setZoom(percent) {
    if (!stage) return;
    const scale = percent / 100;
    const containerW = konvaContainer.clientWidth;
    const containerH = konvaContainer.clientHeight;
    stage.scale({ x: scale, y: scale });
    stage.position({ x: (containerW - bannerWidth * scale) / 2, y: (containerH - bannerHeight * scale) / 2 });
    stage.batchDraw();
  }

  async function ensurePfp(avatarUrl) {
    if (!ensureKonva()) return;
    try {
      const img = avatarUrl ? await loadImage(avatarUrl) : null;
      const ax = parseInt(avatarX.value || 20, 10);
      const ay = parseInt(avatarY.value || 60, 10);
      const asz = parseInt(avatarSize.value || 240, 10);

      if (!pfpGroup) {
        pfpGroup = new Konva.Group({ x: ax, y: ay, draggable: true });
        // clip as circle within group
        pfpGroup.clipFunc(function(ctx) {
          ctx.beginPath();
          ctx.arc(asz / 2, asz / 2, asz / 2, 0, Math.PI * 2, false);
          ctx.closePath();
        });
        layer.add(pfpGroup);
      }

      if (!pfpImageNode) {
        pfpImageNode = new Konva.Image({ x: 0, y: 0, width: asz, height: asz, image: img });
        pfpGroup.add(pfpImageNode);
      } else {
        pfpImageNode.image(img);
        pfpImageNode.width(asz);
        pfpImageNode.height(asz);
      }

      // border circle (non-clipped stroke) - draw as separate shape above group
      if (!stage.findOne('.pfpBorder')) {
        const border = new Konva.Circle({
          x: ax + asz / 2,
          y: ay + asz / 2,
          radius: asz / 2 + 4,
          stroke: '#e6e6e6',
          strokeWidth: 6,
          name: 'pfpBorder'
        });
        layer.add(border);
      }

      // transformer for pfp (corner scale)
      if (!transformer) {
        transformer = new Konva.Transformer({ nodes: [pfpGroup], keepRatio: true, enabledAnchors: ['top-left','top-right','bottom-left','bottom-right'] });
        layer.add(transformer);
      } else {
        transformer.nodes([pfpGroup]);
      }

      pfpGroup.position({ x: ax, y: ay });
      pfpImageNode.width(asz);
      pfpImageNode.height(asz);
      const borderNode = stage.findOne('.pfpBorder');
      if (borderNode) borderNode.position({ x: ax + asz / 2, y: ay + asz / 2 }).radius(asz / 2 + 4);

      pfpGroup.on('dragend', () => {
        const pos = pfpGroup.position();
        avatarX.value = Math.round(pos.x);
        avatarY.value = Math.round(pos.y);
        layer.batchDraw();
      });

      pfpGroup.on('transformend', () => {
        const scaleX = pfpGroup.scaleX();
        const newSize = Math.round(asz * scaleX);
        // reset scale to 1 and update size
        pfpGroup.scaleX(1);
        pfpGroup.scaleY(1);
        pfpImageNode.width(newSize);
        pfpImageNode.height(newSize);
        avatarSize.value = newSize;
        // update border
        const borderNode2 = stage.findOne('.pfpBorder');
        if (borderNode2) borderNode2.position({ x: pfpGroup.x() + newSize / 2, y: pfpGroup.y() + newSize / 2 }).radius(newSize / 2 + 4);
        layer.batchDraw();
      });

      layer.batchDraw();
    } catch (err) {
      console.error('Failed to load avatar', err);
    }
  }

  function ensureTemplateText() {
    if (!ensureKonva()) return;
    const tx = parseInt(usernameX.value || 420, 10);
    const ty = parseInt(usernameY.value || 210, 10);
    const tsize = parseInt(usernameSize.value || 72, 10);
    const bboxW = 520;
    const bboxH = 120;
    const text = document.getElementById('templateTextDisplay') ? document.getElementById('templateTextDisplay').innerText : '';

    if (!templateTextGroup) {
      templateTextGroup = new Konva.Group({ x: tx, y: ty - 90, draggable: true });
      const rect = new Konva.Rect({ width: bboxW, height: bboxH, stroke: 'rgba(255,255,255,0.25)', dash: [6,4], listening: false });
      templateTextNode = new Konva.Text({ x: 6, y: 6, text: text, fontSize: tsize, fontFamily: 'Plus Jakarta Sans, WelcomeFont, Segoe UI, Arial', fontStyle: '800', fill: '#ffffff', width: bboxW - 12, height: bboxH - 12, ellipsis: true });
      templateTextGroup.add(rect);
      templateTextGroup.add(templateTextNode);
      layer.add(templateTextGroup);

      // double click to edit text via overlay textarea
      templateTextNode.on('dblclick', () => {
        // create textarea over stage
        const textPosition = templateTextNode.getAbsolutePosition();
        const stageBox = stage.container().getBoundingClientRect();
        const areaPosition = { x: stageBox.left + textPosition.x * stage.scaleX() + templateTextGroup.x() * stage.scaleX() + 6 * stage.scaleX(), y: stageBox.top + textPosition.y * stage.scaleY() + templateTextGroup.y() * stage.scaleY() + 6 * stage.scaleY() };
        const textarea = document.createElement('textarea');
        document.body.appendChild(textarea);
        textarea.value = templateTextNode.text();
        textarea.style.position = 'absolute';
        textarea.style.top = areaPosition.y + 'px';
        textarea.style.left = areaPosition.x + 'px';
        textarea.style.width = (templateTextNode.width() * stage.scaleX()) + 'px';
        textarea.style.height = (templateTextNode.height() * stage.scaleY()) + 'px';
        textarea.style.fontSize = (templateTextNode.fontSize() * stage.scaleX()) + 'px';
        textarea.onblur = function() {
          templateTextNode.text(textarea.value);
          document.getElementById('templateTextDisplay').innerText = textarea.value;
          document.body.removeChild(textarea);
          layer.batchDraw();
        };
        textarea.focus();
      });

      templateTextGroup.on('dragend', () => {
        const pos = templateTextGroup.position();
        usernameX.value = Math.round(pos.x);
        usernameY.value = Math.round(pos.y + 90);
        layer.batchDraw();
      });
    } else {
      templateTextGroup.position({ x: tx, y: ty - 90 });
      templateTextNode.fontSize(parseInt(usernameSize.value || 72, 10));
      templateTextNode.text(document.getElementById('templateTextDisplay').innerText || '');
      layer.batchDraw();
    }
  }

  async function updatePreview() {
    if (!ensureKonva()) return;
    const tpl = templateSelect.value;
    if (tpl) await setTemplate(tpl);
    await ensurePfp(avatarSelect.value || null);
    ensureTemplateText();
  }

  // wire zoom controls
  zoomFitBtn.addEventListener('click', (e) => { e.preventDefault(); fitToScreen(); });
  zoom100Btn.addEventListener('click', (e) => { e.preventDefault(); setZoom(100); zoomInput.value = 100; });
  zoom200Btn.addEventListener('click', (e) => { e.preventDefault(); setZoom(200); zoomInput.value = 200; });
  zoomInput.addEventListener('change', (e) => { const v = parseInt(e.target.value || 100,10); setZoom(v); });

  previewBtn.addEventListener('click', (e)=>{ e.preventDefault(); updatePreview(); });

  uploadBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    if (!uploadInput.files || uploadInput.files.length===0) return uploadResult.textContent = 'Please choose one or more files';
    const fd = new FormData();
    for (let i=0;i<uploadInput.files.length;i++) fd.append('images', uploadInput.files[i]);
    uploadResult.textContent = 'Uploading...';
    try {
      const r = await fetch('/api/welcome/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (j && j.success && Array.isArray(j.files)) {
        uploadResult.textContent = 'Uploaded ' + j.files.length + ' files';
        for (const file of j.files) {
          const opt = document.createElement('option'); opt.value = file.url; opt.textContent = file.filename + ' (uploads)';
          avatarSelect.appendChild(opt.cloneNode(true));
          templateSelect.appendChild(opt.cloneNode(true));
          // add thumbnail to uploadsList
          const thumb = document.createElement('div');
          thumb.style.width = '80px'; thumb.style.height = '80px'; thumb.style.border = '1px solid var(--border)'; thumb.style.borderRadius = '6px'; thumb.style.overflow = 'hidden'; thumb.style.cursor = 'pointer';
          const img = document.createElement('img'); img.src = file.url; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover';
          thumb.appendChild(img);
          thumb.title = file.filename;
          thumb.addEventListener('click', () => {
            // add this image as a movable layer on the canvas
            addImageNodeToCanvas(file.url, file.filename);
          });
          document.getElementById('uploadsList').appendChild(thumb);
        }
        // auto-select first uploaded as avatar and preview
        const first = j.files[0];
        if (first) {
          avatarSelect.value = first.url;
          setTemplate(first.url);
          updatePreview();
        }
      } else {
        uploadResult.textContent = 'Upload failed';
      }
    } catch (err) {
      uploadResult.textContent = 'Upload error';
    }
  });

  saveBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    const payload = {
      welcome: {
        template: templateSelect.value,
        avatar: avatarSelect.value,
        avatarX: parseInt(avatarX.value||20,10),
        avatarY: parseInt(avatarY.value||60,10),
        avatarSize: parseInt(avatarSize.value||240,10),
        usernameX: parseInt(usernameX.value||420,10),
        usernameY: parseInt(usernameY.value||210,10),
        usernameSize: parseInt(usernameSize.value||72,10),
        templateText: document.getElementById('templateTextDisplay').innerText || ''
      }
    };
    saveResult.textContent = 'Saving...';
    try {
      const r = await fetch('/api/welcome', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j && j.success) {
        saveResult.textContent = 'Saved.';
      } else {
        saveResult.textContent = 'Save failed';
      }
    } catch (err) {
      saveResult.textContent = 'Save error';
    }
  });

  // live update when changing selects/inputs
  [templateSelect, avatarSelect, avatarX, avatarY, avatarSize, usernameX, usernameY, usernameSize].forEach(i=>{ if(i) i.addEventListener('input', updatePreview); });

  // create a global transformer for selection
  function ensureTransformer() {
    if (!ensureKonva()) return;
    if (!transformer) {
      transformer = new Konva.Transformer({ keepRatio: false, rotateEnabled: true, enabledAnchors: ['top-left','top-right','bottom-left','bottom-right','middle-left','middle-right','top-center','bottom-center'] });
      layer.add(transformer);
    }
  }

  // when clicking on stage, select node or deselect
  function wireStageSelection() {
    if (!ensureKonva()) return;
    stage.on('click tap', function(e) {
      if (e.target === stage || e.target === bgImage) {
        if (transformer) transformer.nodes([]);
        layer.batchDraw();
        return;
      }
      // find top-level group or shape to select
      let node = e.target;
      // prefer group parent (if inside group)
      while (node && node.getParent && node.getParent() !== stage && !(node.getName && node.getName().startsWith('selectable'))) {
        node = node.getParent();
      }
      if (node && node !== stage && node !== bgImage) {
        ensureTransformer();
        transformer.nodes([node]);
        layer.batchDraw();
      }
    });
  }

  // helper to add an arbitrary image to canvas as selectable/draggable node
  async function addImageNodeToCanvas(url, filename) {
    if (!ensureKonva()) return;
    try {
      const img = await loadImage(url);
      const w = Math.min(300, img.naturalWidth);
      const h = Math.min(300, img.naturalHeight * (w / img.naturalWidth));
      const kImg = new Konva.Image({ image: img, x: 40, y: 40, width: w, height: h, draggable: true, name: 'selectable-' + (filename || Date.now()) });
      layer.add(kImg);
      layer.batchDraw();
      ensureTransformer();
      transformer.nodes([kImg]);
      kImg.on('dragend', () => { layer.batchDraw(); });
      kImg.on('transformend', () => { kImg.scaleX(1); kImg.scaleY(1); layer.batchDraw(); });
    } catch (err) {
      console.error('addImageNodeToCanvas failed', err);
    }
  }

  // initialize stage selection and transformer
  ensureKonva(); ensureTransformer(); wireStageSelection();

  // load existing uploads into uploadsList (if any)
  function loadInitial() {
    const opts = Array.from(document.querySelectorAll('#templateSelect option'));
    opts.forEach(o => {
      if (o.value && o.textContent && o.textContent.includes('(uploads)')) {
        const url = o.value; const filename = o.textContent.replace(' (uploads)','');
        const thumb = document.createElement('div');
        thumb.style.width = '80px'; thumb.style.height = '80px'; thumb.style.border = '1px solid var(--border)'; thumb.style.borderRadius = '6px'; thumb.style.overflow = 'hidden'; thumb.style.cursor = 'pointer';
        const img = document.createElement('img'); img.src = url; img.style.width='100%'; img.style.height='100%'; img.style.objectFit='cover';
        thumb.appendChild(img);
        thumb.title = filename;
        thumb.addEventListener('click', () => addImageNodeToCanvas(url, filename));
        document.getElementById('uploadsList').appendChild(thumb);
      }
    });
  }

  loadInitial();
})();
