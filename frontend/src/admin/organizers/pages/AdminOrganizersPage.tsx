import AdminShell from '../../components/AdminShell';
import OrganizerTable from '../components/OrganizerTable';

export default function AdminOrganizersPage() {
  return (
    <AdminShell title="Organizers" subtitle="Manage organizer accounts from live data.">
      <OrganizerTable />
    </AdminShell>
  );
}
