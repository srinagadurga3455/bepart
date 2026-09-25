import { Box } from '@mui/material';

import Navbar from '../components/Navbar.jsx';
import HeroSection from '../components/HeroSection.jsx';
import TicketRecovery from '../components/TicketRecovery.jsx';
import HowItWorks from '../components/HowItWorks.jsx';
import WhyBePart from '../components/WhyBePart.jsx';
import Footer from '../components/Footer.jsx';

function LandingPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <HeroSection />
        <TicketRecovery />
        <HowItWorks />
        <WhyBePart />
      </Box>
      <Footer />
    </Box>
  );
}

export default LandingPage;