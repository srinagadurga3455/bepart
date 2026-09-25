import { Box } from '@mui/material';

import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import TicketRecovery from '../components/TicketRecovery';
import HowItWorks from '../components/HowItWorks';
import WhyBePart from '../components/WhyBePart';
import Footer from '../components/Footer';

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
