import React from 'react';

const THEME_MAP = {
  oatmeal_classic: { gradient: 'from-[#d9f3e7] via-[#cbeee0] to-[#b5e4d0]', icon: 'breakfast_dining' },
  oatmeal_balanced: { gradient: 'from-[#cdeee0] via-[#b7e6d3] to-[#9ed9c1]', icon: 'spa' },
  oatmeal_gourmet: { gradient: 'from-[#bfe7d7] via-[#a7dcc7] to-[#8dceB4]', icon: 'eco' },
  eggs_classic: { gradient: 'from-[#e5f3e8] via-[#d2ead9] to-[#bce0c7]', icon: 'egg_alt' },
  eggs_balanced: { gradient: 'from-[#d7eee0] via-[#bfe4cf] to-[#a7d8bd]', icon: 'nutrition' },
  eggs_gourmet: { gradient: 'from-[#c7e7d8] via-[#afdbc7] to-[#96ceb4]', icon: 'restaurant' },
  bowl_classic: { gradient: 'from-[#ddf4ea] via-[#c9ecdc] to-[#b2e2cc]', icon: 'rice_bowl' },
  bowl_balanced: { gradient: 'from-[#ceefe1] via-[#b7e5d2] to-[#9ed8bf]', icon: 'eco' },
  bowl_gourmet: { gradient: 'from-[#bfead8] via-[#a6dec7] to-[#8cd1b4]', icon: 'local_florist' },
  chicken_classic: { gradient: 'from-[#dff3e8] via-[#cbead9] to-[#b5dfc8]', icon: 'dinner_dining' },
  chicken_balanced: { gradient: 'from-[#ceeee0] via-[#b4e4cf] to-[#98d8bd]', icon: 'lunch_dining' },
  chicken_gourmet: { gradient: 'from-[#bce7d5] via-[#a0dbc3] to-[#84ceb0]', icon: 'restaurant_menu' },
  pasta_classic: { gradient: 'from-[#e3f2e8] via-[#d0e9d9] to-[#b9dec6]', icon: 'ramen_dining' },
  pasta_balanced: { gradient: 'from-[#d2ede0] via-[#bae3cf] to-[#a0d6bc]', icon: 'eco' },
  pasta_gourmet: { gradient: 'from-[#c2e8d8] via-[#a9ddc7] to-[#8ecfb4]', icon: 'restaurant' },
  tacos_classic: { gradient: 'from-[#dcf3e9] via-[#c7ebdc] to-[#afe0cc]', icon: 'tapas' },
  tacos_balanced: { gradient: 'from-[#cbeddf] via-[#b4e3cf] to-[#9ad6bc]', icon: 'set_meal' },
  tacos_gourmet: { gradient: 'from-[#bae6d5] via-[#a0dac3] to-[#85ccb0]', icon: 'workspace_premium' },
  dinner_classic: { gradient: 'from-[#d9f1e8] via-[#c3e7da] to-[#abdcc9]', icon: 'skillet' },
  dinner_balanced: { gradient: 'from-[#cbece0] via-[#b2e1cf] to-[#97d4bd]', icon: 'dinner_dining' },
  dinner_gourmet: { gradient: 'from-[#bce5d6] via-[#a1d9c4] to-[#86cbb1]', icon: 'local_dining' },
  fish_classic: { gradient: 'from-[#d7f1ea] via-[#c0e7dc] to-[#a7dbcd]', icon: 'set_meal' },
  fish_balanced: { gradient: 'from-[#c7ebe2] via-[#aedfd2] to-[#93d2c1]', icon: 'water_drop' },
  fish_gourmet: { gradient: 'from-[#b8e5da] via-[#9ed8ca] to-[#83cab8]', icon: 'eco' },
  soup_classic: { gradient: 'from-[#e1f3e9] via-[#cdebd9] to-[#b7e0c8]', icon: 'soup_kitchen' },
  soup_balanced: { gradient: 'from-[#d1ede0] via-[#b9e2ce] to-[#9fd6bb]', icon: 'bowl_chopsticks' },
  soup_gourmet: { gradient: 'from-[#c1e8d8] via-[#a7dcc6] to-[#8ccfb3]', icon: 'restaurant_menu' },
};

export function DishVisual({ theme, prepMinutes, estimatedCostUsd, badges = [] }) {
  const style = THEME_MAP[theme] || THEME_MAP.chicken_balanced;

  return (
    <div
      className={`relative w-full h-28 rounded-2xl overflow-hidden bg-gradient-to-br ${style.gradient} border border-emerald-900/10 mb-3 flex items-center justify-center`}
    >
      {/* Subtle geometric rings */}
      <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/30 pointer-events-none" />
      <div className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-emerald-500/10 pointer-events-none" />

      <div className="w-12 h-12 rounded-2xl bg-white/85 shadow-sm flex items-center justify-center text-[#006c49]">
        <span className="material-symbols-outlined text-[26px]">{style.icon}</span>
      </div>

      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[#151D24]">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/85 backdrop-blur-sm text-[11px] font-bold shadow-sm whitespace-nowrap">
          <span className="material-symbols-outlined text-[13px] text-[#00B87C]">timer</span>
          {prepMinutes} min
        </span>
        <div className="flex items-center gap-1.5 min-w-0">
          {badges[1] && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/85 backdrop-blur-sm text-[11px] font-semibold text-[#3c4a42] shadow-sm truncate">
              {badges[1]}
            </span>
          )}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#181A20] text-white text-[11px] font-bold shadow-sm whitespace-nowrap tabular-nums">
            ${Number(estimatedCostUsd).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
