import { ReactNode } from 'react';
import { Role } from './auth.types';

export interface NavItem {
  title: string;
  path: string;
  icon?: ReactNode;
  roles: Role[];
  badge?: string | number;
}

export interface NavGroup {
  groupTitle: string;
  items: NavItem[];
}
