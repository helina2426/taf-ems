// The "Check-ins" menu page: employees see their own notes, Managers and Holding users see the team.
import { useAuth } from '../../auth/useAuth.js';
import { MyCheckInsPage } from './MyCheckInsPage.jsx';
import { TeamCheckInsPage } from './TeamCheckInsPage.jsx';

export function CheckInsPage() {
  const { user } = useAuth();
  return user.role === 'EMPLOYEE' ? <MyCheckInsPage /> : <TeamCheckInsPage />;
}
