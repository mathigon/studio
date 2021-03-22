// =============================================================================
// Slideshow Component
// (c) Mathigon
// =============================================================================


import {$N, CustomElementView, ElementView, register} from '@mathigon/boost';
import {Step, StepComponent, UserData} from '../step/step';
import template from './slideshow.pug';


function blanksSolvePromise($slide: ElementView) {
  const $blanks = $slide.$$('x-blank, x-blank-mc');
  if (!$blanks.length) return Promise.resolve();

  let solved = 0;
  return new Promise<void>((resolve) => {
    for (const $b of $blanks) {
      $b.on('solve', () => {
        solved += 1;
        if (solved >= $blanks.length) resolve();
      });
    }
  });
}


@register('x-slideshow', {template})
export class Slideshow extends CustomElementView implements StepComponent {
  private $legend!: ElementView;
  private $steps!: ElementView[];
  private $dots!: ElementView[];
  private $back!: ElementView;
  private $next!: ElementView;

  private blanks!: Promise<void>[];
  private reveals!: ([ElementView, [number, number], [string, number]])[];

  private length = 0;
  private current = 0;
  private autoAdvance?: boolean;
  private locked = false;  // Used to prevent quick double-clicking.

  ready() {
    this.$legend = this.$('.legend-box')!;
    this.$steps = this.$legend.children;
    this.$back = this.$('.back')!;
    this.$next = this.$('.next')!;

    const $dots = this.$('.dots')!;
    this.$dots = this.$steps.map(() => $N('div', {class: 'dot'}, $dots));

    this.length = this.$steps.length;
    this.current = 0;

    this.$back.on('click', () => this.goBack());
    this.$next.on('click', () => this.goNext());

    // Prevent moving ahead of blanks have not yet been answered.
    this.blanks = this.$steps.map($s => blanksSolvePromise($s));

    // Elements that are shown or hidden automatically.
    this.reveals = this.$$('[slide]').map($el => {
      const a = $el.attr('slide').split('-');
      const range = (a.length > 1 ? [+a[0] || 0, +a[1] || this.length] : [+a[0], +a[0]]) as [number, number];
      const options = [$el.data.animation || 'fade', (+$el.data.duration!) || 400] as [string, number];
      $el.data.display = 'visibility';
      if (range[0] >= 0 && !$el.hasClass('reveal')) $el.hide();
      return [$el, range, options];
    });

    this.autoAdvance = this.attr('step') === 'auto';

    this.$steps[0].show();
    this.$dots[0].addClass('on');
    this.setupSlide(0);
  }

  setup($step: Step, _id: string, userData?: UserData) {
    // Restore previous progress
    const posn = userData?.scores?.filter(s => s.startsWith('slide-')).length;
    if (posn && posn < this.$steps.length - 1) {
      this.go(posn);
      for (let i = 1; i <= posn; ++i) this.trigger('next', i);
    }

    this.on('next', (n: number) => $step.score('slide-' + (n - 1)));
  }

  private go(x: number) {
    if (this.locked || x < 0 || x > this.length - 1 || x === this.current) return;

    this.locked = true;
    setTimeout(() => this.locked = false, 600);

    this.$back.setClass('disabled', x === 0);
    this.$next.setClass('disabled', x === this.length - 1);

    this.$dots[this.current].removeClass('on');
    this.$dots[x].addClass('on');

    this.$steps[x].show();
    const newHeight = this.$steps[x].height + 'px';
    this.$steps[x].hide();

    this.$steps[this.current].exit('fade', 300).promise
        .then(() => this.$steps[x].enter('fade', 300));

    this.$legend.animate({height: newHeight}, 600).promise
        .then(() => this.$legend.css('height', 'auto'));

    this.setupSlide(x);
    this.current = x;
    this.trigger('step', x);
  }

  private setupSlide(x: number) {
    this.$next.setAttr('disabled', 'true');
    this.blanks[x].then(() => this.$next.removeAttr('disabled'));

    // Automatically go to next step when blanks are solved for the first time.
    // TODO if (this.autoAdvance) this.blanks[x].then(() => this.goNext());

    for (const [$el, range, options] of this.reveals) {
      if ($el.hasClass('reveal')) continue;
      const isVisible = $el.css('visibility') !== 'hidden';
      const show = x >= range[0] && x <= range[1];
      if (show && !isVisible) $el.enter(...options, 300);
      if (!show && isVisible) $el.exit(...options);
    }
  }

  goNext() {
    if (this.locked) return;
    this.go(this.current + 1);
    this.trigger('next', this.current);
  }

  goBack() {
    if (this.locked) return;
    this.go(this.current - 1);
    this.trigger('back', this.current);
  }
}
