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
            <strong className="text-white">Stap 3:</strong> De knockout-bracket wordt automatisch ingevuld. Voorspel de uitslagen van de knockout-wedstrijden 
            voor de aanvang van de eerste wedstrijd.
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
          <p className="text-sm text-gray-400 italic">
            In de knockout gelden score-punten (uitkomst/exact) enkel als je de samenstelling (beide teams) correct hebt in dezelfde match.
          </p>

          <h4 className="font-semibold text-white mt-5">Knockout - Extra punten per ronde</h4>
          <p className="text-sm text-gray-400 mb-2">
            Team- en samenstellingspunten worden per <strong className="text-white">ronde</strong> bekeken, niet per match.
            Als je een team juist hebt in de ronde maar op een andere plek in de bracket, krijg je toch punten.
            Hetzelfde geldt voor de samenstelling: als twee teams die jij voorspelde tegen elkaar spelen ergens in dezelfde ronde, krijg je de bonus.
          </p>

          <h4 className="font-semibold text-white mt-3">Ronde van 32 &amp; Achtste Finales</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Per correct voorspeld team in de ronde</span>
              <span className="font-bold text-gold">2 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste samenstelling (beide teams spelen tegen elkaar)</span>
              <span className="font-bold text-gold">+2 punten</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Kwartfinales</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Per correct voorspeld team in de ronde</span>
              <span className="font-bold text-gold">3 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste samenstelling</span>
              <span className="font-bold text-gold">+3 punten</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Halve Finales &amp; Troostfinale</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Per correct voorspeld team in de ronde</span>
              <span className="font-bold text-gold">4 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste samenstelling</span>
              <span className="font-bold text-gold">+4 punten</span>
            </div>
          </div>

          <h4 className="font-semibold text-white mt-5">Finale</h4>
          <div className="grid gap-1">
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Per correct voorspeld team in de ronde</span>
              <span className="font-bold text-gold">5 punten</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-white/5">
              <span className="text-gray-300">Juiste samenstelling finale</span>
              <span className="font-bold text-gold">+5 punten</span>
            </div>
          </div>

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
          <strong className="text-white">20 euro</strong> inleg per deelnemer.
        </p>
        <p className="text-base text-gray-300">
          Verdeling van de prijzenpot hangt af van het aantal deelnemers.
          De top 3 of top 5 valt in de prijzen!
        </p>
      </div>
    </div>
  );
}
