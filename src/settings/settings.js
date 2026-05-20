(function () {
  const shortcutList = document.getElementById('shortcut-list');
  const emptyState = document.getElementById('empty-state');
  const dropZone = document.getElementById('drop-zone');
  const btnAdd = document.getElementById('btn-add');
  const filePicker = document.getElementById('file-picker');

  const ballStyleSelect = document.getElementById('ball-style');
  const imageSettings = document.getElementById('image-settings');
  const clockSettings = document.getElementById('clock-settings');
  const btnSelectImage = document.getElementById('btn-select-image');
  const btnClearImage = document.getElementById('btn-clear-image');
  const imagePreviewWrap = document.getElementById('image-preview-wrap');
  const imagePreview = document.getElementById('image-preview');

  const clockFaceColor = document.getElementById('clock-face-color');
  const clockHandColor = document.getElementById('clock-hand-color');
  const clockSecondColor = document.getElementById('clock-second-color');
  const clockTickColor = document.getElementById('clock-tick-color');

  const ringLineColor = document.getElementById('ring-line-color');
  const ringLineOpacity = document.getElementById('ring-line-opacity');
  const ringLineOpacityVal = document.getElementById('ring-line-opacity-val');
  const ringLineWidth = document.getElementById('ring-line-width');
  const ringLineWidthVal = document.getElementById('ring-line-width-val');
  const ringLineStyle = document.getElementById('ring-line-style');

  let shortcuts = [];
  let dragSrcIndex = null;
  let appSettings = {};

  async function init() {
    shortcuts = await window.api.getShortcuts();
    appSettings = await window.api.getAppSettings();
    renderList();
    setupDragDrop();
    setupFilePicker();
    setupTabs();
    setupAppearanceSettings();
    loadAppearanceValues();
  }

  function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  function loadAppearanceValues() {
    ballStyleSelect.value = appSettings.ballStyle || 'default';
    updateSubSettingsVisibility();

    if (appSettings.ballImage) {
      imagePreview.src = appSettings.ballImage;
      imagePreviewWrap.style.display = 'flex';
    }

    clockFaceColor.value = appSettings.clockFaceColor || '#1e78dc';
    clockHandColor.value = appSettings.clockHandColor || '#ffffff';
    clockSecondColor.value = appSettings.clockSecondHandColor || '#ff4444';
    clockTickColor.value = appSettings.clockTickColor || '#999999';

    const ringColor = appSettings.ringLineColor || 'rgba(30, 120, 220, 0.18)';
    const rgbMatch = ringColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const hex = '#' + [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(v => parseInt(v).toString(16).padStart(2, '0')).join('');
      ringLineColor.value = hex;
    }

    const opacityMatch = ringColor.match(/[\d.]+\)$/);
    if (opacityMatch) {
      const opacity = Math.round(parseFloat(opacityMatch[0]) * 100);
      ringLineOpacity.value = opacity;
      ringLineOpacityVal.textContent = opacity + '%';
    }

    ringLineWidth.value = appSettings.ringLineWidth || 1;
    ringLineWidthVal.textContent = (appSettings.ringLineWidth || 1) + 'px';
    ringLineStyle.value = appSettings.ringLineStyle || 'solid';
  }

  function updateSubSettingsVisibility() {
    const style = ballStyleSelect.value;
    imageSettings.style.display = style === 'image' ? 'block' : 'none';
    clockSettings.style.display = style === 'clock' ? 'block' : 'none';
  }

  function setupAppearanceSettings() {
    ballStyleSelect.addEventListener('change', () => {
      updateSubSettingsVisibility();
      saveAppearanceSettings();
    });

    btnSelectImage.addEventListener('click', async () => {
      const dataUrl = await window.api.selectImageFile();
      if (dataUrl) {
        appSettings.ballImage = dataUrl;
        imagePreview.src = dataUrl;
        imagePreviewWrap.style.display = 'flex';
        saveAppearanceSettings();
      }
    });

    btnClearImage.addEventListener('click', () => {
      appSettings.ballImage = null;
      imagePreview.src = '';
      imagePreviewWrap.style.display = 'none';
      saveAppearanceSettings();
    });

    clockFaceColor.addEventListener('input', () => saveAppearanceSettings());
    clockHandColor.addEventListener('input', () => saveAppearanceSettings());
    clockSecondColor.addEventListener('input', () => saveAppearanceSettings());
    clockTickColor.addEventListener('input', () => saveAppearanceSettings());

    ringLineColor.addEventListener('input', () => saveAppearanceSettings());
    ringLineOpacity.addEventListener('input', () => {
      ringLineOpacityVal.textContent = ringLineOpacity.value + '%';
      saveAppearanceSettings();
    });
    ringLineWidth.addEventListener('input', () => {
      ringLineWidthVal.textContent = ringLineWidth.value + 'px';
      saveAppearanceSettings();
    });
    ringLineStyle.addEventListener('change', () => saveAppearanceSettings());
  }

  async function saveAppearanceSettings() {
    const hex = ringLineColor.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = (parseInt(ringLineOpacity.value) / 100).toFixed(2);

    appSettings = {
      ...appSettings,
      ballStyle: ballStyleSelect.value,
      clockFaceColor: clockFaceColor.value,
      clockHandColor: clockHandColor.value,
      clockSecondHandColor: clockSecondColor.value,
      clockTickColor: clockTickColor.value,
      ringLineColor: `rgba(${r}, ${g}, ${b}, ${a})`,
      ringLineWidth: parseFloat(ringLineWidth.value),
      ringLineStyle: ringLineStyle.value
    };

    appSettings = await window.api.saveAppSettings(appSettings);
  }

  function renderList() {
    shortcutList.innerHTML = '';

    if (shortcuts.length === 0) {
      emptyState.classList.remove('hidden');
      shortcutList.classList.add('hidden');
      return;
    }

    emptyState.classList.add('hidden');
    shortcutList.classList.remove('hidden');

    shortcuts.forEach((shortcut, index) => {
      const item = document.createElement('div');
      item.className = 'shortcut-item';
      item.draggable = true;
      item.dataset.index = index;

      item.innerHTML = `
        <span class="drag-handle">⠿</span>
        <div class="item-icon">
          ${shortcut.icon
            ? `<img src="${shortcut.icon}" draggable="false" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="default-icon" style="display:none">${shortcut.name.charAt(0).toUpperCase()}</div>`
            : `<div class="default-icon">${shortcut.name.charAt(0).toUpperCase()}</div>`
          }
        </div>
        <div class="item-info">
          <input class="item-name" value="${escapeHtml(shortcut.name)}" data-id="${shortcut.id}" />
          <div class="item-path" title="${escapeHtml(shortcut.path)}">${escapeHtml(shortcut.path)}</div>
        </div>
        <div class="item-actions">
          <button class="btn btn-danger btn-sm btn-delete" data-id="${shortcut.id}">删除</button>
        </div>
      `;

      const nameInput = item.querySelector('.item-name');
      nameInput.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const newName = e.target.value.trim();
        if (newName) {
          updateShortcutName(id, newName);
        } else {
          e.target.value = shortcuts.find(s => s.id === id)?.name || '';
        }
      });

      nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.target.blur();
        }
      });

      const deleteBtn = item.querySelector('.btn-delete');
      deleteBtn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        deleteShortcut(id);
      });

      item.addEventListener('dragstart', (e) => {
        dragSrcIndex = index;
        item.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      item.addEventListener('dragend', () => {
        item.classList.remove('dragging');
        dragSrcIndex = null;
      });

      item.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      });

      item.addEventListener('drop', (e) => {
        e.preventDefault();
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        const moved = shortcuts.splice(dragSrcIndex, 1)[0];
        shortcuts.splice(index, 0, moved);
        saveAndRender();
      });

      shortcutList.appendChild(item);
    });
  }

  function setupDragDrop() {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.toLowerCase().split('.').pop();
        if (ext === 'exe' || ext === 'lnk') {
          const result = await window.api.addShortcut(file.path);
          if (result.error) {
            showToast(result.error, true);
          } else {
            shortcuts.push(result);
          }
        } else {
          showToast('仅支持 .exe 和 .lnk 文件', true);
        }
      }
      renderList();
    });

    document.body.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.body.addEventListener('drop', (e) => {
      e.preventDefault();
    });
  }

  function setupFilePicker() {
    btnAdd.addEventListener('click', () => {
      filePicker.click();
    });

    filePicker.addEventListener('change', async (e) => {
      const files = e.target.files;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await window.api.addShortcut(file.path);
        if (result.error) {
          showToast(result.error, true);
        } else {
          shortcuts.push(result);
        }
      }
      renderList();
      filePicker.value = '';
    });
  }

  async function deleteShortcut(id) {
    await window.api.deleteShortcut(id);
    shortcuts = shortcuts.filter(s => s.id !== id);
    renderList();
  }

  async function updateShortcutName(id, newName) {
    const shortcut = shortcuts.find(s => s.id === id);
    if (shortcut) {
      shortcut.name = newName;
      await window.api.saveShortcuts(shortcuts);
    }
  }

  async function saveAndRender() {
    await window.api.saveShortcuts(shortcuts);
    renderList();
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function showToast(message, isError) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  init();
})();
