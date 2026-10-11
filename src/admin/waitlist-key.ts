// The Turnstile site key box of Site settings > Waitlist: Decap's string control, plus one check a pattern cannot make because it
// depends on another field: with "Enabled" ticked the key must be filled in (waitlistKeyError in src/admin/settings.ts). Decap
// calls a control's `isValid` when Save is pressed, before it writes anything, and shows the message under the box.
import { Component, createElement as h, type ComponentType } from 'react';
import { waitlistKeyError } from './settings';

interface Props {
  value?: unknown;
  /** The entry being edited (Immutable). Decap passes it to every control. */
  entry?: { getIn(path: string[]): unknown };
}

export function withWaitlistKeyCheck<P extends Props>(Control: ComponentType<P>): ComponentType<P> {
  // A class, not a function: Decap reads `isValid` from the instance its ref gets.
  class WaitlistKeyControl extends Component<P> {
    static displayName = `WaitlistKey(${Control.displayName ?? Control.name ?? 'StringControl'})`;

    isValid() {
      const error = waitlistKeyError(this.props.entry?.getIn(['data', 'waitlist', 'enabled']), this.props.value);
      return error ? { error } : true;
    }

    render() {
      return h(Control, this.props);
    }
  }
  return WaitlistKeyControl;
}
