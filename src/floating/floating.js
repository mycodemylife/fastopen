(function () {
  const ball = document.getElementById('ball');
  const fanPanel = document.getElementById('fan-panel');
  const tooltip = document.getElementById('tooltip');
  const ballDefaultIcon = document.getElementById('ball-default-icon');
  const ballCustomImage = document.getElementById('ball-custom-image');
  const ballClockCanvas = document.getElementById('ball-clock-canvas');

  let shortcuts = [];
  let isDragging = false;
  let dragStarted = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let mouseDownTime = 0;
  let isCollapsed = false;
  let isFanOpen = false;
  let fanHideTimer = null;
  let lastWindowX = 0;
  let lastWindowY = 0;
  let isMouseInInteractiveArea = false;
  let currentHoveredItem = null;
  let clockAnimFrame = null;
  let appSettings = {};

  const BALL_SIZE = 56;
  const COLLAPSED_WIDTH = 10;
  const EDGE_THRESHOLD = 20;
  const COLLAPSE_DELAY = 800;
  const FAN_ITEM_SIZE = 44;
  const PADDING = 10;

  const RING_RADII = [70, 130, 190, 250];
  const RING_BASE_CAPACITIES = [6, 12, 18, 24];

  let collapseTimer = null;

  let ballLeft = PADDING;
  let ballTop = PADDING;

  async function init() {
    shortcuts = await window.api.getShortcuts();
    appSettings = await window.api.getAppSettings();
    window.api.onShortcutsUpdated((data) => {
      shortcuts = data;
      if (isFanOpen) {
        closeFan();
        openFan();
      }
    });
    window.api.onAppSettingsUpdated((data) => {
      appSettings = data;
      applyBallStyle();
      applyRingStyle();
    });
    positionBallInWindow(PADDING, PADDING);
    setWindowBounds(window.screenX, window.screenY, BALL_SIZE + PADDING * 2, BALL_SIZE + PADDING * 2);
    applyBallStyle();
    checkEdgeAndCollapse();
    setupMouseEvents();
  }

  function applyBallStyle() {
    const style = appSettings.ballStyle || 'default';

    ballDefaultIcon.style.display = 'none';
    ballCustomImage.style.display = 'none';
    ballClockCanvas.style.display = 'none';
    stopClock();

    if (style === 'image' && appSettings.ballImage) {
      ballCustomImage.src = appSettings.ballImage;
      ballCustomImage.style.display = 'block';
      ball.style.background = 'transparent';
      ball.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.3)';
    } else if (style === 'clock') {
      ballClockCanvas.style.display = 'block';
      ball.style.background = appSettings.clockFaceColor || '#1e78dc';
      ball.style.boxShadow = '0 2px 12px rgba(0, 0, 0, 0.3)';
      startClock();
    } else {
      ballDefaultIcon.style.display = 'block';
      ball.style.background = '';
      ball.style.boxShadow = '';
    }
  }

  function startClock() {
    stopClock();
    const canvas = ballClockCanvas;
    const ctx = canvas.getContext('2d');
    const size = BALL_SIZE;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    function drawClock() {
      const now = new Date();
      const hours = now.getHours() % 12;
      const minutes = now.getMinutes();
      const seconds = now.getSeconds();
      const ms = now.getMilliseconds();

      const cx = size / 2;
      const cy = size / 2;
      const r = size / 2 - 2;

      ctx.clearRect(0, 0, size, size);

      const tickColor = appSettings.clockTickColor || '#999999';
      const handColor = appSettings.clockHandColor || '#ffffff';
      const secondColor = appSettings.clockSecondHandColor || '#ff4444';

      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI / 6) - Math.PI / 2;
        const isHour = true;
        const innerR = isHour ? r - 7 : r - 4;
        const outerR = r - 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = i % 3 === 0 ? 2 : 1;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      for (let i = 0; i < 60; i++) {
        if (i % 5 === 0) continue;
        const angle = (i * Math.PI / 30) - Math.PI / 2;
        const innerR = r - 3;
        const outerR = r - 2;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
        ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
        ctx.strokeStyle = tickColor;
        ctx.lineWidth = 0.5;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      const hourAngle = ((hours + minutes / 60) * Math.PI / 6) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(hourAngle) * (r * 0.45), cy + Math.sin(hourAngle) * (r * 0.45));
      ctx.strokeStyle = handColor;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.stroke();

      const minuteAngle = ((minutes + seconds / 60) * Math.PI / 30) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(minuteAngle) * (r * 0.65), cy + Math.sin(minuteAngle) * (r * 0.65));
      ctx.strokeStyle = handColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.stroke();

      const secondAngle = ((seconds + ms / 1000) * Math.PI / 30) - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(secondAngle) * (r * 0.15), cy - Math.sin(secondAngle) * (r * 0.15));
      ctx.lineTo(cx + Math.cos(secondAngle) * (r * 0.75), cy + Math.sin(secondAngle) * (r * 0.75));
      ctx.strokeStyle = secondColor;
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = secondColor;
      ctx.fill();

      clockAnimFrame = requestAnimationFrame(drawClock);
    }

    drawClock();
  }

  function stopClock() {
    if (clockAnimFrame) {
      cancelAnimationFrame(clockAnimFrame);
      clockAnimFrame = null;
    }
  }

  function applyRingStyle() {
    const ringCircles = fanPanel.querySelectorAll('.ring-circle');
    const lineColor = appSettings.ringLineColor || 'rgba(30, 120, 220, 0.18)';
    const lineWidth = appSettings.ringLineWidth || 1;
    const lineStyle = appSettings.ringLineStyle || 'solid';

    let borderStyle = 'solid';
    if (lineStyle === 'dashed') borderStyle = 'dashed';
    else if (lineStyle === 'dotted') borderStyle = 'dotted';

    ringCircles.forEach(el => {
      el.style.borderColor = lineColor;
      el.style.borderWidth = lineWidth + 'px';
      el.style.borderStyle = borderStyle;
    });
  }

  function positionBallInWindow(left, top) {
    ballLeft = left;
    ballTop = top;
    ball.style.left = left + 'px';
    ball.style.top = top + 'px';
  }

  function setWindowBounds(x, y, w, h) {
    return window.api.setFloatingBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) });
  }

  function setupMouseEvents() {
    window.api.setFloatingIgnoreMouse(true);

    document.addEventListener('mousemove', (e) => {
      if (isDragging) {
        handleDrag(e);
        return;
      }
      handleMousePenetration(e);
      if (isFanOpen) {
        handleFanHover(e);
      }
    });

    document.addEventListener('mouseleave', () => {
      if (isMouseInInteractiveArea) {
        isMouseInInteractiveArea = false;
        window.api.setFloatingIgnoreMouse(true);
      }
      hideTooltip();
      currentHoveredItem = null;
      if (isFanOpen && !isDragging) {
        fanHideTimer = setTimeout(() => {
          closeFan();
        }, 600);
      }
    });

    document.addEventListener('mouseenter', () => {
      if (fanHideTimer) {
        clearTimeout(fanHideTimer);
        fanHideTimer = null;
      }
    });

    ball.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isDragging = true;
      dragStarted = false;
      dragStartX = e.screenX;
      dragStartY = e.screenY;
      mouseDownTime = Date.now();
      lastWindowX = window.screenX;
      lastWindowY = window.screenY;

      if (isCollapsed) {
        expandBall();
        cancelCollapseTimer();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (!isDragging) return;
      isDragging = false;

      const elapsed = Date.now() - mouseDownTime;
      const dx = Math.abs(e.screenX - dragStartX);
      const dy = Math.abs(e.screenY - dragStartY);

      if (!dragStarted && elapsed < 300 && dx < 5 && dy < 5) {
        if (isFanOpen) {
          closeFan();
        } else {
          openFan();
        }
      }

      if (dragStarted) {
        setTimeout(() => checkEdgeAndCollapse(), 100);
      }
    });

    ball.addEventListener('mouseenter', () => {
      cancelCollapseTimer();
      if (isCollapsed) {
        expandBall();
      }
    });

    ball.addEventListener('mouseleave', () => {
      if (!isFanOpen && !isDragging) {
        checkEdgeAndCollapse();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  function handleMousePenetration(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const isInteractive = el && (
      el === ball || ball.contains(el) ||
      (el.closest && el.closest('.fan-item'))
    );

    if (isInteractive && !isMouseInInteractiveArea) {
      isMouseInInteractiveArea = true;
      window.api.setFloatingIgnoreMouse(false);
      if (fanHideTimer) {
        clearTimeout(fanHideTimer);
        fanHideTimer = null;
      }
    } else if (!isInteractive && isMouseInInteractiveArea) {
      isMouseInInteractiveArea = false;
      window.api.setFloatingIgnoreMouse(true);
      if (isFanOpen && !isDragging) {
        fanHideTimer = setTimeout(() => {
          closeFan();
        }, 600);
      }
    }
  }

  function handleFanHover(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const fanItem = el && el.closest ? el.closest('.fan-item') : null;

    if (fanItem && fanItem !== currentHoveredItem) {
      currentHoveredItem = fanItem;
      const shortcutId = fanItem.dataset.shortcutId;
      const shortcut = shortcuts.find(s => s.id === shortcutId);
      if (shortcut) {
        showTooltipForItem(shortcut.name, fanItem);
      }
    } else if (!fanItem && currentHoveredItem) {
      currentHoveredItem = null;
      hideTooltip();
    }
  }

  function handleDrag(e) {
    const dx = e.screenX - dragStartX;
    const dy = e.screenY - dragStartY;

    if (!dragStarted && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
      dragStarted = true;
      if (isFanOpen) {
        const ballCenterScreenX = window.screenX + ballLeft + BALL_SIZE / 2;
        const ballCenterScreenY = window.screenY + ballTop + BALL_SIZE / 2;
        closeFan();
        lastWindowX = ballCenterScreenX - BALL_SIZE / 2 - PADDING;
        lastWindowY = ballCenterScreenY - BALL_SIZE / 2 - PADDING;
        dragStartX = e.screenX;
        dragStartY = e.screenY;
        return;
      }
    }

    if (dragStarted) {
      const newX = lastWindowX + (e.screenX - dragStartX);
      const newY = lastWindowY + (e.screenY - dragStartY);
      window.api.updateFloatingPosition({ x: newX, y: newY });
    }
  }

  function checkEdgeAndCollapse() {
    const x = window.screenX;
    const screenWidth = screen.availWidth;

    if (x <= EDGE_THRESHOLD || x + getCurrentWindowWidth() >= screenWidth - EDGE_THRESHOLD) {
      if (!isCollapsed) {
        startCollapseTimer();
      }
    } else {
      cancelCollapseTimer();
      if (isCollapsed) {
        expandBall();
      }
    }
  }

  function getCurrentWindowWidth() {
    return isCollapsed ? COLLAPSED_WIDTH : BALL_SIZE;
  }

  function startCollapseTimer() {
    cancelCollapseTimer();
    collapseTimer = setTimeout(() => {
      collapseBall();
    }, COLLAPSE_DELAY);
  }

  function cancelCollapseTimer() {
    if (collapseTimer) {
      clearTimeout(collapseTimer);
      collapseTimer = null;
    }
  }

  function collapseBall() {
    const x = window.screenX;
    const screenWidth = screen.availWidth;
    isCollapsed = true;
    ball.classList.add('ball-collapsed');

    const smallW = COLLAPSED_WIDTH + PADDING * 2;
    const smallH = BALL_SIZE + PADDING * 2;

    positionBallInWindow(PADDING, PADDING);

    if (x <= screenWidth / 2) {
      setWindowBounds(0, window.screenY, smallW, smallH);
    } else {
      setWindowBounds(screenWidth - smallW, window.screenY, smallW, smallH);
    }
  }

  function expandBall() {
    isCollapsed = false;
    ball.classList.remove('ball-collapsed');

    const normalW = BALL_SIZE + PADDING * 2;
    const normalH = BALL_SIZE + PADDING * 2;

    positionBallInWindow(PADDING, PADDING);
    setWindowBounds(window.screenX, window.screenY, normalW, normalH);
  }

  function determineLayout() {
    const ballCenterScreenX = window.screenX + ballLeft + BALL_SIZE / 2;
    const ballCenterScreenY = window.screenY + ballTop + BALL_SIZE / 2;

    const screenWidth = screen.availWidth;
    const screenHeight = screen.availHeight;

    const maxExtent = RING_RADII[RING_RADII.length - 1] + FAN_ITEM_SIZE / 2 + PADDING;

    const nearLeft = ballCenterScreenX < maxExtent;
    const nearRight = ballCenterScreenX > screenWidth - maxExtent;
    const nearTop = ballCenterScreenY < maxExtent;
    const nearBottom = ballCenterScreenY > screenHeight - maxExtent;

    let angleStart, angleEnd;

    if (nearLeft && nearTop) {
      angleStart = 0;
      angleEnd = Math.PI / 2;
    } else if (nearLeft && nearBottom) {
      angleStart = -Math.PI / 2;
      angleEnd = 0;
    } else if (nearRight && nearTop) {
      angleStart = Math.PI / 2;
      angleEnd = Math.PI;
    } else if (nearRight && nearBottom) {
      angleStart = Math.PI;
      angleEnd = Math.PI * 3 / 2;
    } else if (nearLeft) {
      angleStart = -Math.PI / 2;
      angleEnd = Math.PI / 2;
    } else if (nearRight) {
      angleStart = Math.PI / 2;
      angleEnd = Math.PI * 3 / 2;
    } else if (nearTop) {
      angleStart = 0;
      angleEnd = Math.PI;
    } else if (nearBottom) {
      angleStart = Math.PI;
      angleEnd = Math.PI * 2;
    } else {
      angleStart = 0;
      angleEnd = Math.PI * 2;
    }

    return { angleStart, angleEnd, nearLeft, nearRight, nearTop, nearBottom };
  }

  function calculateRings(count, layout) {
    const angularFraction = (layout.angleEnd - layout.angleStart) / (2 * Math.PI);
    const rings = [];
    let remaining = count;

    for (let i = 0; i < RING_RADII.length && remaining > 0; i++) {
      const ringCount = Math.min(remaining, Math.max(1, Math.round(RING_BASE_CAPACITIES[i] * angularFraction)));
      rings.push({ radius: RING_RADII[i], count: ringCount, ringIndex: i });
      remaining -= ringCount;
    }

    while (remaining > 0) {
      const nextIdx = rings.length;
      const lastDefinedRadius = nextIdx < RING_RADII.length ? RING_RADII[nextIdx] : RING_RADII[RING_RADII.length - 1] + 60 * (nextIdx - RING_RADII.length + 1);
      const lastDefinedCap = nextIdx < RING_BASE_CAPACITIES.length ? RING_BASE_CAPACITIES[nextIdx] : 30;
      const ringCount = Math.min(remaining, Math.max(1, Math.round(lastDefinedCap * angularFraction)));
      rings.push({ radius: lastDefinedRadius, count: ringCount, ringIndex: nextIdx });
      remaining -= ringCount;
    }

    return rings;
  }

  function computeExtents(maxRadius, angleStart, angleEnd) {
    const r = maxRadius + FAN_ITEM_SIZE / 2;
    let extentRight = 0, extentLeft = 0, extentDown = 0, extentUp = 0;

    const steps = 360;
    for (let i = 0; i <= steps; i++) {
      const angle = angleStart + (angleEnd - angleStart) * i / steps;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      if (x > 0) extentRight = Math.max(extentRight, x);
      if (x < 0) extentLeft = Math.max(extentLeft, -x);
      if (y > 0) extentDown = Math.max(extentDown, y);
      if (y < 0) extentUp = Math.max(extentUp, -y);
    }

    return { extentRight, extentLeft, extentDown, extentUp };
  }

  function generateClipPath(angleStart, angleEnd) {
    const points = ['50% 50%'];
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const angle = angleStart + (angleEnd - angleStart) * i / steps;
      const x = 50 + 50 * Math.cos(angle);
      const y = 50 + 50 * Math.sin(angle);
      points.push(x.toFixed(2) + '% ' + y.toFixed(2) + '%');
    }
    return 'polygon(' + points.join(', ') + ')';
  }

  async function openFan() {
    if (shortcuts.length === 0) return;
    isFanOpen = true;

    const layout = determineLayout();
    const rings = calculateRings(shortcuts.length, layout);
    const maxRadius = rings[rings.length - 1].radius;

    const extents = computeExtents(maxRadius, layout.angleStart, layout.angleEnd);

    const halfBall = BALL_SIZE / 2;

    const ballCenterOffsetX = Math.max(extents.extentLeft, halfBall) + PADDING;
    const ballCenterOffsetY = Math.max(extents.extentUp, halfBall) + PADDING;

    const winW = ballCenterOffsetX + Math.max(extents.extentRight, halfBall) + PADDING;
    const winH = ballCenterOffsetY + Math.max(extents.extentDown, halfBall) + PADDING;

    const newBallLeft = ballCenterOffsetX - halfBall;
    const newBallTop = ballCenterOffsetY - halfBall;

    const ballCenterScreenX = window.screenX + ballLeft + halfBall;
    const ballCenterScreenY = window.screenY + ballTop + halfBall;

    let winX = ballCenterScreenX - ballCenterOffsetX;
    let winY = ballCenterScreenY - ballCenterOffsetY;

    const screenWidth = screen.availWidth;
    const screenHeight = screen.availHeight;
    winX = Math.max(0, Math.min(screenWidth - winW, winX));
    winY = Math.max(0, Math.min(screenHeight - winH, winY));

    ball.style.transition = 'none';
    ball.style.opacity = '0';

    await setWindowBounds(winX, winY, winW, winH);

    positionBallInWindow(newBallLeft, newBallTop);

    requestAnimationFrame(() => {
      ball.style.transition = '';
      ball.style.opacity = '1';
    });

    renderConcentricItems(rings, layout);
    fanPanel.classList.add('fan-visible');
  }

  function closeFan() {
    isFanOpen = false;
    fanPanel.classList.remove('fan-visible');
    fanPanel.innerHTML = '';
    hideTooltip();
    currentHoveredItem = null;

    ball.style.transition = 'none';
    ball.style.opacity = '0';

    if (isCollapsed) {
      const smallW = COLLAPSED_WIDTH + PADDING * 2;
      const smallH = BALL_SIZE + PADDING * 2;
      positionBallInWindow(PADDING, PADDING);
      const x = window.screenX;
      const screenWidth = screen.availWidth;
      if (x <= screenWidth / 2) {
        setWindowBounds(0, window.screenY, smallW, smallH);
      } else {
        setWindowBounds(screenWidth - smallW, window.screenY, smallW, smallH);
      }
    } else {
      const normalW = BALL_SIZE + PADDING * 2;
      const normalH = BALL_SIZE + PADDING * 2;
      const ballCenterScreenX = window.screenX + ballLeft + BALL_SIZE / 2;
      const ballCenterScreenY = window.screenY + ballTop + BALL_SIZE / 2;
      positionBallInWindow(PADDING, PADDING);
      setWindowBounds(
        ballCenterScreenX - BALL_SIZE / 2 - PADDING,
        ballCenterScreenY - BALL_SIZE / 2 - PADDING,
        normalW,
        normalH
      );
    }

    setTimeout(() => {
      ball.style.transition = '';
      ball.style.opacity = '1';
    }, 50);

    if (!isDragging) {
      checkEdgeAndCollapse();
    }
  }

  function renderConcentricItems(rings, layout) {
    fanPanel.innerHTML = '';
    const ballCenterX = ballLeft + BALL_SIZE / 2;
    const ballCenterY = ballTop + BALL_SIZE / 2;

    const clipPath = generateClipPath(layout.angleStart, layout.angleEnd);
    const lineColor = appSettings.ringLineColor || 'rgba(30, 120, 220, 0.18)';
    const lineWidth = appSettings.ringLineWidth || 1;
    const lineStyle = appSettings.ringLineStyle || 'solid';

    let borderStyle = 'solid';
    if (lineStyle === 'dashed') borderStyle = 'dashed';
    else if (lineStyle === 'dotted') borderStyle = 'dotted';

    rings.forEach((ring) => {
      const ringCircle = document.createElement('div');
      ringCircle.className = 'ring-circle';
      const ringDiameter = ring.radius * 2;
      ringCircle.style.width = ringDiameter + 'px';
      ringCircle.style.height = ringDiameter + 'px';
      ringCircle.style.left = (ballCenterX - ring.radius) + 'px';
      ringCircle.style.top = (ballCenterY - ring.radius) + 'px';
      ringCircle.style.clipPath = clipPath;
      ringCircle.style.borderColor = lineColor;
      ringCircle.style.borderWidth = lineWidth + 'px';
      ringCircle.style.borderStyle = borderStyle;
      fanPanel.appendChild(ringCircle);
    });

    let shortcutIndex = 0;
    const angleRange = layout.angleEnd - layout.angleStart;

    rings.forEach((ring, ringIdx) => {
      const angleStep = angleRange / ring.count;
      const offset = ringIdx % 2 === 1 ? angleStep / 2 : 0;

      for (let i = 0; i < ring.count; i++) {
        const shortcut = shortcuts[shortcutIndex++];
        const angle = layout.angleStart + angleStep * (i + 0.5) + offset;

        const itemCenterX = ballCenterX + Math.cos(angle) * ring.radius;
        const itemCenterY = ballCenterY + Math.sin(angle) * ring.radius;
        const itemX = itemCenterX - FAN_ITEM_SIZE / 2;
        const itemY = itemCenterY - FAN_ITEM_SIZE / 2;

        const item = document.createElement('div');
        item.className = 'fan-item';
        item.dataset.shortcutId = shortcut.id;
        item.style.left = itemX + 'px';
        item.style.top = itemY + 'px';

        if (shortcut.icon) {
          const img = document.createElement('img');
          img.src = shortcut.icon;
          img.draggable = false;
          img.onerror = function () {
            this.style.display = 'none';
            const fallback = document.createElement('div');
            fallback.className = 'default-icon';
            fallback.textContent = shortcut.name.charAt(0).toUpperCase();
            item.appendChild(fallback);
          };
          item.appendChild(img);
        } else {
          const fallback = document.createElement('div');
          fallback.className = 'default-icon';
          fallback.textContent = shortcut.name.charAt(0).toUpperCase();
          item.appendChild(fallback);
        }

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          launchShortcut(shortcut);
        });

        fanPanel.appendChild(item);

        requestAnimationFrame(() => {
          setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'scale(1)';
          }, ringIdx * 80 + i * 30);
        });
      }
    });
  }

  function showTooltipForItem(name, itemEl) {
    tooltip.textContent = name;
    const itemRect = itemEl.getBoundingClientRect();
    tooltip.style.left = (itemRect.left + itemRect.width / 2) + 'px';
    tooltip.style.top = (itemRect.top - 8) + 'px';
    tooltip.style.transform = 'translate(-50%, -100%)';
    tooltip.classList.remove('tooltip-hidden');
    tooltip.classList.add('tooltip-visible');
  }

  function hideTooltip() {
    tooltip.classList.remove('tooltip-visible');
    tooltip.classList.add('tooltip-hidden');
  }

  async function launchShortcut(shortcut) {
    const result = await window.api.launchShortcut(shortcut.path);
    if (result.error) {
      tooltip.textContent = result.error;
      tooltip.style.left = (ballLeft + BALL_SIZE / 2) + 'px';
      tooltip.style.top = ballTop + 'px';
      tooltip.style.transform = 'translate(-50%, -100%)';
      tooltip.classList.remove('tooltip-hidden');
      tooltip.classList.add('tooltip-visible');
      setTimeout(() => hideTooltip(), 2000);
    } else {
      closeFan();
    }
  }

  init();
})();
