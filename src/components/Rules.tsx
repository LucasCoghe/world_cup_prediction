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
          <h4 className="font-semibold text-white mt-3">Elke wedstrijd (groepsfase + knockout)</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste uitkomst (winst/gelijk/verlies)</span>
              <span className="font-bold text-gold">1 punt</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste uitslag (exact)</span>
              <span className="font-bold text-gold">+2 punten</span>
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
              <span className="text-gray-300">Correct met joker</span>
              <span className="font-bold text-purple-400">+2 bonuspunten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Fout met joker</span>
              <span className="font-bold text-red-400">-1 punt</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Knockout</h4>
          <p className="text-sm text-gray-400 mb-2">
            In de knockout voorspel je per wedstrijd zodra de teams bekend zijn. Deadline is de aftrap van elke wedstrijd.
            Scoring is dezelfde als in de groepsfase: 1 punt voor juiste uitkomst, +2 voor exacte uitslag.
          </p>

          <h4 className="font-semibold text-white mt-5">Extra Punten</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste Wereldkampioen</span>
              <span className="font-bold text-gold">5 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste Topschutter</span>
              <span className="font-bold text-gold">5 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste Belgische Topschutter</span>
              <span className="font-bold text-gold">3 punten</span>
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
