// =============================================================================
// Alert Component
// (c) Mathigon
// =============================================================================


import {$body, $N, CustomElementView, register} from '@mathigon/boost';

const $alerts = new Map<string, Alert>();
let $openAlert: Alert|undefined;
const $alertParent = $N('div', {class: 'snackbar'}, $body);


@register('x-alert')
export class Alert extends CustomElementView {

  ready() {
    $alertParent.append(this);
    $alerts.set(this.attr('key'), this);
    this.$('button')?.on('click', () => this.close());
  }

  async open(duration = 2000) {
    if ($openAlert === this) return;
    if ($openAlert) await $openAlert.close();
    $openAlert = this;
    await this.enter('pop', 300).promise;
    this.setAttr('role', 'alert');
    if (duration) setTimeout(() => this.close(), duration);
  }

  async close() {
    if ($openAlert !== this) return;
    $openAlert = undefined;
    this.removeAttr('role');
    await this.exit('pop', 300).promise;
  }
}

export function showAlert(key: string, duration = 4000) {
  return $alerts.get(key)?.open(duration);
}
