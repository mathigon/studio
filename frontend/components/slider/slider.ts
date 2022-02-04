// =============================================================================
// Slider Component
// (c) Mathigon
// =============================================================================


import {nearlyEquals} from '@mathigon/fermat';
import {animate, AnimationResponse, CustomElementView, Draggable, ease, Observable, register} from '@mathigon/boost';
import {Step, StepComponent} from '../step/step';
import template from './slider.pug';


@register('x-slider', {template})
export class Slider extends CustomElementView implements StepComponent {
  private speed!: number;
  private drag!: Draggable;
  private animation?: AnimationResponse;

  steps!: number;
  current = 0;

  ready() {
    this.onAttr('steps', s => this.steps = +s);
    this.speed = +this.attr('speed') || 1;

    const $bar = this.$('.bar')!;
    const $knob = this.$('.knob')!;

    // TODO Make the play button a toggle, that can also pause the animation.
    const $play = this.$('.play')!;
    if (this.hasAttr('no-play')) {
      $play.remove();
    } else {
      $play.on('click', () => this.play());
    }

    const continuous = this.hasAttr('continuous');
    const snap = this.hasAttr('snap') ? $bar.width / this.steps : 0.001;

    this.drag = new Draggable($knob, {moveY: false, snap});

    this.drag.on('start', () => {
      if (this.animation) this.animation.cancel();
      this.animation = undefined;
    });

    this.drag.on('move', ({posn}) => {
      let n = posn.x / this.drag.bounds!.dx * this.steps;
      if (!continuous) n = Math.round(n);
      if (nearlyEquals(n, this.current)) return;
      this.current = n;
      this.trigger('move', n);
    });

    this.drag.on('end', () => this.trigger('slide-end'));
  }

  setup($step: Step, goal: string) {
    this.bindModel($step.model);
    this.one('slide-end', () => $step.score(goal));
  }

  set(x: number) {
    if (nearlyEquals(x, this.current)) return;
    this.drag.setPosition(x * this.drag.bounds!.dx / this.steps, 0);
  }

  async play() {
    if (this.current >= this.steps) this.set(0);
    const duration = (1 - this.current / this.steps) * 3000 / this.speed;
    this.moveTo(this.steps, duration);
  }

  async moveTo(x: number, duration = 600) {
    if (this.animation || x === this.current) return;
    const start = this.current;

    this.animation = animate((p) => {
      this.set(start + (x - start) * ease('quad', p));
    }, duration);

    await this.animation.promise;
    this.animation = undefined;
    this.trigger('slide-end');
  }

  bindVariable(model: Observable, name: string) {
    model[name] = 0;
    this.on('move', (n: number) => model[name] = n);
    model.watch(() => this.set(model[name]));
  }
}
