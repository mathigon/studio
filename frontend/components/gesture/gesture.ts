// =============================================================================
// Gesture Component
// (c) Mathigon
// =============================================================================


import {Point} from '@mathigon/euclid';
import {$, CustomElementView, ElementView, register} from '@mathigon/boost';
import template from './gesture.pug';


function getPosition($gesture: ElementView, $element: ElementView) {
  const x = $element.positionLeft - $gesture.positionLeft + $element.width / 2;
  const y = $element.positionTop - $gesture.positionTop + $element.height / 2;
  return new Point(x, y);
}

function parseAttr(attr: string) {
  return attr ? new Point(...attr.split(',').map(x => +x)) : undefined;
}


@register('x-gesture', {template})
export class Gesture extends CustomElementView {
  private slide?: Point;
  private shift?: Point;

  private doAnimation = false;
  private $end?: ElementView;
  private $target?: ElementView;

  from?: Point;  // Can be set by parent elements.

  created() {
    this.slide = parseAttr(this.attr('slide'));
    this.shift = parseAttr(this.attr('offset'));
  }

  ready() {
    this.$target = $(this.attr('target'));
    if (this.$target) {
      this.$target.on('click pointerdown focus', () => this.stop());
      if (this.hasAttr('start')) this.start();
    }
  }

  setTarget($target: string|ElementView, slide?: Point, shift?: Point) {
    this.$target = (typeof $target === 'string') ? $($target) : $target;
    if (slide) this.slide = slide;
    if (shift) this.slide = shift;
  }

  start(slide?: Point) {
    if (this.doAnimation || (!this.from && !this.$target)) return;
    this.doAnimation = true;

    if (slide) this.slide = slide;

    if (this.slide || this.$end) {
      this.runSlideAnimation();
    } else {
      this.runClickAnimation();
    }
  }

  startSlide($from: ElementView, $to: ElementView) {
    this.$target = $from;
    this.$end = $to;
    this.start();
  }

  stop() {
    this.doAnimation = false;
  }

  private async runSlideAnimation() {
    this.show();

    let p = this.from || getPosition(this, this.$target!);
    if (this.shift) p = p.add(this.shift);

    const q = this.slide ? p.add(this.slide) : getPosition(this, this.$end!);

    const start = `translate(${p.x - 15}px,${p.y - 10}px)`;
    const end = `translate(${q.x - 15}px,${q.y - 10}px)`;

    await this.animate({transform: [start + ' scale(2)', start], opacity: [0, 1]}, 300).promise;
    await this.animate({transform: [start, end]}, 1000).promise;
    await this.animate({transform: [end, end + ' scale(2)'], opacity: [1, 0]}, 300).promise;

    this.hide();
    setTimeout(() => {
      if (this.doAnimation) this.runSlideAnimation();
    }, 1000);
  }

  private async runClickAnimation() {
    this.show();

    let p = this.from || getPosition(this, this.$target!);
    if (this.shift) p = p.add(this.shift);
    const posn = `translate(${p.x - 15}px,${p.y - 10}px)`;

    await this.animate({transform: [posn + ' scale(2)', posn], opacity: [0, 1]}, 500).promise;
    await this.animate({transform: [posn, posn + ' scale(2)'], opacity: [1, 0]}, 500, 200).promise;

    this.hide();
    setTimeout(() => {
      if (this.doAnimation) this.runClickAnimation();
    }, 1000);
  }

}
