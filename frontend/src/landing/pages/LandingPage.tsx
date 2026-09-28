import { Box } from '@mui/material';

import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import WhatIsBePart from '../components/WhatIsBePart';
import ProblemSection from '../components/ProblemSection';
import HowItWorks from '../components/HowItWorks';
import ParticipantSection from '../components/ParticipantSection';
import PaidFlowSection from '../components/PaidFlowSection';
import TicketShowcase from '../components/TicketShowcase';
import DiscoverySection from '../components/DiscoverySection';
import FormExamples from '../components/FormExamples';
import FreeVsPaid from '../components/FreeVsPaid';
import WhyBePart from '../components/WhyBePart';
import OrganizerSection from '../components/OrganizerSection';
import TicketRecovery from '../components/TicketRecovery';
import FaqSection from '../components/FaqSection';
import Footer from '../components/Footer';
import { usePageMeta } from '../../app/utils/pageMeta';

function LandingPage() {
  usePageMeta(
    'Home',
    'BePart is the campus event discovery and registration platform — browse events, register in minutes, get QR tickets, and check in at the gate.',
  );
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navbar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        <HeroSection />
        <WhatIsBePart />
        <ProblemSection />
        <HowItWorks />
        <ParticipantSection />
        <PaidFlowSection />
        <TicketShowcase />
        <DiscoverySection />
        <FormExamples />
        <FreeVsPaid />
        <WhyBePart />
        <OrganizerSection />
        <TicketRecovery />
        <FaqSection />
      </Box>
      <Footer />
    </Box>
  );
}

export default LandingPage;
