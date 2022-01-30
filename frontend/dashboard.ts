// =============================================================================
// Dashboard Scripts
// (c) Mathigon
// =============================================================================


import {cache} from '@mathigon/core';
import {$, $$, Browser, observe} from '@mathigon/boost';
import './main';


const checkClassCode = cache((c: string) => fetch(`/validate?classcode=${c}`)
    .then(r => r.text()).then(t => (t === 'invalid') || undefined));

interface Course {
  id: string;
  title: string;
  color: string;
  icon: string;
  progress: number;
  sections: {id: string, title: string, locked: boolean, progress: number}[];
}

interface Student {
  id: string;
  name: string;
  avatar: string;
  minutes: number;
  recent: string[];
  progress: Record<string, number>;
}

// -----------------------------------------------------------------------------

Browser.ready(() => {
  for (const $a of $$('.alert')) $a.$('.close')!.on('click', () => $a.remove());

  const $addCode = $('#add-class-code form');
  if ($addCode) {
    const model = observe({classCode: '', invalid: false as boolean|undefined});
    model.watch(async ({classCode}) => {
      let c = classCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      if (c.length > 4) c = c.slice(0, 4) + '-' + c.slice(4, 8);
      model.classCode = c;
      model.invalid = !!c;
      if (c.length === 9) model.invalid = await checkClassCode(c);
    });
    $addCode.bindModel(model);
  }

  // ---------------------------------------------------------------------------

  const $roster = $('#roster');
  if ($roster) {
    const _students = JSON.parse($('#student-data')!.text) as Student[];
    const _courses = JSON.parse($('#course-data')!.text) as Course[];
  }
});
