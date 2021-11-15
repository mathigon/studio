// =============================================================================
// Sortable Component
// (c) Mathigon
// =============================================================================


import {cumulative, last, sortBy, total} from '@mathigon/core';
import {Browser, CustomElementView, Draggable, register} from '@mathigon/boost';
import {Bounds} from '@mathigon/euclid';
import {Step, StepComponent, UserData} from '../step/step';


interface Item {
  drag: Draggable;
  index: number;
  h: number;
}

function position(items: Item[], except?: Item) {
  const cumHeights = cumulative(items.map(s => s.h + 10));
  for (const [i, item] of items.entries()) {
    // TODO Animate this
    item.drag.bounds = new Bounds(0, 0, 0, last(cumHeights));
    if (item !== except) item.drag.setPosition(0, cumHeights[i - 1] || 0);
  }
}

function check(items: Item[]) {
  return items.every((item, i) => item.index === i) ||
         items.every((item, i) => item.index === items.length - i - 1);
}


@register('x-sortable')
export class Sortable extends CustomElementView implements StepComponent {
  private items!: Item[];

  ready() {
    this.items = this.children.map($i => ({
      drag: new Draggable($i, {moveX: false, useTransform: true}),
      index: +$i.data.index!,
      h: 0
    }));

    // Hide solutions from DOM
    for (const $i of this.children) $i.removeAttr('data-index');

    for (const item of this.items) {
      item.drag.on('drag', () => {
        // TODO Fix margins
        this.items = sortBy(this.items, i => i.drag.position.y - (i === item ? 10 : 0));
        position(this.items, item);
      });

      item.drag.on('end', () => {
        position(this.items);
        if (check(this.items)) this.solve();
      });
    }

    Browser.onResize(() => {
      for (const item of this.items) item.h = item.drag.$el.height;
      const height = total(this.items.map(d => d.h));
      this.css('height', height + this.items.length * 10 - 10 + 'px');
      position(this.items);
    });
  }

  setup($step: Step, goal: string, userData?: UserData) {
    if (userData?.scores?.includes(goal)) this.solve();

    this.one('solve', () => {
      $step.addHint('correct');
      $step.score(goal);
    });
  }

  solve() {
    this.trigger('solve');
    this.addClass('solved');
    for (const item of this.items) item.drag.disabled = true;
  }
}
