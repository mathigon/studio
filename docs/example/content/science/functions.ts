import {Step} from '@mathigon/studio/frontend/components/step/step';

export function nuclearStep($step: Step) {
  console.log('Custom code for this step!')
  setTimeout(() => $step.addHint('Hello there!'), 1000);
}
