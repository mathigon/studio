// =============================================================================
// Tabbox Component
// (c) Mathigon
// =============================================================================


import {$N, CustomElementView, ElementView, HTMLView, register} from '@mathigon/boost';


const template = '<div class="titles"></div><div class="body"><slot></slot></div>';

@register('x-tabbox', {template})
export class Tabbox extends CustomElementView {
  private $body!: ElementView;
  private $titles: ElementView[] = [];
  private $tabs!: HTMLView[];
  active = 0;

  ready() {
    const $titles = this.$('.titles')!;
    this.$body = this.$('.body')!;
    this.$tabs = this.$$('.tab') as HTMLView[];

    for (let i = 0; i < this.$tabs.length; ++i) {
      const $title = this.$tabs[i].$('h3') || $N('h3');
      $title.setAttr('tabindex', '0');
      $titles.append($title);
      this.$titles.push($title);
      $title.on('click', () => this.makeActive(i));
    }

    this.$titles[0].addClass('active');
    this.$tabs[0].show();
  }

  makeActive(i: number) {
    if (this.active === i) return;

    this.$titles[this.active].removeClass('active');
    this.$titles[i].addClass('active');

    this.$tabs[i].show();
    const newHeight = this.$tabs[i].outerHeight + 'px';
    this.$tabs[i].hide();

    this.$tabs[this.active].exit('fade', 300)
        .promise.then(() => this.$tabs[i].enter('fade', 300));

    this.$body.animate({height: newHeight}, 600)
        .promise.then(() => this.$body.css('height', 'auto'));

    this.active = i;
    this.trigger('change', i);
  }
}
