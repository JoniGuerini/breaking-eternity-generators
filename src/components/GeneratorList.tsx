import { useGameStore } from '../game/store';
import { GeneratorCard } from './GeneratorCard';

export function GeneratorList() {
  // Subscreve `tick` — o array `generators` é mutado in-place, então
  // dependemos do tick pra disparar re-render quando geradores são
  // desbloqueados ou novos slots aparecem na lista.
  useGameStore((s) => s.tick);
  const generators = useGameStore.getState().generators;

  return (
    <div className="generators">
      {generators.map((gen) => (
        <GeneratorCard key={gen.id} generatorId={gen.id} />
      ))}
    </div>
  );
}
