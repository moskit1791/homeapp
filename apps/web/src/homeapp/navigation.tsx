import type { ModuleKey } from '@homeapp/shared-types';
import type { EffectivePermission } from './api';
import type { NavSectionProps } from 'src/components/nav-section';

import { Icon } from '@iconify/react';

type HomeAppNavItem = {
  icon: string;
  moduleKeys?: ModuleKey[];
  path: string;
  title: string;
};

const items: HomeAppNavItem[] = [
  { title: 'Dzisiaj', path: '/', icon: 'solar:home-smile-bold-duotone' },
  {
    title: 'Kalendarz',
    path: '/kalendarz',
    icon: 'solar:calendar-bold-duotone',
    moduleKeys: ['calendar'],
  },
  { title: 'Zakupy', path: '/zakupy', icon: 'solar:cart-3-bold-duotone', moduleKeys: ['shopping'] },
  {
    title: 'Spiżarnia',
    path: '/spizarnia',
    icon: 'solar:box-bold-duotone',
    moduleKeys: ['shopping'],
  },
  {
    title: 'Plan posiłków',
    path: '/posilki',
    icon: 'solar:chef-hat-bold-duotone',
    moduleKeys: ['meal_planner'],
  },
  {
    title: 'Zadania i notatki',
    path: '/zadania',
    icon: 'solar:checklist-bold-duotone',
    moduleKeys: ['todo', 'notes'],
  },
  {
    title: 'Finanse',
    path: '/finanse',
    icon: 'solar:wallet-money-bold-duotone',
    moduleKeys: ['finances'],
  },
  {
    title: 'Dom',
    path: '/dom',
    icon: 'solar:sofa-2-bold-duotone',
    moduleKeys: ['cleaning', 'annual_costs', 'data_entries', 'attachments'],
  },
  {
    title: 'Domownicy',
    path: '/domownicy',
    icon: 'solar:users-group-rounded-bold-duotone',
    moduleKeys: ['household_members', 'permissions'],
  },
];

export function buildHomeAppNavData(permissions: EffectivePermission[]): NavSectionProps['data'] {
  const readable = new Set(
    permissions.filter((permission) => permission.canRead).map((permission) => permission.moduleKey)
  );

  return [
    {
      subheader: 'HomeApp',
      items: items
        .filter((item) => !item.moduleKeys || item.moduleKeys.some((key) => readable.has(key)))
        .map((item) => ({
          title: item.title,
          path: item.path,
          icon: <Icon width={24} icon={item.icon} />,
        })),
    },
  ];
}
