// Poradnik: wszystkie najważniejsze mechaniki gry opisane prostym językiem.
import { screen, actions, go } from '../ui.js';
import { ATTR_NAMES, ATTR_HINTS, ATTR_GROUPS, POS_W, POS_NAMES, FORM_NAMES, FORM_MUL } from '../../engine/player.js';
import { TRAIN_KEYS, TRAIN_NAMES, TRAIN_ATTRS, TRAIN_BUDGET, TRAIN_MAX, TRAIN_MIN, trainPct, monthlyGain } from '../../engine/training.js';

const POS_LIST = ['GK', 'CB', 'LB', 'DM', 'CM', 'AM', 'LW', 'CF'];
const pl = (v) => String(v).replace('.', ',');

function attrTables() {
  const seen = new Set();
  return ATTR_GROUPS.map(([name, keys]) => `<h4>${name}</h4><table>${keys.filter((k) => !seen.has(k) && seen.add(k)).map((k) => `<tr><td><b>${ATTR_NAMES[k]}</b></td><td>${ATTR_HINTS[k] || ''}</td></tr>`).join('')}</table>`).join('');
}

function posTables() {
  return POS_LIST.map((pos) => {
    const w = Object.entries(POS_W[pos]).sort((a, b) => b[1] - a[1]);
    return `<h4>${POS_NAMES[pos]}${pos === 'LB' ? ' i prawy obrońca' : pos === 'LW' ? ' i prawy skrzydłowy' : ''}</h4><p>${w.map(([k, v]) => `${ATTR_NAMES[k]} <b>${Math.round(v * 100)}%</b>`).join(', ')}</p>`;
  }).join('');
}

function trainTable() {
  return `<table><tr><th>Kategoria</th><th>Atrybuty</th></tr>${TRAIN_KEYS.map((k) => `<tr><td><b>${TRAIN_NAMES[k]}</b></td><td>${TRAIN_ATTRS[k].map((a) => ATTR_NAMES[a]).join(', ')}</td></tr>`).join('')}</table>`;
}

function trainLevels() {
  const rows = [10, 8, 6, 5, 4, 3, 2, 0].map((p) => {
    const pct = trainPct(p); const g = monthlyGain(p);
    return `<tr><td><b>${p} pkt</b></td><td class="${pct > 0 ? 'good-t' : pct < 0 ? 'bad-t' : ''}">${pct > 0 ? '+' : ''}${pct}%</td><td class="${g > 0 ? 'good-t' : g < 0 ? 'bad-t' : ''}">${g > 0 ? '+' : ''}${pl(g.toFixed(2))}</td></tr>`;
  }).join('');
  return `<table><tr><th>Punkty</th><th>W meczu</th><th>Co miesiąc, kluczowe atrybuty</th></tr>${rows}</table>`;
}

