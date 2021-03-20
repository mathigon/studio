// =============================================================================
// Glossary Component
// (c) Mathigon
// =============================================================================


import {$, Browser, CustomElementView, ElementView, hover, register} from '@mathigon/boost';
import {Modal} from '../modal/modal';
import template from './gloss.pug';


// TODO Read JSON from <x-course>
const glossary = JSON.parse($('#glossary')!.text);
const bios = JSON.parse($('#bios')!.text);
const WIDTH_SMALL = 600;  // Needs to match the CSS.

let activeGloss: Gloss|undefined = undefined;
Browser.onResize(() => {
  if (activeGloss) activeGloss.hide();
});


@register('x-gloss', {template})
export class Gloss extends CustomElementView {
  private $target!: ElementView;
  private $popup!: ElementView;
  protected xid!: string;

  ready() {
    this.xid = this.attr('xid');

    this.$target = this.$('.target')!;
    this.$popup = this.$('.popup')!;
    this.$popup.html = this.body() || '';

    // Set te 'left' class on load, to avoid page overflow.
    this.setClass('left', (Browser.width > WIDTH_SMALL) &&
        (this.$target.bounds.left + this.$popup.width > Browser.width - 15));

    hover(this, {
      enter: () => this.show(),
      exit: () => this.hide(),
      delay: 100,
      exitDelay: 200,
      $clickTarget: this.$target,
      canFocusWithin: true,
      preventMouseover: () => (Browser.width <= WIDTH_SMALL)
    });
  }

  show() {
    activeGloss = this;
    this.addClass('on');

    if (Browser.width <= WIDTH_SMALL) {
      const $modal = $('#glossary-modal') as Modal;
      $modal.$('.modal-body')!.html = this.body();
      return $modal.open();
    }

    const targetBounds = this.$target.bounds;
    const popupWidth = this.$popup.width;
    const popupHeight = this.$popup.height;

    const spaceBelow = targetBounds.top + targetBounds.height + popupHeight < Browser.height - 10;
    const spaceAbove = targetBounds.top - popupHeight > (ENV === 'MOBILE' ? 10 : 54);

    this.setClass('top', spaceAbove && !spaceBelow);
    this.setClass('left', targetBounds.left + popupWidth > Browser.width - 15);
  }

  hide() {
    activeGloss = undefined;
    this.removeClass('on');
  }

  body() {
    const data = glossary[this.xid];
    if (!data) return console.warn('missing gloss:', this.xid);

    let body = data.text;
    if (data.image) body += `<img class="gloss-img" alt="" src="/content/shared/glossary/${data.image}"/>`;

    if (data.link && ENV === 'WEB') {
      const samePage = (location.pathname === data.link.split('#')[0]);
      if (!samePage) body += `<p><a href="${data.link}" class="btn btn-white btn-small">Learn more…</a></p>`;
    }

    return body;
  }
}


@register('x-bio', {template})
export class Bio extends Gloss {
  body() {
    const data = bios[this.xid];
    if (!data) return console.warn('missing bio:', this.xid);

    // TODO Customise the timeline path, or decide whether it is visible.
    const image = `<img class="bio-img" alt="" src="/content/shared/bios/${this.xid}.jpg"/>`;
    const btn = data.born ? `<p><a href="/timeline/${this.xid}" class="btn btn-white btn-small" target="_blank">Timeline</a></p>` : '';
    return ((data.image === false) ? '' : image) + data.bio + btn;
  }
}
