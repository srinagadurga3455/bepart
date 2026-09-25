import { Card, CardContent, CardActions, Typography, Chip, Button } from '@mui/material';
import { Link } from 'react-router-dom';

export default function EventCard({ event }) {
  const statusColors = {
    DRAFT: 'default',
    PREVIEW: 'warning',
    PUBLISHED: 'success',
    CANCELLED: 'error',
    COMPLETED: 'info',
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" gutterBottom>{event.eventName}</Typography>
          <Chip
            label={event.status}
            size="small"
            color={statusColors[event.status] || 'default'}
            variant="outlined"
          />
        </Box>
        <Typography color="text.secondary" paragraph>{event.description}</Typography>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Date</Typography>
            <Typography variant="body2">{new Date(event.date).toLocaleDateString()}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">Slots</Typography>
            <Typography variant="body2">{event.slots}</Typography>
          </Box>
        </Box>
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between' }}>
        <Button variant="outlined" size="small" component={Link} to={`/events/${event.id}`}>
          View
        </Button>
        <Button variant="contained" size="small" component={Link} to={`/organizer/events/${event.id}/edit`}>
          Edit
        </Button>
      </CardActions>
    </Card>
  );
}