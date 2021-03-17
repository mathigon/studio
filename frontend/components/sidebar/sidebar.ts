// =============================================================================
// Course Sidebar Component
// (c) Mathigon
// =============================================================================


import {$, $N, CustomElementView, ElementView, FormView, InputView, post, register} from '@mathigon/boost';
import {Modal} from '../modal/modal';

// TODO Avoid all these $() lookups using global IDs.

@register('x-course-sidebar')
export class CourseSidebar extends CustomElementView {

  ready() {
    $('.sidebar-toggle')?.on('click', () => this.addClass('open'));
    $('.sidebar-shadow')?.on('pointerdown', () => this.removeClass('open'));

    const $feedbackForm = $('#feedback form') as FormView|undefined;
    const $feedbackButton = $('#feedback button');
    const $feedbackError = $('#feedback .error') as Modal|undefined;
    const $feedbackSuccess = $('#feedback-success') as Modal|undefined;
    const $feedbackField = $('#feedback textarea[name="message"]') as InputView|undefined;
    const courseId = $('x-course')!.id;

    $feedbackForm?.on('submit', e => {
      e.preventDefault();
      $feedbackButton!.setAttr('disabled', 'true');
      $feedbackError!.hide();

      post(`/course/${courseId}/feedback`, $feedbackForm.formData)
          .then(() => {
            $feedbackSuccess!.open();
            $feedbackField!.value = '';
          })
          .catch(() => $feedbackError!.show())
          .then(() => $feedbackButton!.removeAttr('disabled'));
    });

    const glossary = JSON.parse($('#glossary')!.text);

    const $glossaryModal = $('#glossary-search')!;
    const $glossBody = $glossaryModal.$('.gloss-body')!;
    const $glossList = $glossaryModal.$('.gloss-list')!;
    const $glossSearch = $glossaryModal.$('.gloss-search input') as InputView;
    let $active: ElementView;

    for (const g of Object.keys(glossary).sort()) {
      const data = glossary[g];

      const $item = $N('div', {class: 'gloss-item', html: data.title, tabindex: 0}, $glossList);
      $item.on('click', () => {
        if ($active) $active.removeClass('on');
        $active = $item;
        $item.addClass('on');
        $glossBody.html = data.text;
      });

      const search = data.title.toLowerCase();
      $glossSearch.change(v => $item.setClass('hidden', !!v && search.indexOf(v.toLowerCase()) < 0));
    }
  }
}
