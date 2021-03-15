// =============================================================================
// Share Buttons Component
// (c) Mathigon
// =============================================================================


import {CustomElementView, observe, register} from '@mathigon/boost';
import {showAlert} from '../alert/alert';
import template from './share.pug';


@register('x-share', {template})
export class ShareRow extends CustomElementView {

  ready() {
    this.bindModel(observe({
      title: '', url: '', img: '', body: '',
      fbAppId: this.attr('facebook'),
      twitterHandle: this.attr('twitter'),
      canCopy: !!window.navigator.clipboard,
      copy: () => this.copyUrl()
    }));

    for (const attr of ['title', 'url', 'img', 'body']) {
      this.onAttr(attr, value => this.model[attr] = encodeURIComponent(value));
    }

    for (const $s of this.$$('a.btn')) {
      $s.on('click', e => {
        window?.ga('send', 'event', 'Share', $s.attr('title'));
        e.preventDefault();
        const top = window.screen.height / 2 - 320;
        const left = window.screen.width / 2 - 360;
        const options = `menubar=no,toolbar=no,width=720,height=640,top=${top},left=${left}`;
        window.open($s.attr('href'), '', options);
      });
    }
  }

  private async copyUrl() {
    const url = this.attr('url');
    await window.navigator.clipboard.writeText(url);

    if ((navigator as any).canShare) {
      navigator.share({title: `Polypad – ${this.attr('title')}`, url});  // async
    }

    showAlert('clipboard');
  }
}
