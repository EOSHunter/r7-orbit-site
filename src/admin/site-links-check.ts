// The Note box of Site settings > Footer: Decap's string control, plus the check of the nav and footer links that no field's own
// pattern can make, because it spans several fields (a duplicate address, a footer link with neither address nor profile;
// siteLinksError in src/admin/settings.ts, the build's own rules). Decap calls a control's `isValid` when Save is pressed, before
// it writes anything, and shows the message under the box. It sits on the Note because Decap does not call `isValid` on a list
// of objects (its ListControl checks only the fields inside each item), and the Note is the plain box nearest the links.
import { Component, createElement as h, type ComponentType } from 'react';
import files from 'virtual:site-files';
import { siteLinksError } from './settings';

interface Props {
  value?: unknown;
  /** The entry being edited (Immutable). Decap passes it to every control. */
  entry?: { getIn(path: string[]): { toJS?: () => unknown } | undefined };
}

export function withSiteLinksCheck<P extends Props>(Control: ComponentType<P>): ComponentType<P> {
  // A class, not a function: Decap reads `isValid` from the instance its ref gets.
  class SiteLinksControl extends Component<P> {
    static displayName = `SiteLinksCheck(${Control.displayName ?? Control.name ?? 'StringControl'})`;

    isValid() {
      const error = siteLinksError(this.props.entry?.getIn(['data'])?.toJS?.(), files);
      return error ? { error } : true;
    }

    render() {
      return h(Control, this.props);
    }
  }
  return SiteLinksControl;
}
