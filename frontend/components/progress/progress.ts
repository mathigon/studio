// =============================================================================
// Progress Component
// (c) Mathigon
// =============================================================================


import {tabulate} from '@mathigon/core';
import {$N, animate, CustomElementView, ease, register, SVGParentView, SVGView} from '@mathigon/boost';


const PADDING = 12;

function getProgress(r: number) {
  return `M${r},${r/2}a${r/2},${r/2},0,0,1,0,${r}A${r/2},${r/2},0,0,1,${r},${r/2}`;
}

function getCheck(r: number) {
  return `M ${r},0 C ${r/2},0,0,${r/2},0,${r}  s ${r/2},${r},${r},${r} ` +
         `s ${r}-${r/2},${r}-${r}     S ${r*1.5},0,${r},0 z ` +
         `M ${r*44.6/50},${r*76.1/50} L ${r*19.2/50},${r*48.8/50} ` +
         `l ${r*4/50}-${r*4.2/50}     l ${r*19.8/50},${r*11.9/50} ` +
         `l ${r*34.2/50}-${r*32.6/50} l ${r*3.5/50},${r*3.5/50} ` +
         `L ${r*44.6/50},${r*76.1/50} z`;
}


@register('x-progress')
export class Progress extends CustomElementView {
  private r!: number;
  private r1!: number;
  private completed = false;

  private $svg!: SVGParentView;
  private $progress!: SVGView;

  ready() {
    this.r = +this.attr('r') || 10;
    this.r1 = this.r + PADDING;

    this.$svg = $N('svg', {width: 2 * this.r1, height: 2 * this.r1}, this) as SVGParentView;

    this.$progress = $N('path', {
      class: 'pie', d: getProgress(this.r),
      'stroke-width': this.r
    }, this.$svg) as SVGView;

    this.onAttr('p', (p) => this.setProgress(+p, false));
  }

  setProgress(p: number, animation = true) {
    if (p > 0.99) return this.complete(animation);
    const c = Math.PI * this.r;
    this.$progress.css('stroke', p ? 'currentColor' : 'none');
    this.$progress.css('stroke-dasharray', `${p * c} ${c}`);
  }

  complete(animation = true) {
    if (this.completed) return;
    this.completed = true;

    this.$progress.css('stroke', 'none');
    this.$progress.css('fill', 'currentColor');
    this.$progress.setAttr('d', getCheck(this.r));

    if (!animation) return;

    const transform = `translate(${this.r1} ${this.r1})`;
    const $g = $N('g', {transform}, this.$svg);
    const $burst = tabulate(() => $N('line', {}, $g) as SVGView, 18);

    animate(p => {
      const r1 = this.r + PADDING * ease('quint-out', p);
      const r2 = this.r + PADDING * p;
      for (let i = 0; i < 18; ++i) {
        const c = Math.cos(Math.PI * 2 * i / 18);
        const s = Math.sin(Math.PI * 2 * i / 18);
        $burst[i].setLine({x: c * r1, y: s * r1}, {x: c * r2, y: s * r2});
      }
    }, 800).promise.then(() => $g.remove());
  }
}
