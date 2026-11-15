// Kluczowe momenty meczu w trybie zawodnika: sytuacja, opcje, atrybuty decydujące o powodzeniu i skutki.
// w: wagi atrybutów zawodnika, bias: łatwość (dodatni = łatwiej), ok/fail: skutki, value: atrakcyjność dla autopilota.
export const SCEN = {
  // ---------------- atak ----------------
  edge: {
    title: 'Piłka 20 metrów przed bramką', short: 'akcja przed polem karnym', ic: '⚽',
    text: 'Dostajesz piłkę 20 metrów przed bramką rywala. Przed Tobą jeden obrońca, z boku wbiega partner.',
    opts: [
      { t: 'Strzał z dystansu', w: { ls: 0.6, te: 0.2, cm: 0.2 }, bias: -0.9, ok: { goal: 1 }, okText: 'Piłka wpada w samo okienko!', failText: 'Strzał minimalnie obok słupka.', value: 1.6 },
      { t: 'Drybling w pole karne', w: { dr: 0.5, agi: 0.2, acc: 0.15, bal: 0.15 }, bias: 0, ok: { chain: 'oneOnOne' }, fail: { concede: 0.06 }, okText: 'Mijasz obrońcę i wpadasz w pole karne!', failText: 'Obrońca odbiera Ci piłkę.', value: 1.3 },
      { t: 'Prostopadłe podanie', w: { vis: 0.45, ps: 0.45, te: 0.1 }, bias: -0.2, ok: { assist: 0.42 }, okText: 'Świetne podanie za linię obrony!', failText: 'Podanie przecięte.', value: 1.1 },
      { t: 'Bezpieczne podanie', w: { ps: 0.7, dec: 0.3 }, bias: 1.3, ok: {}, rateOk: 0.06, okText: 'Utrzymujecie się przy piłce.', failText: 'Niecelne podanie, kontra rywali.', fail: { concede: 0.1 }, value: 0.35 },
    ],
  },
  oneOnOne: {
    title: 'Sam na sam!', short: 'sam na sam', ic: '🔥',
    text: 'Wychodzisz sam na sam z bramkarzem! Obrońcy zostali w tyle.',
    opts: [
      { t: 'Płaski strzał w róg', w: { sh: 0.6, cm: 0.3, te: 0.1 }, bias: 0.5, ok: { goal: 1 }, okText: 'Pewnie, w długi róg!', failText: 'Bramkarz broni nogą!', value: 1.8 },
      { t: 'Lob nad bramkarzem', w: { te: 0.45, fla: 0.3, cm: 0.25 }, bias: 0, ok: { goal: 1 }, okText: 'Przepiękny lob!', failText: 'Piłka ląduje na siatce, ale z góry.', value: 1.7 },
      { t: 'Minięcie bramkarza', w: { dr: 0.45, agi: 0.3, cm: 0.25 }, bias: 0.15, ok: { goal: 1 }, okText: 'Mijasz bramkarza i wjeżdżasz z piłką do bramki!', failText: 'Bramkarz łapie Ci piłkę spod nóg.', value: 1.75 },
    ],
  },
  box: {
    title: 'Tyłem do bramki w polu karnym', short: 'gra w polu karnym', ic: '🥅',
    text: 'Dostajesz piłkę w polu karnym, ale stoisz tyłem do bramki, a obrońca naciska na plecy.',
    opts: [
      { t: 'Obrót i strzał', w: { sh: 0.45, ft: 0.2, agi: 0.15, cm: 0.2 }, bias: -0.4, ok: { goal: 1 }, okText: 'Błyskawiczny obrót i strzał!', failText: 'Strzał zablokowany.', value: 1.5 },
      { t: 'Odegranie do partnera', w: { ps: 0.5, ft: 0.25, vis: 0.25 }, bias: 0.8, ok: { assist: 0.32 }, okText: 'Klepka do wbiegającego partnera!', failText: 'Odegranie za mocne.', value: 0.9 },
      { t: 'Zastawienie i walka o faul', w: { st: 0.5, bal: 0.3, cm: 0.2 }, bias: 0.1, ok: { chain: 'pen' }, okText: 'Obrońca fauluje, rzut karny!', failText: 'Sędzia nie odgwizduje faulu.', value: 1.0, okChance: 0.3 },
    ],
  },
  wing: {
    title: 'Na skrzydle', short: 'akcja skrzydłem', ic: '➡️',
    text: 'Pędzisz skrzydłem z piłką, przed Tobą boczny obrońca, w polu karnym czekają partnerzy.',
    opts: [
      { t: 'Dośrodkowanie', w: { cr: 0.7, te: 0.3 }, bias: 0.1, ok: { assist: 0.34 }, okText: 'Idealne dośrodkowanie na głowę partnera!', failText: 'Dośrodkowanie za długie.', value: 1.0 },
      { t: 'Drybling do linii', w: { dr: 0.5, acc: 0.3, agi: 0.2 }, bias: -0.1, ok: { chain: 'cutback' }, fail: { concede: 0.05 }, okText: 'Mijasz obrońcę przy linii!', failText: 'Obrońca wybija piłkę na aut.', value: 1.2 },
      { t: 'Zejście do środka i strzał', w: { ls: 0.4, dr: 0.3, fla: 0.3 }, bias: -0.8, ok: { goal: 1 }, okText: 'Zejście na lepszą nogę i gol!', failText: 'Strzał nad poprzeczką.', value: 1.4 },
    ],
  },
  cutback: {
    title: 'Przy linii końcowej', short: 'akcja przy linii', ic: '↩️',
    text: 'Jesteś przy linii końcowej, obrońcy cofają się do bramki.',
    opts: [
      { t: 'Wycofanie na 11. metr', w: { ps: 0.5, vis: 0.3, te: 0.2 }, bias: 0.3, ok: { assist: 0.48 }, okText: 'Wycofanie prosto na nogę partnera!', failText: 'Obrońca przecina podanie.', value: 1.2 },
      { t: 'Strzał z ostrego kąta', w: { sh: 0.5, te: 0.3, cm: 0.2 }, bias: -1.3, ok: { goal: 1 }, okText: 'Niemożliwe! Gol z zerowego kąta!', failText: 'Bramkarz broni przy słupku.', value: 1.3 },
    ],
  },
  header: {
    title: 'Dośrodkowanie w pole karne', short: 'gra głową', ic: '🤕',
    text: 'Partner dośrodkowuje w pole karne, piłka leci w Twoją stronę.',
    opts: [
      { t: 'Strzał głową', w: { hd: 0.5, jmp: 0.3, st: 0.1, brv: 0.1 }, height: true, bias: -0.35, ok: { goal: 1 }, okText: 'Główka i gol!', failText: 'Główka obok bramki.', value: 1.5 },
      { t: 'Zgranie głową', w: { hd: 0.5, jmp: 0.3, tmw: 0.2 }, height: true, bias: 0.3, ok: { assist: 0.32 }, okText: 'Zgrywasz piłkę do partnera!', failText: 'Obrońca był wyżej.', value: 0.9 },
    ],
  },
  midfield: {
    title: 'Środek pola', short: 'rozegranie', ic: '🎯',
    text: 'Masz piłkę w środku pola, rywale wracają do obrony.',
    opts: [
      { t: 'Prostopadłe podanie', w: { vis: 0.5, ps: 0.4, te: 0.1 }, bias: -0.4, ok: { assist: 0.36 }, okText: 'Podanie, które rozcina obronę!', failText: 'Podanie przechwycone.', fail: { concede: 0.06 }, value: 1.1 },
      { t: 'Rajd z piłką', w: { dr: 0.4, acc: 0.3, bal: 0.3 }, bias: 0, ok: { chain: 'edge' }, okText: 'Przebiegasz z piłką przez środek!', failText: 'Tracisz piłkę w środku pola.', fail: { concede: 0.08 }, value: 1.0 },
      { t: 'Zmiana strony gry', w: { ps: 0.6, vis: 0.2, te: 0.2 }, bias: 0.9, ok: {}, rateOk: 0.1, okText: 'Długie podanie na drugie skrzydło.', failText: 'Podanie wychodzi na aut.', value: 0.45 },
      { t: 'Strzał z dystansu', w: { ls: 0.7, te: 0.3 }, bias: -1.5, ok: { goal: 1 }, okText: 'Bomba z 30 metrów!', failText: 'Strzał wysoko nad bramką.', value: 1.5 },
    ],
  },
  counter: {
    title: 'Kontratak!', short: 'kontra', ic: '⚡',
    text: 'Kontra! Biegniesz z piłką, obok Ciebie partner, przed Wami dwóch obrońców.',
    opts: [
      { t: 'Podanie do partnera', w: { ps: 0.5, vis: 0.3, dec: 0.2 }, bias: 0.35, ok: { assist: 0.45 }, okText: 'Podanie w tempo!', failText: 'Obrońca przecina podanie.', value: 1.2 },
      { t: 'Sam do bramki', w: { dr: 0.4, acc: 0.3, sp: 0.3 }, bias: -0.2, ok: { chain: 'oneOnOne' }, okText: 'Uciekasz obrońcom!', failText: 'Obrońca dogania Cię i odbiera piłkę.', value: 1.3 },
      { t: 'Zwolnienie gry', w: { dec: 0.6, ps: 0.4 }, bias: 1.3, ok: {}, rateOk: 0.05, okText: 'Drużyna spokojnie rozgrywa piłkę.', failText: 'Tracicie piłkę.', value: 0.3 },
    ],
  },
  fk: {
    title: 'Rzut wolny', short: 'rzut wolny', ic: '🎯',
    text: 'Rzut wolny 22 metry od bramki. Podchodzisz do piłki.',
    opts: [
      { t: 'Strzał nad murem', w: { fk: 0.7, te: 0.2, cm: 0.1 }, bias: -1.0, ok: { goal: 1 }, okText: 'Piłka przelatuje nad murem i wpada do bramki!', failText: 'Piłka trafia w mur.', value: 1.5 },
      { t: 'Dośrodkowanie w pole karne', w: { fk: 0.5, cr: 0.5 }, bias: 0.2, ok: { assist: 0.3 }, okText: 'Świetne dośrodkowanie!', failText: 'Bramkarz łapie piłkę.', value: 0.9 },
    ],
  },
  pen: {
    title: 'Rzut karny!', short: 'rzut karny', ic: '🥅',
    text: 'Sędzia wskazuje na wapno! Ustawiasz piłkę na 11. metrze.',
    opts: [
      { t: 'Mocno w róg', pen: true, w: { pen: 0.6, cm: 0.4 }, bias: 1.3, ok: { goal: 1 }, okText: 'Bramkarz bez szans!', failText: 'Bramkarz wyczuł intencje i broni!', value: 1.8 },
      { t: 'Panenka', pen: true, w: { pen: 0.4, cm: 0.3, fla: 0.3 }, bias: 0.8, ok: { goal: 1 }, okText: 'Panenka! Co za zimna krew!', failText: 'Bramkarz zostaje w środku i łapie piłkę.', value: 1.7 },
      { t: 'Płasko przy słupku', pen: true, w: { pen: 0.5, te: 0.2, cm: 0.3 }, bias: 1.1, ok: { goal: 1 }, okText: 'Przy samym słupku, gol!', failText: 'Piłka odbija się od słupka!', value: 1.75 },
    ],
  },
  // ---------------- obrona ----------------
  duel: {
    title: 'Pojedynek jeden na jeden', short: 'pojedynek w obronie', ic: '🛡️',
    text: 'Napastnik rywala biegnie z piłką prosto na Ciebie.',
    opts: [
      { t: 'Odbiór', w: { tk: 0.5, agi: 0.2, st: 0.15, ant: 0.15 }, bias: 0.15, ok: { win: 0.4 }, fail: { concede: 0.32 }, okText: 'Czysty odbiór!', failText: 'Napastnik Cię mija.', value: 1 },
      { t: 'Wślizg', w: { tk: 0.6, agi: 0.2, brv: 0.2 }, bias: 0.3, ok: { win: 0.3 }, fail: { concede: 0.38, card: 0.4 }, okText: 'Efektowny wślizg, piłka Twoja!', failText: 'Spóźniony wślizg!', value: 1 },
      { t: 'Asekuracja i cofanie się', w: { psn: 0.5, ant: 0.3, dec: 0.2 }, bias: 0.45, ok: {}, rateOk: 0.15, fail: { concede: 0.25 }, okText: 'Zamykasz drogę do bramki.', failText: 'Napastnik znajduje lukę.', value: 0.9 },
    ],
  },
  dcross: {
    title: 'Dośrodkowanie rywali', short: 'obrona pola karnego', ic: '🧱',
    text: 'Rywal dośrodkowuje w Twoje pole karne, w powietrzu walczysz z napastnikiem.',
    opts: [
      { t: 'Wybicie głową', w: { hd: 0.4, jmp: 0.3, st: 0.2, brv: 0.1 }, height: true, bias: 0.45, ok: {}, rateOk: 0.2, fail: { concede: 0.32 }, okText: 'Pewne wybicie głową!', failText: 'Napastnik wygrywa pojedynek w powietrzu.', value: 1 },
      { t: 'Krycie napastnika', w: { mk: 0.5, psn: 0.3, st: 0.2 }, bias: 0.35, ok: {}, rateOk: 0.2, fail: { concede: 0.36 }, okText: 'Napastnik nawet nie dochodzi do piłki.', failText: 'Napastnik urywa się spod krycia.', value: 1 },
    ],
  },
  through: {
    title: 'Podanie za plecy obrony', short: 'podanie za linię obrony', ic: '🏃',
    text: 'Rywal zagrywa prostopadle za Twoje plecy, napastnik rusza do piłki!',
    opts: [
      { t: 'Sprint za napastnikiem', w: { sp: 0.5, acc: 0.3, ant: 0.2 }, bias: 0, ok: {}, rateOk: 0.25, fail: { concede: 0.45 }, okText: 'Doganiasz napastnika i wybijasz piłkę!', failText: 'Napastnik ucieka Ci i strzela.', value: 1 },
      { t: 'Pułapka ofsajdowa', w: { ant: 0.5, dec: 0.3, tmw: 0.2 }, bias: -0.15, ok: {}, rateOk: 0.25, fail: { concede: 0.55 }, okText: 'Spalony! Chorągiewka w górze.', failText: 'Pułapka zawiodła, napastnik sam na sam!', value: 1 },
      { t: 'Faul taktyczny', w: { tk: 0.4, agg: 0.3, dec: 0.3 }, bias: 1.0, ok: { card: 0.65 }, rateOk: 0.0, fail: { concede: 0.4, card: 0.8 }, okText: 'Przerywasz akcję faulem.', failText: 'Nie zdążyłeś nawet sfaulować.', value: 0.25 },
    ],
  },
  press: {
    title: 'Pressing w środku pola', short: 'pressing', ic: '🔁',
    text: 'Rywal rozgrywa piłkę w środku pola, masz szansę doskoczyć.',
    opts: [
      { t: 'Agresywny pressing', w: { wr: 0.4, acc: 0.3, tk: 0.3 }, bias: -0.1, ok: { win: 0.55 }, fail: { concede: 0.1 }, okText: 'Odbierasz piłkę wysoko!', failText: 'Rywal ogrywa Cię jednym podaniem.', value: 1.1 },
      { t: 'Przechwyt podania', w: { ant: 0.5, psn: 0.3, agi: 0.2 }, bias: -0.2, ok: { win: 0.6 }, fail: { concede: 0.12 }, okText: 'Czytasz grę i przechwytujesz podanie!', failText: 'Nie trafiłeś w tempo.', value: 1.1 },
      { t: 'Zostań w ustawieniu', w: { psn: 0.5, tmw: 0.3, dec: 0.2 }, bias: 0.95, ok: {}, rateOk: 0.08, fail: { concede: 0.1 }, okText: 'Drużyna trzyma ustawienie.', failText: 'Rywal znalazł lukę w Twojej strefie.', value: 0.5 },
    ],
  },
  block: {
    title: 'Strzał z dystansu rywala', short: 'blokowanie strzału', ic: '🧍',
    text: 'Rywal szykuje się do strzału z 18 metrów.',
    opts: [
      { t: 'Blok', w: { brv: 0.5, psn: 0.3, ant: 0.2 }, bias: 0.25, ok: {}, rateOk: 0.25, fail: { concede: 0.3 }, okText: 'Blokujesz strzał ciałem!', failText: 'Piłka przelatuje obok Ciebie.', value: 1 },
      { t: 'Doskok i odbiór', w: { acc: 0.4, tk: 0.4, agg: 0.2 }, bias: 0, ok: { win: 0.35 }, fail: { concede: 0.33, card: 0.12 }, okText: 'Doskakujesz i odbierasz piłkę!', failText: 'Rywal strzela, zanim zdążyłeś.', value: 1 },
    ],
  },
  // ---------------- bramkarz ----------------
  gkShot: {
    title: 'Strzał na Twoją bramkę!', short: 'obrona strzału', ic: '🧤',
    text: 'Rywal uderza mocno z 16 metrów.',
    opts: [
      { t: 'Parada', w: { gk: 0.5, agi: 0.3, psn: 0.2 }, height: true, bias: 0.55, ok: { save: 1 }, rateOk: 0.35, fail: { concede: 0.85 }, okText: 'Fantastyczna parada!', failText: 'Piłka wpada do siatki.', value: 1 },
      { t: 'Piąstkowanie', w: { han: 0.3, agi: 0.4, gk: 0.3 }, bias: 0.75, ok: { save: 1 }, rateOk: 0.25, fail: { concede: 0.6 }, okText: 'Wypiąstkowujesz piłkę na rzut rożny.', failText: 'Piłka odbija się od rękawic i wpada do bramki.', value: 0.95 },
    ],
  },
  gkOne: {
    title: 'Napastnik sam na sam', short: 'sam na sam z napastnikiem', ic: '😱',
    text: 'Napastnik rywala wychodzi sam na sam z Tobą!',
    opts: [
      { t: 'Wyjście z bramki', w: { ovo: 0.5, gw: 0.3, brv: 0.2 }, bias: 0.05, ok: { save: 1 }, rateOk: 0.5, fail: { concede: 0.85 }, okText: 'Skracasz kąt i łapiesz piłkę!', failText: 'Napastnik Cię mija.', value: 1 },
      { t: 'Zostań na linii', w: { gk: 0.6, agi: 0.4 }, bias: -0.2, ok: { save: 1 }, rateOk: 0.5, fail: { concede: 0.85 }, okText: 'Refleks! Bronisz strzał z bliska!', failText: 'Napastnik pewnie trafia.', value: 1 },
    ],
  },
  gkCross: {
    title: 'Dośrodkowanie', short: 'wyjście do dośrodkowania', ic: '✋',
    text: 'Rywal dośrodkowuje w pole karne, piłka leci między Ciebie a obrońców.',
    opts: [
      { t: 'Wyjdź i złap', w: { aer: 0.4, coa: 0.3, han: 0.3 }, height: true, bias: 0.4, ok: { save: 1 }, rateOk: 0.25, fail: { concede: 0.4 }, okText: 'Pewnie łapiesz piłkę w powietrzu!', failText: 'Mijasz się z piłką!', value: 1 },
      { t: 'Zostań w bramce', w: { psn: 0.5, gk: 0.5 }, bias: 0.15, ok: { save: 1 }, rateOk: 0.2, fail: { concede: 0.35 }, okText: 'Bronisz główkę napastnika!', failText: 'Główka i gol.', value: 0.95 },
    ],
  },
  gkPen: {
    title: 'Rzut karny dla rywali', short: 'obrona karnego', ic: '🧤',
    text: 'Sędzia dyktuje karnego dla rywali. Stoisz na linii bramkowej.',
    opts: [
      { t: 'Rzut w lewo', w: { gk: 0.5, agi: 0.3, ant: 0.2 }, bias: -1.2, ok: { save: 1 }, rateOk: 0.9, fail: { concede: 1 }, okText: 'Bronisz karnego!', failText: 'Gol, rzuciłeś się w złą stronę.', value: 1 },
      { t: 'Rzut w prawo', w: { gk: 0.5, agi: 0.3, ant: 0.2 }, bias: -1.2, ok: { save: 1 }, rateOk: 0.9, fail: { concede: 1 }, okText: 'Bronisz karnego!', failText: 'Gol, rzuciłeś się w złą stronę.', value: 1 },
      { t: 'Zostań w środku', w: { gk: 0.4, cm: 0.3, ant: 0.3 }, bias: -1.5, ok: { save: 1 }, rateOk: 0.9, fail: { concede: 1 }, okText: 'Strzał w środek, łapiesz piłkę!', failText: 'Strzał w róg, gol.', value: 1 },
    ],
  },
};

