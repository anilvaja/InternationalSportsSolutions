/**
 * Test Credentials & Domain Constants
 */
export const BASE_URL = process.env.BASE_URL || 'http://internationalsportssolutions.com';

export const CREDENTIALS = {
  superAdmin: {
    name: 'Super Admin',
    email: 'anilvaja.007@gmail.com',
    password: '123',
    loginUrl: '/admin/login',
    dashboardUrl: '/admin',
  },
  academyAdmin: {
    name: 'Mahavir Sports Academy Admin',
    email: 'john.smith@mahavirsportsacademy.com',
    password: 'password123',
    loginUrl: '/academy/login',
    dashboardUrl: '/academy',
  },
  academyStaff: {
    name: 'Mahavir Sports Academy Staff',
    email: 'sarah.johnson@mahavirsportsacademy.com',
    password: 'password123',
    loginUrl: '/academy/login',
    dashboardUrl: '/academy',
  },
  secondAcademyAdmin: {
    name: 'Sardar Martial Arts Admin',
    email: 'admin@sardar-martial-arts.com',
    password: 'password',
    loginUrl: '/academy/login',
    dashboardUrl: '/academy',
  },
  student: {
    name: 'Raj Trivedi',
    studentId: 'ISS260001',
    email: 'raj.trivedi795@gmail.com',
    password: 'password123',
    loginUrl: '/student/login',
    dashboardUrl: '/student',
  },
};

export const ROUTES = {
  public: '/',
  admin: {
    login: '/admin/login',
    dashboard: '/admin',
    academies: '/admin/academies',
    branches: '/admin/branches',
    batches: '/admin/batches',
    students: '/admin/students',
    users: '/admin/users',
    syllabusCategories: '/admin/syllabus-categories',
    syllabusTechniques: '/admin/syllabus-techniques',
  },
  academy: {
    login: '/academy/login',
    dashboard: '/academy',
    branches: '/academy/branches',
    batches: '/academy/batches',
    students: '/academy/students',
    attendances: '/academy/attendances',
    fees: '/academy/fees',
    eventFees: '/academy/event-fees',
    events: '/academy/events',
    roles: '/academy/academy-roles',
    permissions: '/academy/permissions',
    users: '/academy/users',
    audits: '/academy/audits',
  },
  student: {
    login: '/student/login',
    dashboard: '/student',
  },
};
