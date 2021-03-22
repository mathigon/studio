// =============================================================================
// Icon Component
// (c) Mathigon
// =============================================================================


import {$N, CustomElementView, register} from '@mathigon/boost';


@register('x-icon')
export class IconView extends CustomElementView {

  ready() {
    const size = +this.attr('size') || 24;
    this.css({width: size + 'px', height: size + 'px'});

    const $svg = $N('svg', {viewBox: '0 0 24 24'}, this);
    $svg.css({width: size + 'px', height: size + 'px'});

    const $use = $N('use', {}, $svg);
    this.onAttr('name', (n) => $use.setAttr('href', `/icons.svg#${n}`));

    // TODO ARIA attributes / alt text
    // TODO Maybe polyfill if <use> is not supported
  }
}
