// =============================================================================
// Draggable Component
// (c) Mathigon
// =============================================================================


import {$html, animate, Browser, ElementView, slide, SVGParentView} from '@mathigon/boost';
import {applyDefaults, EventTarget} from '@mathigon/core';
import {Bounds, Point} from '@mathigon/euclid';


interface DraggableOptions {
  /** The container within which this element is being dragged. */
  $parent?: ElementView;
  /** Whether to constrain the elements to within the bounds of $parent. */
  withinBounds?: boolean;
  /** Whether it is draggable along the x-axis. */
  moveX?: boolean;
  /** Whether it is draggable along the y-axis. */
  moveY?: boolean;
  /** Interval for snapping (in px) */
  snap?: number;
  /** Whether to use CSS transforms rather than `left` and `right`. */
  useTransform?: boolean;
  /** Margin within the `$parent` element. */
  margin?: number;
  /** Custom rounding function. */
  round?: ((p: Point) => Point);
  /** Custom bounds within which the element is draggable. */
  bounds?: Bounds;
  /** Whether to reset position when dropped outside of a target */
  resetOnMiss?: boolean;
  /** Elements that the Draggable instance can be dropped onto */
  $targets?: ElementView[];
}


/**
 * A draggable and droppable HTML element.
 * @emits Draggable#click - Fired when the user clicks on this element.
 * @emits Draggable#start - Fired when the user starts dragging.
 * @emits Draggable#drag {posn: Point, pointerPosn: Point} - Fired while the user is dragging.
 * @emits Draggable#move {posn: Point} - Fired when the position of this element changes.
 * @emits Draggable#end {$target?: ElementView} - Fired after the user stops dragging this element, including the current `$target` which may be undefined.
 * @emits Draggable#enter-target {$target: ElementView} - Fired when the pointer enters the bounds of a `$target` element while dragging
 * @emits Draggable#exit-target {$target: ElementView} - Fired when the pointer exists the bounds of a `$target` element while dragging
 */
export class Draggable extends EventTarget {
  protected options: DraggableOptions;
  private startPos = new Point(0, 0);
  private $over?: ElementView;
  position = new Point(0, 0);
  disabled = false;
  bounds?: Bounds;

  constructor(readonly $el: ElementView, options: DraggableOptions = {}) {
    super();

    this.options = applyDefaults(options, {moveX: true, moveY: true, withinBounds: true});
    Browser.onResize(() => this.updateBounds());

    slide($el, {
      start: () => {
        if (this.disabled) return;
        this.startPos = this.position;
        this.trigger('start');
        $html.addClass('grabbing');
      },
      move: (posn, start) => {
        if (this.disabled) return;
        this.setPosition(this.startPos.x + posn.x - start.x, this.startPos.y + posn.y - start.y);
        this.trigger('drag', {posn: this.position, pointerPosn: posn});
        this.checkTarget(posn);
      },
      end: (last, start) => {
        if (this.disabled) return;
        this.trigger(last.equals(start) ? 'click' : 'end', {$target: this.$over});
        if (this.options.$targets && !this.$over && this.options.resetOnMiss) this.resetPosition();
        this.$over = undefined;
        $html.removeClass('grabbing');
      },
      click: () => this.trigger('click'),
      accessible: true
    });
  }


  // ---------------------------------------------------------------------------
  // Target drag-n-drop

  addTarget($target: ElementView) {
    if (!this.options.$targets) this.options.$targets = [];
    this.options.$targets?.push($target);
  }

  removeTarget($target: ElementView) {
    this.options.$targets = this.options.$targets?.filter($el => $el != $target);
    if (!this.options.$targets?.length) this.options.$targets = undefined;
  }

  private checkTarget(posn: Point) {
    if (!this.options.$targets) return;

    const $target = this.options.$targets.find($t => $t.boundsRect.contains(posn));
    if ($target === this.$over) return;

    if (this.$over) this.trigger('exit-target', {$target: this.$over});
    if ($target) this.trigger('enter-target', {$target});

    this.$over = $target;
  }


  // ---------------------------------------------------------------------------
  // Resizing and positioning

  private updateBounds() {
    if (!this.options.withinBounds) return this.bounds = undefined;
    if (this.options.bounds) return this.bounds = this.options.bounds;

    const oldBounds = this.bounds;
    const $parent = this.options.$parent || this.$el.parent!;

    const width = ($parent.type === 'svg') ? ($parent as SVGParentView).svgWidth : $parent.width;
    const height = ($parent.type === 'svg') ? ($parent as SVGParentView).svgHeight : $parent.height;
    this.bounds = new Bounds(0, width, 0, height);

    // Fallback in case the element is not yet visible...
    if (!width && !height) setTimeout(() => this.updateBounds());

    if (oldBounds) {
      // Proportionally reposition the draggable element
      this.setPosition(this.position.x * this.bounds.dx / oldBounds.dx || 0,
          this.position.y * this.bounds.dy / oldBounds.dy || 0);
    }
  }

  /** Sets the position of the element. */
  setPosition(x: number, y: number) {
    let p = new Point(this.options.moveX ? x : 0, this.options.moveY ? y : 0);
    if (this.bounds) p = p.clamp(this.bounds, this.options.margin ?? 0);
    p = p.round(this.options.snap || 1);
    if (this.options.round) p = this.options.round(p);

    if (p.equals(this.position)) return;
    this.position = p;

    if (this.options.useTransform) {
      this.$el.translate(p.x, p.y);
    } else {
      if (this.options.moveX) this.$el.css('left', p.x + 'px');
      if (this.options.moveY) this.$el.css('top', p.y + 'px');
    }

    this.trigger('move', {posn: p});
  }

  async resetPosition(duration = 250) {
    const initial = this.position;
    this.$el.css({'pointer-events': 'none'});
    await animate((p: number) => {
      const currentPos = Point.interpolate(initial, this.startPos, p);
      this.setPosition(currentPos.x, currentPos.y);
    }, duration).promise;
    this.$el.css({'pointer-events': 'initial'});
  }
}
