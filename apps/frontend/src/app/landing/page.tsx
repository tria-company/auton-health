import Header from '@/components/landing-lp/layout/Header';
import HeroSection from '@/components/landing-lp/hero/HeroSection';
import ProblemSection from '@/components/landing-lp/problem-section/ProblemSection';
import SolutionSection from '@/components/landing-lp/solution-section/SolutionSection';
import ApplicationSection from '@/components/landing-lp/application-section/ApplicationSection';
import FeaturesSection from '@/components/landing-lp/features-section/FeaturesSection';
import AgentsSection from '@/components/landing-lp/agents-section/AgentsSection';
import ADSMethodSection from '@/components/landing-lp/ads-method-section/ADSMethodSection';
import TestimonialsSection from '@/components/landing-lp/testimonials-section/TestimonialsSection';
import PricingSection from '@/components/landing-lp/pricing-section/PricingSection';
import FAQSection from '@/components/landing-lp/faq-section/FAQSection';
import CTASection from '@/components/landing-lp/cta-section/CTASection';
import Footer from '@/components/landing-lp/footer/Footer';

export default function LandingPage() {
  return (
    <div className="landing-lp-root min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <ApplicationSection />
        <FeaturesSection />
        <AgentsSection />
        <ADSMethodSection />
        <TestimonialsSection />
        <PricingSection />
        <FAQSection />
        <CTASection />
        <Footer />
      </main>
    </div>
  );
}
