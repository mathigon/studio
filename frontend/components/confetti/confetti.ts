// =============================================================================
// Confetti Generator
// (c) Mathigon
// =============================================================================


import {loop, tabulate} from '@mathigon/core';
import {Random} from '@mathigon/fermat';
import {$body, $N, animate, Browser, CanvasView} from '@mathigon/boost';

const COLOURS = loop(['#cd0e66', '#0f82f2', '#22ab24', '#fd8c00']);


class Particle {
  private color = COLOURS();
  private tilt = Math.floor(Math.random() * 10) - 10;
  private tiltAngleIncrement = (Math.random() * 0.07) + .05;
  private tiltAngle = 0;

  x = Math.random() * Browser.width;
  y = (Math.random() - 1) * Browser.height;
  r = Random.uniform(10, 30);

  constructor(private index: number) { }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.lineWidth = this.r / 2;
    ctx.strokeStyle = this.color;
    ctx.moveTo(this.x + this.tilt + (this.r / 4), this.y);
    ctx.lineTo(this.x + this.tilt, this.y + this.tilt + (this.r / 4));
    ctx.stroke();
  }

  update(t: number, loop: boolean) {
    this.tiltAngle += this.tiltAngleIncrement;

    this.y += (Math.cos(t) + 3 + this.r / 2) / 2;
    this.x += Math.sin(t);
    this.tilt = (Math.sin(this.tiltAngle - (this.index / 3))) * 15;

    if (this.x < -20) {
      this.x = -20;
      this.y = Math.random() * Browser.height;
      this.tilt = Math.floor(Math.random() * 10) - 20;

    } else if (this.x > Browser.width + 20) {
      this.x = Browser.width + 20;
      this.y = Math.random() * Browser.height;
      this.tilt = Math.floor(Math.random() * 10) - 20;

    } else if (loop && this.y > Browser.height) {
      this.x = Math.random() * Browser.width;
      this.y = -10;
      this.tilt = Math.floor(Math.random() * 10) - 20;
    }
  }
}

// -----------------------------------------------------------------------------

const style = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999';
let $confetti: CanvasView|undefined = undefined;

export function confetti(duration = 2000, maxParticles = 150) {
  if (!$confetti) $confetti = $N('canvas', {style}, $body) as CanvasView;
  $confetti.setAttr('width', Browser.width);
  $confetti.setAttr('height', Browser.height);
  $confetti.show();

  const context = $confetti.ctx;
  const particles = tabulate(i => new Particle(i), maxParticles);

  const animation = animate(t => {
    context.clearRect(0, 0, Browser.width, Browser.height);

    const loop = t < duration;
    let visible = 0;

    for (const p of particles) {
      p.draw(context);
      p.update(t, loop);
      if (p.y < Browser.height) visible += 1;
    }

    if (!visible) {
      animation.cancel();
      $confetti!.hide();
    }
  });
}
