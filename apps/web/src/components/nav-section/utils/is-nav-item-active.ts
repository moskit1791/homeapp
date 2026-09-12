import type { NavItemDataProps } from '../types';

import { isActiveLink } from 'minimal-shared/utils';

export function isNavItemActive(pathname: string, item: NavItemDataProps): boolean {
  if (isActiveLink(pathname, item.path, item.deepMatch ?? !!item.children)) return true;

  return item.children?.some((child) => isNavItemActive(pathname, child)) ?? false;
}
