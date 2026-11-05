import type { ReactNode } from 'react';
import type { Season } from '../lib/time';

/** Flat, layered season scenes (simple shapes, SimDesk pastels), drawn like the world scenes. */
const SCENES: Record<Season, ReactNode> = {
  0: (
    <>
      <rect width="400" height="150" fill="#EAF6EE" /><rect width="400" height="70" fill="#F3EEFA" />
      <circle cx="320" cy="40" r="22" fill="#FDF0C8" />
      <path d="M0 80 C80 62 160 70 240 76 S350 62 400 70 V150 H0Z" fill="#CDEBD2" />
      <path d="M0 104 C90 90 190 100 280 96 S370 88 400 92 V150 H0Z" fill="#B6E0BE" />
      <rect x="88" y="70" width="5" height="30" rx="2.5" fill="#B99A86" /><circle cx="90" cy="62" r="20" fill="#F6C9DA" /><circle cx="76" cy="70" r="12" fill="#F9D7E4" /><circle cx="104" cy="70" r="13" fill="#F3BDD1" />
      <rect x="268" y="78" width="4" height="22" rx="2" fill="#B99A86" /><circle cx="270" cy="72" r="15" fill="#F9D7E4" /><circle cx="259" cy="78" r="9" fill="#F3BDD1" />
      <circle cx="150" cy="40" r="3" fill="#F3BDD1" /><circle cx="182" cy="56" r="2.5" fill="#F6C9DA" /><circle cx="210" cy="34" r="2" fill="#F3BDD1" /><circle cx="236" cy="50" r="2.5" fill="#F9D7E4" />
      <circle cx="160" cy="112" r="3" fill="#FDF0C8" /><circle cx="172" cy="118" r="3" fill="#F6C9DA" /><circle cx="330" cy="108" r="3" fill="#FDF0C8" /><circle cx="342" cy="114" r="3" fill="#F6C9DA" />
    </>
  ),
  1: (
    <>
      <rect width="400" height="150" fill="#FFF3DC" /><rect width="400" height="60" fill="#E2F2FA" />
      <circle cx="300" cy="44" r="28" fill="#FFE29A" />
      <path d="M0 74 H400 V108 H0Z" fill="#A9DDE6" /><path d="M0 84 C60 80 120 88 180 84 S300 80 400 86" stroke="#C8EBF0" strokeWidth="3" fill="none" />
      <path d="M0 104 C100 96 200 102 300 98 S380 96 400 98 V150 H0Z" fill="#FBE3B8" />
      <rect x="96" y="58" width="5" height="48" rx="2.5" fill="#C9A27E" transform="rotate(-8 98 82)" />
      <path d="M94 58 c-16 -6 -26 0 -32 8 M94 58 c16 -6 26 0 32 8 M94 56 c-6 -14 -18 -16 -24 -12 M94 56 c6 -14 18 -16 24 -12" stroke="#8FCB9A" strokeWidth="6" strokeLinecap="round" fill="none" />
      <path d="M250 112 a26 26 0 0 1 52 0 Z" fill="#F7B9A6" /><rect x="275" y="110" width="3" height="18" fill="#C9A27E" />
    </>
  ),
  2: (
    <>
      <rect width="400" height="150" fill="#FDEEE2" /><rect width="400" height="64" fill="#F7EAF0" />
      <circle cx="90" cy="38" r="20" fill="#FCE3C0" />
      <path d="M0 82 C80 68 170 76 250 80 S360 70 400 74 V150 H0Z" fill="#F2D3B4" />
      <path d="M0 106 C90 96 190 104 280 100 S370 94 400 96 V150 H0Z" fill="#E9C09A" />
      <rect x="160" y="70" width="5" height="32" rx="2.5" fill="#B48A70" /><ellipse cx="162" cy="62" rx="22" ry="20" fill="#F4A97E" />
      <rect x="226" y="76" width="4" height="26" rx="2" fill="#B48A70" /><ellipse cx="228" cy="70" rx="16" ry="15" fill="#F7C27D" />
      <rect x="320" y="72" width="5" height="30" rx="2.5" fill="#B48A70" /><ellipse cx="322" cy="64" rx="20" ry="18" fill="#E98E6C" />
      <path d="M120 40 l4 3 -4 3 -4 -3z" fill="#F4A97E" /><path d="M270 30 l4 3 -4 3 -4 -3z" fill="#F7C27D" /><path d="M200 46 l3 3 -3 3 -3 -3z" fill="#E98E6C" />
      <circle cx="60" cy="118" r="5" fill="#F7C27D" /><circle cx="72" cy="120" r="4" fill="#F4A97E" />
    </>
  ),
  3: (
    <>
      <rect width="400" height="150" fill="#EEF2FB" /><rect width="400" height="70" fill="#E4E9F8" />
      <path d="M0 84 C80 66 170 74 250 80 S360 66 400 72 V150 H0Z" fill="#F7F9FE" />
      <path d="M0 108 C90 96 190 104 280 100 S370 94 400 96 V150 H0Z" fill="#FFFFFF" />
      <path d="M70 100 l18 -40 18 40z" fill="#B9D7CF" /><path d="M76 88 l12 -26 12 26z" fill="#CDE4DD" />
      <path d="M110 102 l14 -30 14 30z" fill="#A9CFC4" />
      <path d="M300 98 l16 -36 16 36z" fill="#B9D7CF" />
      <rect x="210" y="78" width="40" height="24" rx="3" fill="#F6DCD3" /><path d="M204 80 l26 -18 26 18z" fill="#FFFFFF" /><rect x="226" y="88" width="8" height="14" fill="#E8B9A9" />
      <circle cx="150" cy="30" r="2.5" fill="#FFFFFF" /><circle cx="190" cy="48" r="2" fill="#FFFFFF" /><circle cx="270" cy="26" r="2.5" fill="#FFFFFF" /><circle cx="340" cy="40" r="2" fill="#FFFFFF" /><circle cx="40" cy="44" r="2" fill="#FFFFFF" />
    </>
  ),
};

/** The season's banner: its scene with the soft melt, and whatever goes on top (title, arrows). */
export function SeasonBanner({ season, children, className = '' }: { season: Season; children?: ReactNode; className?: string }) {
  return (
    <div className={`season-banner ${className}`}>
      <svg viewBox="0 0 400 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{SCENES[season]}</svg>
      <div className="season-banner-in">{children}</div>
    </div>
  );
}