/** Jak często dana pozycja trafia na dany scenariusz. */
export const POS_SCEN = {
  CF: [['oneOnOne', 2], ['box', 2], ['header', 2], ['edge', 2], ['counter', 1]],
  LW: [['wing', 3.5], ['edge', 2], ['counter', 2], ['oneOnOne', 1], ['header', 0.5], ['press', 1]],
  RW: [['wing', 3.5], ['edge', 2], ['counter', 2], ['oneOnOne', 1], ['header', 0.5], ['press', 1]],
  AM: [['edge', 3], ['midfield', 3], ['oneOnOne', 1], ['counter', 1.5], ['press', 1.5]],
  CM: [['midfield', 3.5], ['edge', 1.5], ['press', 2.5], ['counter', 1], ['block', 1.5]],
  DM: [['press', 3.5], ['midfield', 2], ['block', 2], ['duel', 2.5]],
  LB: [['wing', 2.5], ['duel', 3], ['dcross', 2], ['through', 1.5], ['press', 1]],
  RB: [['wing', 2.5], ['duel', 3], ['dcross', 2], ['through', 1.5], ['press', 1]],
  CB: [['duel', 3], ['dcross', 3], ['through', 2.5], ['header', 1.5]],
  GK: [['gkShot', 4.5], ['gkOne', 2.5], ['gkCross', 3]],
};
