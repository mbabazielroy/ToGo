import { useNavigate } from 'react-router-dom';
import { MapPin, ChevronRight, ShieldQuestion } from 'lucide-react';
import { useStore } from '../../state/store';
import { DemoNote, SectionHeading } from '../../components/ui';
import type { City } from '../../types';

export function Hubs() {
  const { state } = useStore();
  const navigate = useNavigate();
  const cities: City[] = ['Kampala', 'Mbarara'];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-forest-900">Pickup hubs</h1>
        <p className="mt-1 text-sm text-forest-500">
          Physical points where your bus meets you. Choose the one nearest you.
        </p>
      </div>

      <DemoNote>
        Hubs are illustrative demo locations — not officially approved sites or partnered businesses.
      </DemoNote>

      {cities.map((city) => {
        const hubs = state.hubs.filter((h) => h.city === city);
        return (
          <section key={city}>
            <SectionHeading title={city} />
            <div className="space-y-2.5">
              {hubs.map((h) => {
                const facilities = Object.entries(h.facilities)
                  .filter(([, v]) => v)
                  .map(([k]) => k);
                return (
                  <button
                    key={h.id}
                    onClick={() => navigate(`/hubs/${h.id}`)}
                    className="card flex w-full items-center gap-3 p-3.5 text-left transition active:scale-[0.99] hover:shadow-raised"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-100 text-forest-700">
                      <MapPin size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-forest-900">{h.name}</span>
                      <span className="block truncate text-xs text-forest-500">{h.area}</span>
                      <span className="mt-0.5 block text-[11px] text-forest-400">
                        {facilities.length} facilities · {h.openingHours}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-forest-300" />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="flex items-start gap-2 rounded-xl bg-sand-50 px-3 py-2.5 text-xs text-forest-500 ring-1 ring-forest-100">
        <ShieldQuestion size={14} className="mt-0.5 shrink-0" />
        <span>
          ToGo does not guarantee pickup or imply any partnership with the locations shown. This is a
          prototype for demonstration only.
        </span>
      </div>
    </div>
  );
}