const SECTIONS = [
  { id: 'start', ic: '🚀', t: 'Jak grać, krok po kroku', b: () => `
    <p>Jesteś selekcjonerem reprezentacji. Nie kupujesz zawodników, tylko wybierasz najlepszych z tych, którzy grają w klubach, i prowadzisz ich w meczach.</p>
    <ul>
      <li><b>Dalej</b> przesuwa czas. Gra sama się zatrzyma, gdy coś wymaga Twojej decyzji: powołania, mecz, konferencja, wiadomość.</li>
      <li><b>Powołania.</b> Przed każdym zgrupowaniem wybierasz 23 zawodników, a na turniej 26. Patrz na OVR, formę, świeżość i kontuzje. Nowych zawodników szukasz w <b>Skautingu</b>, a w <b>Kadrze</b> widzisz tylko powołanych.</li>
      <li><b>Akademia.</b> Co roku dostajesz 10 nowych dzieci. Po 18. urodzinach trafiają do U-21.</li>
      <li><b>Kadra</b> to szybkie ustawianie składu: lista pierwszej jedenastki od bramkarza do napastnika. Dotykasz pozycji i wybierasz zawodnika, widząc jego formę, świeżość i siłę na tej pozycji.</li>
      <li><b>Taktyka</b> to zaawansowane zarządzanie: ustawienie na boisku, styl gry, pressing, linia obrony, polecenia indywidualne i stałe fragmenty. Liczba na żetonie to siła zawodnika na tej pozycji.</li>
      <li><b>Trening.</b> Rozdziel punkty treningu. To daje bonus w meczu i rozwija zawodników co miesiąc.</li>
      <li><b>Mecz.</b> Oglądasz go na żywo albo symulujesz. W trakcie robisz zmiany i zmieniasz taktykę.</li>
      <li><b>Konferencje i rozmowy</b> zmieniają nastroje mediów, kibiców i zawodników.</li>
      <li><b>Federacja</b> ocenia Twoją pracę. Gdy jej zaufanie spadnie za nisko, zostaniesz zwolniony.</li>
    </ul>
    <div class="tip">Najprostszy przepis na sukces: powołuj zawodników w dobrej formie i świeżych, wystawiaj ich na ich nominalnych pozycjach, trenuj to, czego potrzebuje Twój styl gry, i dawaj minuty młodym.</div>` },

  { id: 'ovr', ic: '⭐', t: 'OVR, czyli ocena ogólna', b: () => `
    <p>OVR to jedna liczba, która mówi, jak dobry jest zawodnik <b>na swojej pozycji</b>. Liczy się ją jako średnią ważoną tylko tych atrybutów, które są ważne dla tej pozycji. W profilu zawodnika są podświetlone.</p>
    <p>Przykład: napastnik z Wykończeniem 90 i Odbiorem 30 ma wysoki OVR, bo Odbiór w ogóle nie wchodzi do oceny napastnika. Ten sam zawodnik jako obrońca miałby bardzo niską ocenę.</p>
    <div class="tip">Atrybuty spoza OVR nadal działają na boisku. Napastnik z dobrym Odbiorem naprawdę częściej odbierze piłkę, tylko jego OVR tego nie pokazuje.</div>
    <h4>Gra poza swoją pozycją</h4>
    <ul>
      <li>Swoja pozycja: <b>100%</b> siły.</li>
      <li>Pozycja alternatywna, podana w profilu: <b>96%</b>.</li>
      <li>Pozycja zbliżona, na przykład środkowy obrońca jako defensywny pomocnik: <b>88%</b>.</li>
      <li>Zupełnie obca pozycja: <b>75%</b>.</li>
      <li>Zawodnik z pola w bramce: <b>25%</b>.</li>
    </ul>
    <p>Kolor obwódki żetonu w taktyce to pokazuje: zielony oznacza swoją pozycję, żółty zbliżoną, a czerwony obcą.</p>
    <h4>Co liczy się do OVR na każdej pozycji</h4>${posTables()}` },

  { id: 'attrs', ic: '📊', t: 'Atrybuty i co robią', b: () => `
    <p>Każdy zawodnik ma 47 atrybutów w skali od 1 do 99. Do tego wzrost i waga. Każdy atrybut jest używany w meczu do konkretnej czynności, więc nie ma atrybutów bez znaczenia.</p>
    <ul>
      <li><b>Kolory liczb:</b> zielony to świetnie, żółty przeciętnie, pomarańczowy i czerwony słabo.</li>
      <li><b>Wzrost</b> pomaga w walce o górne piłki. Każdy centymetr ponad 180 to mała przewaga. U bramkarza wzrost zwiększa zasięg parady.</li>
      <li><b>Pojedynki.</b> Drybling zawsze walczy z Odbiorem, Gra głową ze Skocznością i Siłą rywala, a Wykończenie z Refleksem bramkarza.</li>
    </ul>${attrTables()}` },

  { id: 'pot', ic: '🔮', t: 'Potencjał', b: () => `
    <p>Potencjał to <b>sufit</b>, do którego zawodnik może dorosnąć. Każdy zawodnik ma go ukrytego od początku gry.</p>
    <ul>
      <li>Młody zawodnik rośnie tym szybciej, im większa różnica między potencjałem a obecnym OVR. Gdy zbliża się do potencjału, rośnie coraz wolniej.</li>
      <li>Od 27 lat potencjał powoli opada do poziomu obecnego OVR. Zawodnik po prostu przestaje się rozwijać.</li>
      <li>Trening może podnieść zawodnika najwyżej o 3 punkty ponad jego potencjał.</li>
    </ul>
    <h4>Jak sprawdzić potencjał</h4>
    <ul>
      <li>Wejdź w <b>Federacja</b> i poproś zarząd o <b>Sieć skautów</b>. Zarząd się zgodzi, jeśli ma do Ciebie wystarczające zaufanie.</li>
      <li>Od tej chwili w profilu każdego zawodnika poniżej 27 lat zobaczysz liczbę potencjału.</li>
      <li>🔥 przy liczbie oznacza, że zawodnik może urosnąć o 10 lub więcej punktów. ↗ oznacza 5 lub więcej.</li>
      <li>U zawodników od 27 lat zobaczysz napis <b>osiągnięty</b>, bo już się nie rozwiną.</li>
    </ul>
    <div class="tip">Szukaj młodych z 🔥 i dawaj im grać w kadrze lub w U-21. To przyszłe gwiazdy Twojej reprezentacji.</div>` },

  { id: 'dev', ic: '📈', t: 'Rozwój zawodników', b: () => `
    <p>Raz w miesiącu każdy zawodnik zyskuje albo traci trochę OVR. O tym, ile, decydują:</p>
    <h4>1. Wiek</h4>
    <table>
      <tr><td><b>do 20 lat</b></td><td>zyskuje co miesiąc 4,5% odległości do potencjału. Przykład: OVR 60 i potencjał 80, różnica 20, więc rośnie o ok. 0,9 na miesiąc.</td></tr>
      <tr><td><b>21 do 23</b></td><td>3,5% tej różnicy, czyli dalej szybko.</td></tr>
      <tr><td><b>24 do 27</b></td><td>2% tej różnicy, czyli już powoli.</td></tr>
      <tr><td><b>28 do 30</b></td><td>lekki spadek, ok. 0,05 na miesiąc.</td></tr>
      <tr><td><b>31 do 32</b></td><td>spadek ok. 0,2 na miesiąc.</td></tr>
      <tr><td><b>33 i więcej</b></td><td>spadek ok. 0,34 na miesiąc. Najszybciej spada szybkość, przyspieszenie, zwinność i wytrzymałość.</td></tr>
    </table>
    <h4>2. Status w klubie</h4>
    <p>Kluczowy zawodnik dostaje +0,08 na miesiąc, ważny +0,04, rotacyjny nic, a rezerwowy traci 0,07. Kto nie gra w klubie, ten się cofa.</p>
    <h4>3. Gra w kadrze lub U-21</h4>
    <p>Zawodnik do 23 lat, który zagrał w tym miesiącu, dostaje dodatkowo do +0,24.</p>
    <h4>4. Trening kadry</h4>
    <p>Zawodnicy powołani do kadry i U-21 oraz wychowankowie akademii co miesiąc dostają albo tracą punkty w atrybutach według Twojego planu treningowego. Szczegóły w części Trening.</p>
    <h4>5. Kontuzje i doświadczenie</h4>
    <p>Kontuzja dłuższa niż 20 dni zabiera 0,1. Z wiekiem rosną powoli doświadczenie i głowa: Przywództwo, Opanowanie, Decyzje, Przewidywanie, Ustawianie się i Koncentracja.</p>
    <div class="tip">Zawodnik przed trzydziestką to najlepszy moment. Po trzydziestce warto szukać jego następcy.</div>` },

  { id: 'train', ic: '🏋️', t: 'Trening', b: () => `
    <p>Masz <b>${TRAIN_BUDGET} punktów</b> do rozdzielenia na ${TRAIN_KEYS.length} kategorii, maksymalnie <b>${TRAIN_MAX}</b> na jedną. Każda kategoria trenuje swoje atrybuty.</p>
    <h4>Co daje trening</h4>
    <ul>
      <li><b>Bonus w meczu.</b> Każdy punkt powyżej ${TRAIN_MIN} wzmacnia w meczu atrybuty z tej kategorii o 2%. Przy ${TRAIN_MAX} punktach to +${trainPct(TRAIN_MAX)}%.</li>
      <li><b>Rozwój co miesiąc.</b> Zawodnicy kadry, U-21 i akademii dostają punkty w atrybutach tej kategorii. Najwięcej w atrybutach kluczowych dla swojej pozycji, a w pozostałych trzy razy mniej. Młodzi rosną szybciej, starsi wolniej.</li>
      <li><b>Kondycja</b> dodatkowo sprawia, że zawodnicy wolniej się męczą w meczu i rzadziej łapią kontuzje.</li>
    </ul>
    <div class="warn"><b>Zaniedbanie.</b> Jeśli kategoria ma mniej niż ${TRAIN_MIN} punkty, jej atrybuty działają w meczu słabiej, a przy 0 punktach aż o ${-trainPct(0)}%. Do tego co miesiąc zawodnicy tracą w nich punkty. Przykład: 0 punktów w Treningu bramkarzy to słabszy bramkarz w każdym meczu.</div>
    <h4>Ile daje ile punktów</h4>${trainLevels()}
    <h4>Które atrybuty należą do której kategorii</h4>${trainTable()}
    <h4>Przykładowe plany</h4>
    <ul>
      <li><b>Zrównoważony:</b> po 5 w każdej kategorii. Wszędzie mały bonus, żadnych kar.</li>
      <li><b>Atak:</b> Ofensywa 10, Posiadanie 6, Kondycja 5, Bramkarze 4, Defensywa 4, Stałe fragmenty 4, Mentalne 2. Duży bonus dla napastników, mała kara w głowie.</li>
      <li><b>Mur:</b> Defensywa 10, Kondycja 6, Bramkarze 6, Stałe fragmenty 5, Posiadanie 4, Mentalne 4, Ofensywa 0. Bardzo szczelna obrona, ale słaby atak.</li>
    </ul>
    <div class="tip">Trenuj to, co pasuje do Twojej taktyki i Twoich najlepszych zawodników. Uważaj z wartościami poniżej ${TRAIN_MIN}, bo kara działa w każdym meczu i co miesiąc obniża atrybuty.</div>
    <p>Prośba do federacji o <b>Obóz przygotowawczy</b> daje zawodnikom kadry od razu efekt dwóch miesięcy treningu.</p>` },

  { id: 'form', ic: '🔥', t: 'Forma, morale i świeżość', b: () => `
    <p>To dyspozycja dnia. Te same atrybuty mogą dać w meczu dużo więcej albo dużo mniej.</p>
    <h4>Forma</h4>
    <table>${[2, 1, 0, -1, -2].map((f) => `<tr><td><b>${FORM_NAMES[f + 2]}</b></td><td class="${f > 0 ? 'good-t' : f < 0 ? 'bad-t' : ''}">${f === 0 ? 'bez zmian' : `${f > 0 ? '+' : ''}${Math.round((FORM_MUL[f] - 1) * 100)}% do wszystkich atrybutów`}</td></tr>`).join('')}</table>
    <p>Forma co tydzień może się zmienić o jeden poziom. Zawodnicy kluczowi w klubach częściej idą w górę. Rozmowa z zawodnikiem może ją poprawić.</p>
    <h4>Morale</h4>
    <p>Morale od 0 do 100 daje w meczu do 3% w górę albo w dół. Wygrana daje +4, remis +1, porażka 3 w dół. Świetna ocena w meczu dodaje 3, słaba zabiera 3. Pominięcie w powołaniach, złamana obietnica i źle przeprowadzona rozmowa obniżają morale. Z czasem morale wraca w okolice 55.</p>
    <h4>Świeżość</h4>
    <ul>
      <li>Procent przy zawodniku to jego świeżość. W meczu spada, wolniej u zawodników z dobrą Wytrzymałością.</li>
      <li>Zmęczenie obniża atrybuty fizyczne nawet o 44%, a techniczne o 30%. Zmęczony zawodnik częściej się myli.</li>
      <li>Między meczami świeżość wraca o 2,5% dziennie. Naturalna kondycja przyspiesza regenerację.</li>
      <li>Wysoki pressing i ofensywny styl męczą szybciej. Trening Kondycji męczy wolniej.</li>
    </ul>
    <div class="tip">Zawodnik w formie Znakomitej z OVR 72 gra często lepiej niż zawodnik w formie Fatalnej z OVR 77. Patrz na formę przy powołaniach.</div>` },

  { id: 'match', ic: '⚽', t: 'Mecz: jak to działa', b: () => `
    <p>Na boisku każdy zawodnik sam decyduje, co robi: podaje, drybluje, strzela, biega bez piłki, pressuje i kryje. Każde starcie rozstrzyga porównanie atrybutów obu zawodników, z odrobiną szczęścia.</p>
    <h4>Siła zawodnika w danej chwili</h4>
    <p>Atrybut razy forma, morale, ocena na żywo, zmęczenie, dopasowanie do pozycji, trening, atut własnego boiska i kapitan.</p>
    <h4>Ocena na żywo</h4>
    <ul>
      <li>Każdy zaczyna od 6,5. Dobre zagrania podnoszą ocenę, błędy obniżają.</li>
      <li>Od 7,0 zawodnik dostaje do +6% do umiejętności. Rozpędzony gra coraz lepiej.</li>
      <li>Poniżej 6,3 dostaje do 8% kary i częściej się myli. Warto go wtedy zmienić.</li>
    </ul>
    <h4>Inne czynniki</h4>
    <ul>
      <li><b>Własne boisko</b> daje drużynie +3%.</li>
      <li><b>Kapitan</b> z wysokim Przywództwem daje do +2% całej drużynie.</li>
      <li><b>Determinacja</b> pomaga, gdy przegrywacie. <b>Koncentracja</b> zmniejsza błędy w końcówce.</li>
      <li><b>Charakter</b> zmienia styl gry: Polot to więcej dryblingu i strzałów z daleka, Agresja więcej odbiorów i fauli, Pracowitość mocniejszy pressing.</li>
    </ul>
    <h4>Zmiany w meczu</h4>
    <p>Masz 5 zmian. Zmiana wchodzi przy najbliższej przerwie w grze. Zmieniaj zmęczonych i tych z oceną poniżej 6,3.</p>` },

  { id: 'tactics', ic: '🧠', t: 'Taktyka', b: () => `
    <ul>
      <li><b>Formacja.</b> Dobierz ją do zawodników, których masz. Lepiej mieć silnych zawodników na swoich pozycjach niż modną formację.</li>
      <li><b>Styl gry.</b> Ofensywny: więcej zawodników w ataku, więcej strzałów i dośrodkowań, ale obrońcy grają słabiej i rywal ma groźniejsze kontry. Defensywny: drużyna cofa się i gra bezpośrednio długimi piłkami, mniej traci, mniej strzela, częściej remisuje. Dobry dla słabszej drużyny.</li>
      <li><b>Pressing.</b> Wysoki: drużyna doskakuje do rywala na jego połowie i odcina mu podania, ale męczy się dużo szybciej i zostawia miejsce za plecami. Niski: zwarty blok przed polem karnym, mniej zmęczenia, groźniejsze kontry, ale rywal dłużej trzyma piłkę.</li>
      <li><b>Linia obrony.</b> Głęboka: obrońcy stoją przy własnym polu karnym, rywal ma mniej miejsca za ich plecami i trudniej mu o strzał z bliska, ale dłużej trzyma piłkę i częściej strzela z daleka. Wysoka: cała drużyna gra bliżej bramki rywala i szybciej odzyskuje piłkę, ale jedno dobre podanie za plecy obrońców daje rywalowi sam na sam. Wysoka linia z szybkimi obrońcami, głęboka z wolnymi.</li>
      <li><b>Gra na czas.</b> Drużyna wolniej rozgrywa, rzadziej drybluje i strzela. Pomaga dowieźć prowadzenie, ale oddaje inicjatywę rywalowi.</li>
      <li><b>Pułapki ofsajdowe.</b> Linia obrony wychodzi wyżej, więc rywal częściej jest na spalonym. Gdy pułapka się nie uda, rywal wychodzi sam na sam.</li>
      <li><b>Tłok w polu karnym.</b> Im więcej Twoich obrońców w szesnastce, tym trudniej rywalowi o czysty strzał.</li>
      <li><b>Polecenia indywidualne.</b>
        <ul>
          <li><b>Strzały:</b> nigdy oznacza, że zawodnik szuka podania zamiast strzału z daleka. Często, że strzela przy każdej okazji.</li>
          <li><b>Drybling:</b> częściej próbuje minąć rywala. Więcej szans, ale i strat.</li>
          <li><b>Podania krótkie:</b> cierpliwe granie po ziemi, więcej posiadania piłki i więcej podań. <b>Długie:</b> szybko górą do przodu, mniej posiadania, więcej szybkich akcji.</li>
          <li><b>Odbiór ostry:</b> więcej odbiorów, ale też dużo więcej fauli i żółtych kartek.</li>
          <li><b>Symulowanie fauli:</b> po stracie piłki pod bramką rywala zawodnik czasem się przewraca. Sędzia może podyktować faul, nawet karny, albo ukarać go żółtą kartką.</li>
        </ul></li>
      <li><b>Stałe fragmenty.</b> Wybierz wykonawców: do rożnych zawodnika z dobrymi Rzutami rożnymi, do karnych z Rzutami karnymi i Opanowaniem. W pole karne wysyłaj wysokich z dobrą Grą głową.</li>
    </ul>
    <div class="tip">Przed meczem czytaj Raport asystenta. Podpowiada, kto jest zmęczony, kto gra poza pozycją i jakie słabości ma rywal.</div>` },

  { id: 'squad', ic: '👥', t: 'Powołania i prowadzenie zawodników', b: () => `
    <ul>
      <li><b>Kogo powoływać:</b> wysoki OVR, dobra forma, świeżość powyżej 80%, brak kontuzji. Miej po dwóch zawodników na każdą pozycję.</li>
      <li><b>Status w klubie</b> mówi, czy zawodnik gra regularnie. Rezerwowi w klubach tracą formę i się cofają.</li>
      <li><b>Pominięcie gwiazdy</b> obniża jej morale i zaufanie zawodników do Ciebie.</li>
      <li><b>Rozmowy.</b> Pochwała pomaga zawodnikom w formie, krytyka może pobudzić tych w słabszej formie. Obietnica gry w pierwszym składzie daje dużo morale, ale jej złamanie mocno boli.</li>
      <li><b>Kartki.</b> Czerwona kartka to pauza w następnym meczu. Dwie żółte w meczach o punkty to również pauza.</li>
      <li><b>U-21.</b> Młodzi do 21 lat rozwijają się szybciej, gdy grają w kadrze U-21.</li>
    </ul>` },

  { id: 'scout', ic: '🔭', t: 'Skauting i Akademia', b: () => `
    <h4>Kadra i Skauting</h4>
    <ul>
      <li><b>Kadra</b> pokazuje tylko Twoich powołanych zawodników.</li>
      <li><b>Skauting</b> to cała baza zawodników z Twojego kraju, około 200 osób. Filtrujesz po pozycji i wieku, sortujesz po ocenie, formie, wieku albo potencjale i wyszukujesz po nazwisku.</li>
      <li>Przycisk ➕ przy zawodniku powołuje go do kadry, a ✓ oznacza, że już w niej jest.</li>
      <li>W bazie są gwiazdy, solidni rezerwowi i ukryte talenty. Najlepiej szukać młodych z 🔥 przy potencjale.</li>
    </ul>
    <h4>Akademia</h4>
    <ul>
      <li>W akademii federacji szkolą się dzieci i młodzież od 4 do 17 lat.</li>
      <li>Co roku, 1 stycznia, dołącza <b>10 nowych wychowanków</b> w wieku od 4 do 9 lat.</li>
      <li>Wychowanek rośnie z wiekiem: jego ocena zbliża się do części potencjału odpowiedniej dla wieku. Rośnie też jego wzrost i waga.</li>
      <li>Akademia trenuje według Twojego planu treningowego, tak samo jak kadra i U-21. Dobry plan to lepsi wychowankowie.</li>
      <li>Po skończeniu <b>18 lat</b> wychowanek przechodzi automatycznie do kadry U-21 i do bazy zawodników, z której możesz go powołać do pierwszej reprezentacji.</li>
      <li>Potencjał wychowanków widać po zatrudnieniu skautów.</li>
    </ul>` },

  { id: 'fed', ic: '🏛️', t: 'Federacja, kibice i media', b: () => `
    <ul>
      <li><b>Zaufanie federacji</b> to Twoja posada. Rośnie po wygranych i zrealizowanych celach, spada po porażkach. Gdy spadnie za nisko, zostaniesz zwolniony. Wcześniej dostaniesz ostrzeżenie.</li>
      <li><b>Cele</b> od zarządu znajdziesz w menu Federacja. Ich realizacja mocno podnosi zaufanie.</li>
      <li><b>Kibice</b> reagują na wyniki i styl gry. <b>Zawodnicy</b> na powołania i Twoje słowa. <b>Media</b> na konferencje prasowe.</li>
      <li><b>Prośby do zarządu:</b> obóz treningowy, sztab medyczny leczący kontuzje szybciej, sieć skautów pokazująca potencjał i prestiżowy sparing. Każda prośba kosztuje trochę zaufania.</li>
      <li><b>Ranking</b> rośnie po wygranych z silnymi rywalami. Wyższy ranking to łatwiejsze losowania i lepsze oferty pracy.</li>
    </ul>` },

  { id: 'career', ic: '🧑', t: 'Tryb zawodnika', b: () => `
    <p>Drugi tryb gry: tworzysz własnego piłkarza i prowadzisz jego karierę. Wejdziesz do niego z menu głównego przyciskiem <b>Tryb zawodnika</b>.</p>
    <h4>Start</h4>
    <ul>
      <li>Wybierasz imię, nazwisko, narodowość, pozycję, numer, lepszą nogę i wygląd.</li>
      <li>Zaczynasz jako 17-latek w jednym z początkujących klubów drugiej ligi Twojego kraju.</li>
    </ul>
    <h4>Tydzień</h4>
    <ul>
      <li>Raz w tygodniu możesz pójść na <b>trening</b>: wybierasz grupę umiejętności, dostajesz punkty rozwoju i lekko poprawiasz jeden atrybut.</li>
      <li>Punkty rozwoju dostajesz też za każdy mecz, więcej za dobrą ocenę, gole i asysty.</li>
      <li>W zakładce <b>Rozwój</b> wydajesz punkty na dowolne atrybuty. Im wyższy atrybut, tym drożej, a powyżej potencjału kilka razy drożej.</li>
      <li><b>Dalej</b> rozgrywa mecze tygodnia: ligę, puchar albo mecze reprezentacji.</li>
    </ul>
    <h4>Mecz na boisku 2D: sterujesz swoim zawodnikiem</h4>
    <ul>
      <li>Przycisk <b>Graj na boisku</b> uruchamia mecz 2D. Twój zawodnik ma żółty pierścień i strzałkę nad głową, a kamera podąża za nim.</li>
      <li><b>Drążek</b>: dotknij lewej połowy ekranu, a drążek pojawi się pod palcem. Lekkie wychylenie to bieg, pełne to sprint. Twoją postacią sterujesz tylko Ty: gdy puścisz drążek, stoi w miejscu, a z piłką nic nie zrobi bez Twojego polecenia.</li>
      <li><b>Zderzenia:</b> zawodnicy stykają się krawędziami i nie wchodzą na siebie: przepychacie się bokami, a mniej cofa się ten, kto ma więcej Siły i Równowagi. Przez rywala przejdziesz tylko udanym dryblingiem.</li>
      <li><b>Piłka:</b> podanie od partnera i wolna piłka trzymają się Twojej nogi i nie przelatują przez Ciebie. Partnerzy podają w nogi albo tam, dokąd biegniesz. Przejęcie podania rywala zależy od Przewidywania i ustawienia.</li>
      <li>Stałe fragmenty, czyli rożne, wolne, karne i auty, wykonują koledzy z drużyny. Twoja postać nie jest przy nich przestawiana, sam wybierasz, gdzie stanąć.</li>
      <li><b>Z piłką:</b> Strzał, Podanie do partnera w kierunku drążka, Drybling i Długie, czyli dośrodkowanie ze skrzydła albo długie podanie.</li>
      <li><b>Drybling:</b> po naciśnięciu od razu Twój Drybling, Zwinność, Równowaga, Przyspieszenie, Technika i Flair walczą z Odbiorem, Przewidywaniem i Ustawianiem się najbliższego rywala przed Tobą. Udany: Twój zawodnik razem z piłką staje się przezroczysty, świeci na niebiesko i przez 3 sekundy przenika przez rywali, a nikt nie może go zaatakować. Łuk wokół zawodnika pokazuje, ile czasu zostało. Przez bramkarza przeniknąć się nie da. Nieudany: rywal czysto zabiera piłkę. Kolejny drybling możesz zrobić po chwili, gdy przycisk znów jest jasny. Bez rywala w pobliżu drybling to zwykłe szybsze prowadzenie piłki.</li>
      <li><b>Odbiór:</b> czyste zabranie piłki bez faulu. Twój Odbiór, Ustawianie się i Siła kontra Drybling, Technika i Równowaga rywala z piłką. Lepszy wygrywa, z małą dozą szczęścia. Gdy wygrasz, rywal stoi w miejscu przez sekundę, a Ty odchodzisz z piłką. Uwaga: odbiór działa tylko od przodu. Odbiór od tyłu albo z boku zawodnika z piłką, czyli spoza kierunku, w którym patrzy, to zawsze faul.</li>
      <li><b>Wślizg:</b> zawsze zabiera piłkę rywalowi w zasięgu około 3 metrów, piłka przykleja się do Ciebie, a rywal zostaje odrzucony i przewraca się. Działa raz na 5 sekund. Wślizg w pustą murawę też zużywa czas odnowienia. Wślizg od tyłu albo z boku to faul i żółta kartka, a druga żółta oznacza czerwoną.</li>
      <li><b>Rywale też:</b> te same zasady obowiązują wszystkich na boisku. Rywal, który zaatakuje Cię od tyłu albo z boku, fauluje, a za wślizg w ten sposób dostaje żółtą kartkę.</li>
      <li><b>Zawołaj:</b> prośba do partnera z piłką o podanie. Koledzy z lepszą relacją podają do Ciebie częściej.</li>
      <li>Wszystko zależy od statystyk: celność podań od Podań i Techniki, strzał od Wykończenia albo Strzałów z dystansu w starciu z Refleksem bramkarza, drybling od Dryblingu w starciu z Odbiorem rywala, szybkość biegu od Szybkości, rozpędzanie od Przyspieszenia, zwroty od Zwinności. Obrońcy mogą zablokować strzał, a bramkarz z lepszymi statystykami obroni więcej.</li>
      <li>Na komputerze: strzałki albo WASD, J podanie, K strzał, L drybling albo odbiór, I długie albo wślizg.</li>
      <li>Tempo meczu zmienisz przyciskiem Tempo. Przycisk z lupą przełącza kamerę: całe boisko albo jeden z pięciu poziomów przybliżenia, a gra zapamiętuje Twój wybór. Symuluj dogrywa resztę meczu, a Twój zawodnik gra wtedy sam.</li>
      <li>Rezerwowy wchodzi z ławki w trakcie meczu. Gdy nie ma Cię w kadrze meczowej, mecz rozgrywa się bez Ciebie.</li>
    </ul>
    <h4>Szybki mecz z decyzjami</h4>
    <ul>
      <li>W kluczowych sytuacjach mecz się zatrzymuje i wybierasz, co robisz: strzał, drybling, podanie, dośrodkowanie, odbiór, wślizg, parada i inne, zależnie od pozycji.</li>
      <li>Przy każdej opcji widać szansę powodzenia. Liczy się porównanie Twoich atrybutów z siłą rywala, forma i świeżość.</li>
      <li>Udany drybling może dać kolejną decyzję, na przykład sam na sam z bramkarzem.</li>
      <li>W obronie zły wybór może skończyć się golem dla rywali albo kartką.</li>
    </ul>
    <h4>Kariera</h4>
    <ul>
      <li>Status w klubie zależy od Twojej oceny w porównaniu z siłą klubu: od młodzieżowca do gwiazdy zespołu.</li>
      <li>Zimą i latem są okna transferowe. Oferty zależą od oceny i formy, a lista transferowa daje więcej ofert.</li>
      <li>Gdy Twoja ocena zbliży się do siły reprezentacji, dostaniesz powołanie. Mistrzostwa Świata są co 4 lata: 2030, 2034. Mistrzostwa kontynentu też co 4 lata, ale przesunięte o 2 lata: 2028, 2032. Dlatego wielki turniej jest co 2 lata na przemian.</li>
      <li><b>Ligi i puchary krajowe:</b> każdy kraj na świecie ma 3 ligi: I, II i III. Duże ligi i Twój kraj mają po 12 klubów, pozostałe kraje po 8. Po sezonie 2 najlepsze kluby awansują, a 2 ostatnie spadają. Każdy kraj ma też swój puchar: 16 klubów ze wszystkich trzech lig. Grasz w pucharze kraju, w którym gra Twój klub. W Tabeli możesz wybrać dowolną ligę i puchar dowolnego kraju. Karierę zaczynasz w III lidze.</li>
      <li><b>Unova League</b>, kategoria Świat: grają w niej kluby z całego świata, które w poprzednim sezonie zdobyły puchar swojego kraju. Gra 32 najmocniejszych, każdy kontynent ma co najmniej 2 miejsca. Format jak w Lidze Mistrzów: 4 grupy po 8 klubów i faza pucharowa. W pierwszym sezonie kariery grają najmocniejsze kluby poszczególnych krajów. Klub może grać jednocześnie w Unova League i w pucharach europejskich.</li>
      <li>Puchary europejskie: grają w nich tylko kluby z lig Europy. <b>Liga Mistrzów</b> to 32 najlepsze kluby z miejsc 1–3, a <b>Super Liga</b> to 32 najlepsze kluby z miejsc 4–8 w najwyższych ligach. W każdej 4 grupy po 8 klubów, w grupie każdy z każdym. Dwa najlepsze kluby z każdej grupy grają w fazie pucharowej: ćwierćfinał, półfinał i finał o trofeum. Przy remisie w fazie pucharowej decydują rzuty karne.</li>
      <li><b>Ultra Liga</b>: najwyższe wyróżnienie, tylko 10 klubów. Grają w niej po 5 najlepszych klubów z fazy pucharowej Ligi Mistrzów i Super Ligi z poprzedniego sezonu, czyli zwycięzca, finalista, półfinaliści i najlepszy z ćwierćfinalistów. Liga każdy z każdym, wygrywa pierwsze miejsce. Kluby z Ultra Ligi nie grają w tym sezonie w Lidze Mistrzów ani w Super Lidze.</li>
      <li><b>Klub:</b> każdy klub ma stałą kadrę zawodników z imionami, wiekiem, oceną i statystykami z sezonu. Na ekranie Klub zobaczysz wszystkie informacje o klubie i jego skład. Dotknij dowolnego klubu w tabeli albo w rankingu, aby zobaczyć jego stronę, a zawodnika, aby zobaczyć jego szczegóły.</li>
      <li><b>Relacje:</b> z każdym wspólnym meczem relacja z kolegą rośnie, a najszybciej, gdy kolega Ci podaje. Poziomy: nowy w drużynie, znajomy, kolega, dobry kumpel, przyjaciel. Im lepsza relacja, tym częściej kolega podaje do Ciebie w meczu 2D. Po transferze budujesz relacje od nowa.</li>
      <li><b>Kluby się zmieniają:</b> zawodnicy starzeją się i rozwijają, starsi kończą kariery, przychodzą młodzi, a najlepsi przechodzą do mocniejszych klubów. Zimą kluby dokupują zawodników.</li>
      <li><b>Nagrody w lidze:</b> w Tabeli, w zakładce Nagrody, śledzisz co tydzień wyścig w każdej lidze: król strzelców, król asyst, piłkarz sezonu, najlepszy bramkarz według czystych kont, najlepszy obrońca, pomocnik i napastnik według średniej oceny oraz młodzieżowiec sezonu do 21 lat. Po ostatniej kolejce nagrodę dostaje pierwsze miejsce.</li>
      <li><b>Ranking:</b> ranking wszystkich klubów i światowy ranking piłkarzy, liczony z umiejętności i formy w sezonie. Na koniec sezonu: 1. miejsce Złota Piłka, 2. Srebrna Piłka, 3. Brązowa Piłka, miejsca 4–10 Światowa dziesiątka, 11–30 Światowa trzydziestka, 31–100 Światowa setka.</li>
      <li>Trofea: mistrzostwo ligi, puchar kraju, puchary europejskie, awans, turnieje reprezentacji.</li>
      <li>Od 33 lat możesz zakończyć karierę, w wieku 40 lat kończysz ją na pewno.</li>
    </ul>` },

  { id: 'tips', ic: '💡', t: 'Złote rady', b: () => `
    <ul>
      <li>Forma i świeżość są równie ważne jak OVR.</li>
      <li>Nie wystawiaj zawodników poza ich pozycją, chyba że musisz.</li>
      <li>Trenuj zgodnie ze stylem gry i nie zostawiaj ważnych kategorii poniżej ${TRAIN_MIN} punktów.</li>
      <li>Zatrudnij skautów jak najszybciej i inwestuj minuty w młodych z dużym potencjałem.</li>
      <li>W meczu zmieniaj zawodników zmęczonych i z niską oceną na żywo.</li>
      <li>Rotuj składem w meczach towarzyskich, żeby gwiazdy były świeże na mecze o punkty.</li>
      <li>Dbaj o zaufanie federacji: realizuj cele i nie przegrywaj z dużo słabszymi.</li>
    </ul>` },
];

let openId = null;

screen('guide', {
  render(params = {}) {
    if (params.sec) { openId = params.sec; params.sec = null; }
    const body = `<p class="small muted mb">Dotknij tematu, aby go rozwinąć.</p>${SECTIONS.map((s) => `<details class="guide-sec" ${openId === s.id ? 'open' : ''}><summary><span class="gi">${s.ic}</span>${s.t}</summary><div class="guide-body">${s.b()}</div></details>`).join('')}`;
    return { title: 'Poradnik', sub: 'Jak prowadzić reprezentację', cls: 'nofoot', body };
  },
});

actions({
  'guide.open': (d) => go('guide', { sec: d.k === 'training' ? 'train' : d.k || null }),
});
