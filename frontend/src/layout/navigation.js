// The menu of each role. Pages marked "soon" are built in the next steps.

export const NAVIGATION = {
  HOLDING: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/companies', label: 'Companies' },
    { to: '/managers', label: 'Managers' },
    { to: '/employees', label: 'Employees' },
    { to: '/evaluations', label: 'Evaluations' },
    { to: '/plan-years', label: 'Plan years' },
    { to: '/plans', label: 'Plans' },
    { to: '/evaluation-setup', label: 'Periods & criteria' },
    { to: '/reports', label: 'Reports' },
    { to: '/holding-users', label: 'Holding users' },
    { to: '/audit-log', label: 'Audit log' },
    { to: '/settings', label: 'Settings' },
  ],
  MANAGER: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/employees', label: 'My team' },
    { to: '/plans', label: 'Plans' },
    { to: '/goals', label: 'Goals' },
    { to: '/self-assessments', label: 'Self-assessments' },
    { to: '/evaluations', label: 'Evaluations' },
    { to: '/reports', label: 'Reports' },
    { to: '/my-evaluations', label: 'My evaluation' },
  ],
  EMPLOYEE: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/profile', label: 'My profile' },
    { to: '/my-plan', label: 'My plan' },
    { to: '/goals', label: 'My goals' },
    { to: '/self-assessments', label: 'Self-assessment' },
    { to: '/my-evaluations', label: 'My evaluations' },
  ],
};

export const ROLE_LABELS = { HOLDING: 'Holding', MANAGER: 'Manager', EMPLOYEE: 'Employee' };
