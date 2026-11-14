import { usePageBehavior } from './behavior';
import homeHtml from './home.html?raw';
import betaHtml from './beta.html?raw';
import pricingHtml from './pricing.html?raw';

// The public pages are plain, reviewed HTML (home.html, beta.html) styled by src/styles/landing.css.
// Keep them free of any person's name: SimDesk is meant to run without its maker.

export function LandingPage() {
  const ref = usePageBehavior();
  return <div className="lp" ref={ref} dangerouslySetInnerHTML={{ __html: homeHtml }} />;
}

export function BetaApplyPage() {
  const ref = usePageBehavior();
  return <div className="lpb" ref={ref} dangerouslySetInnerHTML={{ __html: betaHtml }} />;
}

export function PricingPage() {
  const ref = usePageBehavior();
  return <div className="lpp" ref={ref} dangerouslySetInnerHTML={{ __html: pricingHtml }} />;
}
