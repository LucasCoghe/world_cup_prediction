'use client';

export default function Rules() {
  return (
    <div className="space-y-6 animate-in">
      <h2 className="text-2xl font-bold trophy-text">Spelregels</h2>

      <div className="card space-y-4">
        <h3 className="text-xl font-semibold text-gold">Hoe werkt het?</h3>

        <div className="space-y-3 text-base text-gray-300">
          <p>
            <strong className="text-white">Stap 1:</strong> Vul de uitslagen van ALLE groepswedstrijden in.
          </p>
          <p>
            <strong className="text-white">Stap 2:</strong> De eindstanden worden automatisch berekend op basis van je voorspellingen.
          </p>
          <p>
            <strong className="text-white">Stap 3:</strong> In de knockout verschijnen de wedstrijden zodra de teams bekend zijn.
            Voorspel elke wedstrijd voor de aftrap.
          </p>
          <p>
            <strong className="text-white">Stap 4:</strong> Vul de extra vragen in (topschutter, etc.).
          </p>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-xl font-semibold text-gold">Punten</h3>

        <div className="space-y-2 text-base">
          <h4 className="font-semibold text-white mt-3">Groepsfase</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Exacte score (Bullseye!)</span>
              <span className="font-bold text-gold">10 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juist doelsaldo, verkeerde uitslag</span>
              <span className="font-bold text-gold">7 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste winnaar, verkeerd doelsaldo</span>
              <span className="font-bold text-gold">5 punten</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Knockout (vanaf 1/8e finales)</h4>
          <p className="text-sm text-gray-400 mb-2">
            Punten zijn cumulatief: je kan meerdere bonussen combineren.
          </p>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste winnaar (ook na penalty&apos;s)</span>
              <span className="font-bold text-gold">10 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Exacte score (na 90 of 120 min)</span>
              <span className="font-bold text-gold">+6 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juist doelsaldo (niet exact)</span>
              <span className="font-bold text-gold">+4 punten</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Jokers</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Groepsfase</span>
              <span className="font-bold text-purple-400">3 jokers</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Knockout</span>
              <span className="font-bold text-purple-400">2 jokers</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Correct met joker (juiste winnaar of beter)</span>
              <span className="font-bold text-purple-400">+5 bonuspunten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Fout met joker</span>
              <span className="font-bold text-red-400">-2 punten</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Extra Punten</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste Wereldkampioen</span>
              <span className="font-bold text-gold">25 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste Topschutter</span>
              <span className="font-bold text-gold">15 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste Belgische Topschutter</span>
              <span className="font-bold text-gold">10 punten</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Schiftingsvragen</h4>
          <p className="text-gray-300">
            Bij gelijke stand bepalen de schiftingsvragen de ranking:
          </p>
          <ol className="list-decimal ml-5 text-gray-300 space-y-1">
            <li>Aantal gescoorde doelpunten van de topschutter</li>
            <li>Minuut eerste doelpunt van de topschutter</li>
          </ol>
        </div>
      </div>

      <div className="card space-y-4">
        <h3 className="text-xl font-semibold text-amber-500">Bierteller</h3>
        <p className="text-sm text-gray-400">Slecht voorspellen heeft gevolgen.</p>

        <div className="grid gap-1 text-base">
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-gray-300">Onderste 3 op een speeldag (groepsfase)</span>
            <span className="font-bold text-amber-500">1 pint</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-gray-300">Onderste 3 in een knockoutronde</span>
            <span className="font-bold text-amber-500">1 pint</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-gray-300">2 wedstrijden op rij 0 punten</span>
            <span className="font-bold text-amber-500">1 pint</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-white/5">
            <span className="text-gray-300">Beste van de speeldag (alleen winnaar)</span>
            <span className="font-bold text-emerald-400">1 pint uitdelen</span>
          </div>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-xl font-semibold text-gold">Inleg &amp; Prijzen</h3>
        <p className="text-base text-gray-300">
          <strong className="text-white">10 euro</strong> inleg per deelnemer.
        </p>
        <p className="text-base text-gray-300">
          Verdeling van de prijzenpot hangt af van het aantal deelnemers.
          De top 3 of top 5 valt in de prijzen!!
        </p>
      </div>
    </div>
  );
}
