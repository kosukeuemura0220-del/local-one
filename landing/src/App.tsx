import Hero from "./components/Hero";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import Download from "./components/Download";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Hero />
      <Features />
      <HowItWorks />
      <Download />
      <Footer />
    </div>
  );
}
