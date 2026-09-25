import { Card, CardContent } from '@mui/material';
import DashboardShell from '../../../app/components/DashboardShell';
import OrganizerTable from '../components/OrganizerTable';
import { adminNav } from '../../routes';

export default function AdminOrganizersPage() {
  return (
    <DashboardShell title="Organizers" navItems={adminNav}>
      <Card variant="outlined" sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: { xs: 2, md: 3 } }}>
          <OrganizerTable />
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
