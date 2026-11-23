export const PLANS = {
  free: {
    id: 'free',
    name: 'Weather Basic',
    price: 0,
    currency: 'NGN',
  },
  pro: {
    id: 'pro',
    name: 'Weather Pro',
    price: 2500,
    currency: 'NGN',
  },
  premium: {
    id: 'premium',
    name: 'Weather Intelligence',
    price: 5000,
    currency: 'NGN',
  },
};

export const PLAN_IDS = Object.keys(PLANS);

export function getPlan(id) {
  return PLANS[id] || PLANS.free;
}
