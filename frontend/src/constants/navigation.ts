import { NavGroup } from '../types/navigation.types';

export const NAVIGATION_GROUPS: NavGroup[] = [
  {
    groupTitle: 'Overview',
    items: [
      {
        title: 'Dashboard',
        path: '/dashboard',
        roles: ['ADMIN', 'OUTLET', 'PRODUCTION'],
      },
    ],
  },
  {
    groupTitle: 'Business',
    items: [
      {
        title: 'Billing POS',
        path: '/billing',
        roles: ['ADMIN', 'OUTLET'],
      },
      {
        title: 'Bill History',
        path: '/billing/history',
        roles: ['ADMIN', 'OUTLET'],
      },
      {
        title: 'Sales Returns',
        path: '/sales-returns',
        roles: ['ADMIN', 'OUTLET'],
      },
      {
        title: 'Customers',
        path: '/customers',
        roles: ['ADMIN', 'OUTLET'],
      },
    ],
  },
  {
    groupTitle: 'Inventory & Kitchen',
    items: [
      {
        title: 'Stock Inventory',
        path: '/inventory',
        roles: ['ADMIN', 'OUTLET', 'PRODUCTION'],
      },
      {
        title: 'Stock Movements',
        path: '/inventory/movements',
        roles: ['ADMIN', 'OUTLET', 'PRODUCTION'],
      },
      {
        title: 'Production',
        path: '/production',
        roles: ['ADMIN', 'PRODUCTION'],
      },
    ],
  },
  {
    groupTitle: 'Catalog Masters',
    items: [
      {
        title: 'Products',
        path: '/products',
        roles: ['ADMIN'],
      },
      {
        title: 'Categories',
        path: '/categories',
        roles: ['ADMIN'],
      },
      {
        title: 'Subcategories',
        path: '/subcategories',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    groupTitle: 'Analytics',
    items: [
      {
        title: 'Reports',
        path: '/reports',
        roles: ['ADMIN'],
      },
    ],
  },
  {
    groupTitle: 'Administration',
    items: [
      {
        title: 'User Management',
        path: '/users',
        roles: ['ADMIN'],
      },
      {
        title: 'Website CMS',
        path: '/website',
        roles: ['ADMIN'],
      },
      {
        title: 'Settings',
        path: '/settings',
        roles: ['ADMIN'],
      },
    ],
  },
];
