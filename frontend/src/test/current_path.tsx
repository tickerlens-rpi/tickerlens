import {useLocation} from 'react-router';

/** Shows the router's current path so tests can check where a click led. */
export function CurrentPath() {
  const {pathname} = useLocation();
  return <div data-testid="current-path">{pathname}</div>;
}
