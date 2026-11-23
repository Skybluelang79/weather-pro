import type { PlanId } from '../types';

interface UpgradeCardProps {
  title: string;
  description: string;
  requiredPlan?: PlanId;
  onUpgrade: () => void;
}

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
};

export default function UpgradeCard({ title, description, requiredPlan = 'pro', onUpgrade }: UpgradeCardProps) {
  return (
    <div className="upgrade-card animate-slide-up">
      <div className="upgrade-icon">🔒</div>
      <div className="upgrade-copy">
        <div className="upgrade-badge">{PLAN_LABELS[requiredPlan]} FEATURE</div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <button className="upgrade-btn" onClick={onUpgrade}>
        View plans
      </button>
    </div>
  );
}
