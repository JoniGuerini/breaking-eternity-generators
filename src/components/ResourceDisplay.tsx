import { useTranslation } from 'react-i18next';
import { useGameStore, getResourceRate } from '../game/store';
import { formatNum } from '../utils/format';

export function ResourceDisplay() {
  const { t, i18n } = useTranslation();
  // Subscreve a `tick` pra re-renderizar na cadência do game loop.
  useGameStore((s) => s.tick);
  const resource = useGameStore.getState().resource;
  const rate = getResourceRate();

  return (
    <div className="resource-block">
      <span className="resource-label">{t('resource.label')}</span>
      <span className="resource-value">{formatNum(resource, i18n.language)}</span>
      <span className="resource-rate">
        +{formatNum(rate, i18n.language)} {t('resource.rateSuffix')}
      </span>
    </div>
  );
}
