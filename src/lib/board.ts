/**
 * Pan/zoom for the schema board — the whiteboard interaction model.
 *
 * One wrapper element gets a single `translate(...) scale(...)`; nothing else
 * moves. That keeps 15 table nodes and 15 SVG edges on the compositor instead
 * of re-laying out the diagram on every frame.
 *
 * Gestures, all through Pointer Events so mouse, touch and pen share one path:
 *   - drag to pan, with pointer capture so a drag that leaves the window still
 *     tracks
 *   - wheel to pan, ctrl/cmd+wheel to zoom at the pointer (the convention
 *     trackpad users expect, and trackpad pinch arrives as exactly that event)
 *   - two pointers to pinch-zoom
 *   - arrow keys to pan, + / - to zoom, 0 to fit
 *
 * The caller owns all copy and markup. This module only does geometry.
 */

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface BoardOptions {
  /** The clipping element. Gestures and keys are bound here. */
  viewport: HTMLElement;
  /** The single transformed wrapper. */
  world: HTMLElement;
  /** The fixed-size canvas inside the world, used for fit and clamping. */
  content: HTMLElement;
  /** Space a focused node must stay clear of; read fresh on every call. */
  insets?: () => Insets;
  /**
   * Space to leave when fitting. Usually looser than `insets`: the overlays
   * are chrome floating over a canvas, so the diagram may sit under their
   * edges — it only has to stay clear of the nav and the command bar.
   */
  fitInsets?: () => Insets;
  /** Dot spacing of the grid at scale 1, in px. */
  gridStep?: number;
}

export interface Board {
  /** Multiply the scale, anchored at the centre of the safe area. */
  zoomBy(factor: number): void;
  /** Fit the whole content into the safe area and centre it. */
  fit(): void;
  /** Pan an element of the content into the safe area, moving as little as possible. */
  reveal(el: HTMLElement): void;
  /** True once the visitor has panned or zoomed by hand. */
  touched(): boolean;
}

const MIN_SCALE = 0.35;
const MAX_SCALE = 2.5;
/** How much of the content must stay on screen, so the board is never lost. */
const KEEP = 140;
/** A drag past this many px is a pan, not a click. */
const DRAG_SLOP = 4;

const noInsets = (): Insets => ({ top: 0, right: 0, bottom: 0, left: 0 });

