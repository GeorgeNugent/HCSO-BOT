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
  const previewTemplate = el.getElementById('previewTemplate');
  const previewAvatar = el.getElementById('previewAvatar');
  const previewName = el.getElementById('previewName');
  const previewArea = el.getElementById('previewArea');
  const saveResult = el.getElementById('saveResult');

  function loadInitial() {
    fetch('/api/welcome').then(r=>r.json()).then(data=>{
      if (data && data.success) {
        const cfg = data.welcome || {};
        if (cfg.template) {
          setTemplate(cfg.template);
        } else if (templateSelect && templateSelect.options && templateSelect.options.length>0) {
          setTemplate(templateSelect.options[0].value);
        }
        avatarSelect.value = cfg.avatar || '';
        avatarX.value = cfg.avatarX || 20;
        avatarY.value = cfg.avatarY || 60;
        avatarSize.value = cfg.avatarSize || 240;
        usernameX.value = cfg.usernameX || 420;
        usernameY.value = cfg.usernameY || 210;
        usernameSize.value = cfg.usernameSize || 72;
        updatePreview();
      } else {
        if (templateSelect && templateSelect.options && templateSelect.options.length>0) setTemplate(templateSelect.options[0].value);
        updatePreview();
      }
    }).catch(()=>{
      if (templateSelect && templateSelect.options && templateSelect.options.length>0) setTemplate(templateSelect.options[0].value);
      updatePreview();
    });
  }

  function setTemplate(url) {
    previewTemplate.src = url;
  }

  function updatePreview() {
    const t = templateSelect.value;
    if (t) setTemplate(t);
    const av = avatarSelect.value;
    const pfpLayer = document.getElementById('pfpLayer');
    const pfpImage = document.getElementById('pfpImage');
    const pfpHandle = document.getElementById('pfpHandle');
    const templateTextBox = document.getElementById('templateTextBox');
    const templateTextDisplay = document.getElementById('templateTextDisplay');
    const usernameLayer = document.getElementById('usernameLayer');

    if (av) {
      pfpImage.src = av;
      pfpLayer.style.display = 'flex';
      pfpLayer.style.left = (parseInt(avatarX.value||20,10)) + 'px';
      pfpLayer.style.top = (parseInt(avatarY.value||60,10)) + 'px';
      const s = parseInt(avatarSize.value||240,10);
      pfpLayer.style.width = s + 'px';
      pfpLayer.style.height = s + 'px';
      pfpImage.style.width = '100%';
      pfpImage.style.height = '100%';
    } else {
      pfpLayer.style.display = 'none';
    }

    templateTextBox.style.left = (parseInt(usernameX.value||420,10)) + 'px';
    templateTextBox.style.top = (parseInt(usernameY.value||210,10)-90) + 'px';
    templateTextBox.style.width = (parseInt(document.getElementById('templateTextBox').style.width) || 520) + 'px';
    templateTextDisplay.style.fontSize = (parseInt(usernameSize.value||72,10)) + 'px';

    usernameLayer.style.left = (parseInt(usernameX.value||420,10)) + 'px';
    usernameLayer.style.top = (parseInt(usernameY.value||210,10)) + 'px';
    usernameLayer.style.fontSize = (parseInt(usernameSize.value||72,10)) + 'px';
  }

  // Draggable and resize handlers
  function makeDraggable(handleEl, dragEl, onUpdate) {
    let dragging = false;
    let startX = 0, startY = 0, origLeft = 0, origTop = 0;
    handleEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      dragging = true;
      const rect = dragEl.getBoundingClientRect();
      const parentRect = document.getElementById('previewArea').getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      origLeft = rect.left - parentRect.left;
      origTop = rect.top - parentRect.top;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onUp);
    });

    function onMouseMove(e) {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newLeft = Math.max(0, Math.round(origLeft + dx));
      const newTop = Math.max(0, Math.round(origTop + dy));
      dragEl.style.left = newLeft + 'px';
      dragEl.style.top = newTop + 'px';
      if (onUpdate) onUpdate(newLeft, newTop);
    }

    function onUp() {
      dragging = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
    }
  }

  function makeResizer(handleEl, targetEl, onResize) {
    let resizing = false;
    let startX = 0, startW = 0;
    handleEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
      resizing = true;
      startX = e.clientX;
      startW = targetEl.getBoundingClientRect().width;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onUp);
    });

    function onMouseMove(e) {
      if (!resizing) return;
      const dx = e.clientX - startX;
      const newW = Math.max(16, Math.round(startW + dx));
      targetEl.style.width = newW + 'px';
      targetEl.style.height = newW + 'px';
      if (onResize) onResize(newW);
    }

    function onUp() {
      resizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onUp);
    }
  }

  // Initialize draggables after DOM is ready
  window.addEventListener('load', () => {
    const pfpLayer = document.getElementById('pfpLayer');
    const pfpHandle = document.getElementById('pfpHandle');
    const templateTextBox = document.getElementById('templateTextBox');

    if (pfpLayer) {
      makeDraggable(pfpLayer, pfpLayer, (x,y) => {
        avatarX.value = x;
        avatarY.value = y;
        updatePreview();
      });
    }
    if (pfpHandle && pfpLayer) {
      makeResizer(pfpHandle, pfpLayer, (newSize) => {
        avatarSize.value = newSize;
        updatePreview();
      });
    }

    if (templateTextBox) {
      makeDraggable(templateTextBox, templateTextBox, (x,y) => {
        // templateTextBox top mapping: preview uses usernameY-90
        usernameX.value = x;
        usernameY.value = y + 90;
        updatePreview();
      });

      // ensure clicking the box doesn't start text selection drag
      const tplDisplay = document.getElementById('templateTextDisplay');
      tplDisplay.addEventListener('input', () => {
        // autosave to inputs for persistence
        // (actual autoshrink handled later)
        // keep display size; update preview text content
      });
    }
  });

  previewBtn.addEventListener('click', (e)=>{ e.preventDefault(); updatePreview(); });

  uploadBtn.addEventListener('click', async (e)=>{
    e.preventDefault();
    if (!uploadInput.files || uploadInput.files.length===0) return uploadResult.textContent = 'Please choose a file';
    const fd = new FormData();
    fd.append('image', uploadInput.files[0]);
    uploadResult.textContent = 'Uploading...';
    try {
      const r = await fetch('/api/welcome/upload', { method: 'POST', body: fd });
      const j = await r.json();
      if (j && j.success) {
        uploadResult.textContent = 'Uploaded: ' + j.url;
        // add to avatarSelect and templateSelect uploads
        const opt = document.createElement('option'); opt.value = j.url; opt.textContent = j.filename + ' (uploads)';
        avatarSelect.appendChild(opt.cloneNode(true));
        templateSelect.appendChild(opt.cloneNode(true));
        avatarSelect.value = j.url;
        setTemplate(j.url);
        updatePreview();
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

  loadInitial();
})();
