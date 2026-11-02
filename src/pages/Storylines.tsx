import { Path } from '@phosphor-icons/react';
import { Empty } from '../components/ui';

export default function StorylinesPage() {
  return (
    <div className="page">
      <h1 className="row" style={{ gap: 12 }}><span className="obj storylines lg"><Path size={24} weight="duotone" /></span> Storylines</h1>
      <Empty title="Storylines are on their way">
        Drama threads with timelines that link Sims, households and lots are coming in a future update. Your module switch is saved, so they’ll appear here the moment they launch.
      </Empty>
    </div>
  );
}
