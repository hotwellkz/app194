export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'employee' | 'user';
  createdAt: any;
}