// =============================================================================
// Target Component
// (c) Mathigon
// =============================================================================


import {delay, isOneOf} from '@mathigon/core';
import {intersections, Point, Rectangle, Segment} from '@mathigon/euclid';
import {$, $$, $body, $N, Browser, CustomElementView, ElementView, register, SVGView} from '@mathigon/boost';
import template from './target.pug';


function connect(from: ClientRect, to: ClientRect, fromShift: number, toShift: number) {
  const fromPoint = new Point(from.left - 15, from.top + fromShift - 15);
  const fromRect = new Rectangle(fromPoint, from.width + 30, from.height + 30);

  const toPoint = new Point(to.left - 15, to.top + toShift - 15);
  const toRect = new Rectangle(toPoint, to.width + 30, to.height + 30);

  const path = new Segment(fromRect.center, toRect.center);
  return [intersections(path, fromRect)[0], intersections(path, toRect)[0]];
}

function distance(a: [number, number], b: [number, number]) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}


// Parent elements with position: fixed, which we cannot scroll into view.
const $fixed = $$('header, x-tutor, .sidebar');

const $targets = $N('svg', {class: 'target-body', html: template}, $body);
const $mask = $targets.$('mask')!;
const $arrow = $targets.$('.target-arrow') as SVGView;

let active = false;
let $bounds: ElementView[] = [];

// -----------------------------------------------------------------------------

@register('x-target')
export class Target extends CustomElementView {

  ready() {
    this.setAttr('tabindex', 0);

    const query = this.attr('to').replace(/_/g, ' ');
    const noMargins = this.hasClass('no-margins');
    let sourceFixed: boolean|undefined = undefined;

    let start: [number, number];
    let scroll: number;
    let showTimeout: number;

    const enter = () => {
      active = true;

      const $targets = $$(query);
      if (!$targets.length) return;

      const targetFixed = $targets[0].hasParent(...$fixed);
      if (sourceFixed === undefined) sourceFixed = this.hasParent(...$fixed);

      const sourceBounds = this.bounds;
      const bounds = $targets.map(x => x.bounds).filter(x => x.width || x.height);
      scroll = 0;

      if (!targetFixed) {
        const top = Math.min(...bounds.map(x => x.top));
        const bottom = Math.max(...bounds.map(x => x.top + x.height));

        const scrollUp = Browser.height - 12 - bottom;
        const scrollDown = (ENV === 'MOBILE' ? 12 : 56) - top;
        scroll = scrollUp < 0 ? scrollUp : scrollDown > 0 ? scrollDown : 0;
      }

      for (const $b of $bounds) $b.remove();

      $bounds = [sourceBounds, ...bounds].map((b, i) => {
        const margin = (!i || noMargins) ? 4 : 10;
        return $N('rect', {
          x: b.left - margin,
          y: b.top - margin + (i || !sourceFixed ? scroll : 0),
          width: b.width + 2 * margin,
          height: b.height + 2 * margin,
          rx: i ? 4 : 18, ry: i ? 4 : 18
        }, $mask);
      });

      $arrow.points = connect(sourceBounds, bounds[0],
          sourceFixed ? 0 : scroll, targetFixed ? 0 : scroll);
    };

    const show = () => {
      if (scroll) $body.scrollBy(-scroll, 300);
      $targets.css('display', 'block');
      Browser.redraw();
      delay(function() {
        $targets.css('opacity', 1);
      }, scroll ? 300 : 0);
    };

    const exit = (event?: PointerEvent) => {
      if (!active) return;

      if (event) {
        const moveEvent = isOneOf(event.type, 'mousemove', 'pointermove');
        if (moveEvent && distance(start, [event.clientX, event.clientY]) < 40) {
          return;
        }
      }

      clearTimeout(showTimeout);
      active = false;

      $targets.css('opacity', 0);
      setTimeout(() => {
        if (!active) $targets.css('display', 'none');
      }, 300);

      $body.off('mousewheel mousemove touchend touchmove', exit);
      this.off('mouseleave blur', exit);
    };

    const bindExit = () => {
      if (scroll && !sourceFixed) {
        $body.on('mousemove', exit);
      } else {
        this.on('mouseleave', exit);
      }
      $body.on('mousewheel touchend touchmove', exit);
      this.on('blur', exit);
    };

    this.on('mouseenter touchstart focus', (e) => {
      start = [e.clientX, e.clientY];
      enter();
      showTimeout = window.setTimeout(show, scroll ? 50 : 30);
      bindExit();
    });

    this.on('click', (e) => {
      if (active) {
        e.handled = true;
        exit();
        // Timeout, so that clickOutside is triggered after click.
        setTimeout(() => $(query)!.trigger('click mousedown'));
      } else {
        active = true;
        scroll = 0;
        show();
        bindExit();
      }
    });
  }
}
