import { useTranslation } from 'react-i18next';

export function MonthPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (month: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor="month">{t('common.month')}</label>
      <input
        id="month"
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