export function createBoard(options: BoardOptions): Board {
  const { viewport, world, content } = options;
  const insets = options.insets ?? noInsets;
  const fitInsets = options.fitInsets ?? insets;
  const gridStep = options.gridStep ?? 22;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  let scale = 1;
  let tx = 0;
  let ty = 0;
  let easeTimer = 0;
  let touched = false;

  /* Sizes are cached so a drag never reads layout between writes: the hot
     path then writes styles only, and no frame has to measure anything. */
  let vw = 0;
  let vh = 0;
  let cw = 1;
  let ch = 1;
  let rect = { left: 0, top: 0 };

  function measure() {
    vw = viewport.clientWidth;
    vh = viewport.clientHeight;
    cw = content.offsetWidth || 1;
    ch = content.offsetHeight || 1;
    const box = viewport.getBoundingClientRect();
    rect = { left: box.left, top: box.top };
  }

  /* -- Transform ---------------------------------------------------- */

  const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

  /** Keep at least KEEP px of the content inside the viewport. */
  function clampOffset() {
    const minX = KEEP - cw * scale;
    const maxX = vw - KEEP;
    const minY = KEEP - ch * scale;
    const maxY = vh - KEEP;

    tx = minX > maxX ? (minX + maxX) / 2 : Math.min(maxX, Math.max(minX, tx));
    ty = minY > maxY ? (minY + maxY) / 2 : Math.min(maxY, Math.max(minY, ty));
  }

  function paint() {
    world.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    // The grid lives on the still viewport but is driven by the same numbers,
    // so it reads as one surface sliding under the diagram — and it covers the
    // whole screen instead of stopping at the content's edge.
    viewport.style.setProperty('--board-gap', `${gridStep * scale}px`);
    viewport.style.setProperty('--board-x', `${tx}px`);
    viewport.style.setProperty('--board-y', `${ty}px`);
  }

  function commit() {
    clampOffset();
    paint();
  }

  /**
   * Land any transform transition still in flight on the value it was
   * committed to.
   *
   * Dropping the `is-eased` class is not enough: with no `transition-property`
   * of its own the element falls back to `all`, which still covers `transform`,
   * so the browser keeps a running transition alive to its full duration. Until
   * it ends, what is on screen is an interpolated value, and the next
   * transition would start from that half-way point rather than from the
   * transform the board actually holds. On a renderer that is not getting
   * frames — a window behind another one, a busy machine — "half-way" is still
   * the old position, so a press looks ignored, and a press the other way looks
   * like it moved the wrong way.
   */
  function settle() {
    if (typeof world.getAnimations !== 'function') return;
    for (const animation of world.getAnimations()) {
      const property = (animation as unknown as { transitionProperty?: string }).transitionProperty;
      if (property !== 'transform') continue;
      try {
        animation.finish();
      } catch {
        /* a transition the browser has already retired */
      }
    }
  }

  /** Smooth only the discrete jumps: buttons, keys, fit, reveal. */
  function ease() {
    settle();
    if (reduce.matches) return;
    world.classList.add('is-eased');
    window.clearTimeout(easeTimer);
    easeTimer = window.setTimeout(() => world.classList.remove('is-eased'), 240);
  }

  function snap() {
    window.clearTimeout(easeTimer);
    world.classList.remove('is-eased');
    // A drag or a wheel must take over from where the board really is, not
    // fight a jump that is still playing out.
    settle();
  }

  /* -- Zoom --------------------------------------------------------- */

  /** Anchor the zoom at a client point, so it feels like a real canvas. */
  function zoomAt(factor: number, clientX: number, clientY: number) {
    const next = clampScale(scale * factor);
    if (next === scale) return;

    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const wx = (px - tx) / scale;
    const wy = (py - ty) / scale;

    scale = next;
    tx = px - wx * scale;
    ty = py - wy * scale;
    commit();
  }

  function zoomCentre(factor: number) {
    // The cached box is from the last gesture, resize or fit; the bars around
    // the board can have changed height since (a result panel opening, say),
    // and a stale anchor would pull the diagram off centre.
    measure();
    const box = fitInsets();
    zoomAt(
      factor,
      rect.left + (box.left + vw - box.right) / 2,
      rect.top + (box.top + vh - box.bottom) / 2
    );
  }

  function fitNow() {
    measure();
    const box = fitInsets();
    const availW = Math.max(120, vw - box.left - box.right);
    const availH = Math.max(120, vh - box.top - box.bottom);

    scale = clampScale(Math.min(availW / cw, availH / ch));
    tx = box.left + (availW - cw * scale) / 2;
    ty = box.top + (availH - ch * scale) / 2;
    commit();
  }

  function reveal(el: HTMLElement) {
    measure();
    const box = insets();
    const pad = 12;
    // offsetLeft/Top are relative to the positioned canvas, i.e. world space,
    // and are not affected by the transform.
    const x = tx + el.offsetLeft * scale;
    const y = ty + el.offsetTop * scale;
    const w = el.offsetWidth * scale;
    const h = el.offsetHeight * scale;

    const minX = box.left + pad;
    const maxX = vw - box.right - pad;
    const minY = box.top + pad;
    const maxY = vh - box.bottom - pad;

    let dx = 0;
    let dy = 0;
    if (x < minX) dx = minX - x;
    else if (x + w > maxX) dx = Math.max(maxX - (x + w), minX - x);
    if (y < minY) dy = minY - y;
    else if (y + h > maxY) dy = Math.max(maxY - (y + h), minY - y);

    if (!dx && !dy) return;
    tx += dx;
    ty += dy;
    ease();
    commit();
  }

  /* -- Pointer: drag to pan, two fingers to pinch ------------------- */

  const points = new Map<number, { x: number; y: number }>();
  let pinchGap = 0;
  let moved = 0;
  let dragged = false;

  function pinchState(): { x: number; y: number; gap: number } {
    const [a, b] = Array.from(points.values());
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      gap: Math.hypot(a.x - b.x, a.y - b.y),
    };
  }

  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    snap();
    measure();
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    moved = 0;
    if (points.size === 2) pinchGap = pinchState().gap;
  });

  viewport.addEventListener('pointermove', (event) => {
    const previous = points.get(event.pointerId);
    if (!previous) return;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });

    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > DRAG_SLOP && !dragged) {
      dragged = true;
      touched = true;
      // Capture only once this is really a drag: capturing on pointerdown
      // would retarget the click that a plain tap on a table header needs.
      // From here the drag keeps tracking even outside the window.
      try {
        if (points.size === 1) viewport.setPointerCapture(event.pointerId);
      } catch {
        /* a pointer the browser no longer tracks: pan without capture */
      }
      viewport.classList.add('is-grabbing');
    }

    if (points.size >= 2) {
      const now = pinchState();
      if (pinchGap > 0) zoomAt(now.gap / pinchGap, now.x, now.y);
      pinchGap = now.gap;
      return;
    }

    tx += dx;
    ty += dy;
    commit();
  });

  function endPointer(event: PointerEvent) {
    if (!points.delete(event.pointerId)) return;
    if (points.size < 2) pinchGap = 0;
    if (points.size === 0) {
      viewport.classList.remove('is-grabbing');
      // The click that follows this pointerup gets through only if it was a tap.
      window.setTimeout(() => {
        dragged = false;
      }, 0);
    }
  }
  viewport.addEventListener('pointerup', endPointer);
  viewport.addEventListener('pointercancel', endPointer);

  // A drag that happens to end on a table header must not run its query.
  viewport.addEventListener(
    'click',
    (event) => {
      if (!dragged) return;
      event.preventDefault();
      event.stopPropagation();
    },
    true
  );

  /* -- Wheel: pan, ctrl/cmd to zoom -------------------------------- */

  viewport.addEventListener(
    'wheel',
    (event) => {
      // Never let the browser scroll the page or page-zoom instead.
      event.preventDefault();
      snap();
      measure();
      touched = true;

      // Firefox reports lines, not pixels.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const dy = event.deltaY * unit;

      if (event.ctrlKey || event.metaKey) {
        zoomAt(Math.exp(-dy * 0.0022), event.clientX, event.clientY);
        return;
      }
      tx -= event.deltaX * unit;
      ty -= dy;
      commit();
    },
    { passive: false }
  );

  /* -- Keyboard ----------------------------------------------------- */

  // Bound to the viewport, so typing in the command bar or in the drawer —
  // both outside the board — is never intercepted.
  viewport.addEventListener('keydown', (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    measure();
    const step = event.shiftKey ? 220 : 70;

    switch (event.key) {
      case 'ArrowLeft':
        tx += step;
        break;
      case 'ArrowRight':
        tx -= step;
        break;
      case 'ArrowUp':
        ty += step;
        break;
      case 'ArrowDown':
        ty -= step;
        break;
      case '+':
      case '=':
        touched = true;
        event.preventDefault();
        ease();
        zoomCentre(1.2);
        return;
      case '-':
      case '_':
        touched = true;
        event.preventDefault();
        ease();
        zoomCentre(1 / 1.2);
        return;
      case '0':
        touched = false;
        event.preventDefault();
        ease();
        fitNow();
        return;
      default:
        return;
    }

    touched = true;
    event.preventDefault();
    ease();
    commit();
  });

  /* -- Viewport changes --------------------------------------------- */

  window.addEventListener('resize', () => {
    // Re-fit only while the visitor has not taken control of the board.
    measure();
    if (touched) commit();
    else fitNow();
  });

  measure();
  paint();

  return {
    zoomBy(factor) {
      touched = true;
      ease();
      zoomCentre(factor);
    },
    fit() {
      touched = false;
      ease();
      fitNow();
    },
    reveal,
    touched: () => touched,
  };
}
