// Pytania dziennikarzy. {P} zawodnik, {O} rywal, {S} wynik. Efekty: fans, media, pl (piłkarze), fed, star (morale zawodnika {P}).

export const OUTLETS = ['Gazeta Futbolowa', 'Przegląd Kadrowy', 'Sport Dzisiaj', 'Głos Trybun', 'Radio Gol', 'portal Na Spalonym', 'Tygodnik Piłkarski', 'telewizja Sport24'];

export const GREETINGS = [
  'Witam, mówi {J} z redakcji „{M}”. Ma pan kilka minut na rozmowę?',
  'Dzień dobry, {J}, „{M}”. Czy mogę zadać panu parę pytań?',
  'Panie selekcjonerze, {J} z „{M}”. Znajdzie pan chwilę dla naszych czytelników?',
];
export const GREET_ANSWERS = [
  { t: 'Jasne, słucham.', k: 'yes' },
  { t: 'Teraz nie mogę, proszę zadzwonić później.', k: 'later', e: { media: -1 } },
  { t: 'Nie udzielam wywiadów. Proszę więcej nie dzwonić.', k: 'never', e: { media: -4 } },
];

export const QUESTIONS = [
  // ---------- po meczu ----------
  { ctx: 'win_big', q: 'Wysokie zwycięstwo {S}! Czy to był najlepszy mecz tej drużyny?', a: [
    { t: 'Zdecydowanie tak. Zagraliśmy dokładnie tak, jak to sobie zaplanowaliśmy.', e: { fans: 2, pl: 2, media: 1 } },
    { t: 'To dobry wynik, ale nie popadajmy w euforię. Przed nami trudniejsze mecze.', e: { media: 2, fed: 1 } },
    { t: 'Rywal był bardzo słaby, trudno wyciągać z tego meczu daleko idące wnioski.', e: { media: 1, pl: -2, fans: -1 } },
  ] },
  { ctx: 'win', q: 'Gratuluję zwycięstwa. Co zadecydowało o wyniku?', a: [
    { t: 'Charakter. Moi piłkarze walczyli o każdy metr boiska.', e: { pl: 3, fans: 1 } },
    { t: 'Dobre przygotowanie taktyczne. Wiedzieliśmy, gdzie rywal ma słabe punkty.', e: { media: 2, fed: 1 } },
    { t: 'Trochę szczęścia, momentami przeciwnik był lepszy.', e: { media: 1, fans: -1, pl: -1 } },
  ] },
  { ctx: 'win', q: 'Kibice wychodzili ze stadionu zadowoleni. Czy drużyna złapała właściwy rytm?', a: [
    { t: 'Tak, widać efekty naszej pracy. To dopiero początek.', e: { fans: 3, media: 1 } },
    { t: 'Jeszcze dużo pracy przed nami, ale idziemy w dobrym kierunku.', e: { media: 2, fed: 1 } },
    { t: 'Nie przywiązuję wagi do zachwytów. Liczą się tylko punkty.', e: { fans: -2, media: -1 } },
  ] },
  { ctx: 'draw', q: 'Remis {S}. Czuje pan niedosyt?', a: [
    { t: 'Tak. Byliśmy lepsi i powinniśmy wygrać to spotkanie.', e: { fans: 1, pl: 2, media: -1 } },
    { t: 'Remis to sprawiedliwy wynik. Rywal postawił nam trudne warunki.', e: { media: 2, fed: 1 } },
    { t: 'Szczerze? Jestem zadowolony. Mogło być znacznie gorzej.', e: { fans: -2, media: 1, fed: -1 } },
  ] },
  { ctx: 'draw', q: 'Czy tym razem zabrakło skuteczności?', a: [
    { t: 'Stworzyliśmy sytuacje, piłka po prostu nie chciała wpaść.', e: { pl: 2, media: -1 } },
    { t: 'Musimy więcej pracować nad wykończeniem akcji, to oczywiste.', e: { media: 2, fed: 1, pl: -1 } },
    { t: 'Problem leży w napastnikach. Oczekuję od nich więcej.', e: { pl: -4, media: 1, fans: 1 } },
  ] },
  { ctx: 'loss', q: 'Porażka {S}. Co zawiodło?', a: [
    { t: 'Zabrakło szczęścia. Mieliśmy swoje okazje, wynik nie oddaje przebiegu gry.', e: { pl: 2, media: -2, fans: 1 } },
    { t: 'Przeciwnik był dziś po prostu lepszy. Musimy wyciągnąć wnioski.', e: { media: 2, fed: 1 } },
    { t: 'Moi zawodnicy nie zrealizowali założeń. Jestem rozczarowany ich postawą.', e: { pl: -5, media: 1, fans: 1 } },
  ] },
  { ctx: 'loss', q: 'Czy czuje pan, że pańska posada jest zagrożona?', a: [
    { t: 'Nie. Federacja wie, nad czym pracujemy, i ma do mnie zaufanie.', e: { fed: -1, media: -1, pl: 1 } },
    { t: 'To nie jest temat na dziś. Skupiam się na kolejnym meczu.', e: { media: 1, fed: 1 } },
    { t: 'Jeśli wyniki się nie poprawią, sam wyciągnę konsekwencje.', e: { fed: 2, fans: 1, pl: -2 } },
  ] },
  { ctx: 'loss_big', q: 'Bolesna porażka {S}. Jak wytłumaczy pan kibicom taki wynik?', a: [
    { t: 'Mogę tylko przeprosić. Wszyscy zawiedliśmy, z trenerem na czele.', e: { fans: 3, media: 2, fed: 1 } },
    { t: 'To jeden zły dzień. Nie będę robił z tego tragedii.', e: { fans: -3, media: -2 } },
    { t: 'Część zawodników nie jest gotowa na grę na tym poziomie. Będą zmiany.', e: { pl: -5, fans: 2, media: 1 } },
  ] },
  { ctx: 'upset_win', q: 'Mało kto wierzył w wygraną. Rywal ({O}) był zdecydowanym faworytem. Jak pan to skomentuje?', a: [
    { t: 'Ja wierzyłem od początku. Ta drużyna ma ogromny potencjał.', e: { pl: 3, fans: 2 } },
    { t: 'Wiedzieliśmy, że możemy ich zaskoczyć. Plan zadziałał idealnie.', e: { media: 2, fed: 2 } },
    { t: 'Szczerze mówiąc, sam jestem zaskoczony.', e: { media: 1, pl: -1, fans: -1 } },
  ] },
  { ctx: 'shock_loss', q: 'Porażka z teoretycznie dużo słabszym rywalem. To kompromitacja?', a: [
    { t: 'To słowo jest zbyt mocne. W piłce nie ma już łatwych meczów.', e: { media: -1, fed: 1 } },
    { t: 'Tak, to kompromitacja. Biorę za nią pełną odpowiedzialność.', e: { fans: 2, media: 2, fed: -1 } },
    { t: 'Zlekceważyliśmy przeciwnika. Niektórzy myśleli, że wygrają samą obecnością.', e: { pl: -4, fans: 1 } },
  ] },
  { ctx: 'hero', q: '{P} był dziś bohaterem drużyny. Jak ocenia pan jego występ?', a: [
    { t: 'Klasa światowa. To piłkarz, wokół którego budujemy zespół.', e: { star: 8, pl: -1, fans: 1 } },
    { t: 'Zagrał bardzo dobrze, ale sukces to zasługa całego zespołu.', e: { star: 3, pl: 2, media: 1 } },
    { t: 'Zrobił to, czego od niego oczekuję. Nic więcej.', e: { star: -3, media: 1 } },
  ] },
  { ctx: 'star_poor', q: '{P} zagrał dziś poniżej oczekiwań. Czy rozważa pan zmiany w składzie?', a: [
    { t: 'Każdy ma słabszy dzień. Ten zawodnik ma moje pełne zaufanie.', e: { star: 5, pl: 1, fans: -1 } },
    { t: 'Zobaczymy. O składzie decyduje forma, a nie nazwisko.', e: { star: -2, media: 2, fans: 1 } },
    { t: 'Tak. Taki występ nie może pozostać bez konsekwencji.', e: { star: -8, pl: -2, fans: 1 } },
  ] },
  { ctx: 'debut', q: 'Debiut w kadrze zaliczył {P}. Czy to przyszłość reprezentacji?', a: [
    { t: 'Zdecydowanie. To ogromny talent i będzie dostawał kolejne szanse.', e: { star: 6, fans: 2, pl: -1 } },
    { t: 'Jest na dobrej drodze, ale musi jeszcze dużo pracować.', e: { star: 2, media: 1 } },
    { t: 'Za wcześnie na takie oceny. Nie róbmy z niego gwiazdy po jednym meczu.', e: { star: -1, media: 2 } },
  ] },
  { ctx: 'red', q: 'Czerwona kartka mocno skomplikowała sytuację. Jak ocenia pan decyzję sędziego?', a: [
    { t: 'Sędzia się pomylił. To była zupełnie normalna walka o piłkę.', e: { pl: 2, media: -2, fed: -2 } },
    { t: 'Decyzja była słuszna. Musimy zachować więcej dyscypliny.', e: { media: 2, fed: 1, pl: -1 } },
    { t: 'Nie będę komentował pracy sędziów.', e: { media: -1 } },
  ] },
  { ctx: 'gk_hero', q: 'Bramkarz {P} zaliczył kilka świetnych interwencji. Uratował zespół?', a: [
    { t: 'Bez dwóch zdań. To był jego mecz.', e: { star: 6, fans: 1 } },
    { t: 'Bramkarz jest od tego, żeby bronić. Cieszę się, że stanął na wysokości zadania.', e: { star: 2, media: 1 } },
    { t: 'Nie powinniśmy pozwalać rywalowi na tyle sytuacji. To duży problem.', e: { pl: -2, media: 2 } },
  ] },
  { ctx: 'qualified', q: 'Awans stał się faktem! Jakie emocje panu towarzyszą?', a: [
    { t: 'Ogromna radość. Ta drużyna zasłużyła na ten sukces.', e: { pl: 3, fans: 3 } },
    { t: 'Radość, ale też świadomość, że teraz zaczyna się prawdziwa praca.', e: { media: 2, fed: 2 } },
    { t: 'To był nasz obowiązek. Nie ma co świętować.', e: { fans: -2, pl: -2, fed: 1 } },
  ] },
  { ctx: 'eliminated', q: 'To koniec marzeń. Co dalej z pańską przyszłością?', a: [
    { t: 'Zostaję i chcę zbudować drużynę na kolejne wyzwania.', e: { fed: 1, pl: 1, fans: -1 } },
    { t: 'Decyzja należy do federacji. Usiądziemy i porozmawiamy.', e: { media: 2, fed: 2 } },
    { t: 'Biorę na siebie całą winę. Przepraszam kibiców.', e: { fans: 3, media: 1, fed: -1 } },
  ] },
  { ctx: 'title', q: 'Jesteście mistrzami! Komu dedykuje pan ten triumf?', a: [
    { t: 'Kibicom, byli z nami w najtrudniejszych chwilach.', e: { fans: 4, media: 1 } },
    { t: 'Zawodnikom. To oni wykonali całą robotę.', e: { pl: 4 } },
    { t: 'Federacji, za zaufanie i świetne warunki do pracy.', e: { fed: 4 } },
  ] },
  // ---------- przed meczem ----------
  { ctx: 'pre_strong', q: 'Najbliższy rywal ({O}) jest faworytem. Na co stać pańską drużynę?', a: [
    { t: 'Jedziemy po zwycięstwo. Nikogo się nie boimy.', e: { fans: 2, pl: 2, media: -1 } },
    { t: 'Zagramy mądrze i będziemy szukać swoich szans.', e: { media: 2, fed: 1 } },
    { t: 'Remis byłby dla nas bardzo dobrym wynikiem.', e: { fans: -2, pl: -1, media: 1 } },
  ] },
  { ctx: 'pre_weak', q: 'Wszyscy oczekują pewnego zwycięstwa. Czuje pan presję?', a: [
    { t: 'Nie. Jesteśmy faworytem i wygramy wysoko.', e: { fans: 2, media: -1 } },
    { t: 'W reprezentacji presja jest zawsze. Podejdziemy do rywala z pełnym szacunkiem.', e: { media: 2, fed: 1 } },
    { t: 'Łatwych meczów nie ma. Każdy wynik jest możliwy.', e: { fans: -1, media: 1 } },
  ] },
  { ctx: 'pre_even', q: 'Zapowiada się wyrównany mecz. Jaki wynik pana zadowoli?', a: [
    { t: 'Tylko zwycięstwo. Gramy o pełną pulę.', e: { fans: 2, pl: 1 } },
    { t: 'Chcę zobaczyć dobrą grę, wynik będzie jej konsekwencją.', e: { media: 2 } },
    { t: 'Każdy punkt będzie na wagę złota.', e: { media: 1, fed: 1, fans: -1 } },
  ] },
  // ---------- telefony dziennikarzy ----------
  { ctx: 'call_star', q: 'Wielu kibiców uważa, że {P} to lider tej kadry. Podziela pan tę opinię?', a: [
    { t: 'Oczywiście. Bez niego nasza gra wygląda zupełnie inaczej.', e: { star: 6, pl: -2 } },
    { t: 'To ważny zawodnik, ale nasza siła tkwi w drużynie.', e: { star: 1, pl: 2, media: 1 } },
    { t: 'Nie. Mam w kadrze kilku piłkarzy równie ważnych.', e: { star: -6, pl: 1 } },
  ] },
  { ctx: 'call_young', q: 'Coraz głośniej mówi się o talencie, jakim jest {P}. Dostanie szansę w kadrze?', a: [
    { t: 'Bacznie go obserwuję. Drzwi do reprezentacji są dla niego otwarte.', e: { star: 4, fans: 2 } },
    { t: 'Musi jeszcze trochę poczekać i nabrać doświadczenia.', e: { star: -1, media: 1 } },
    { t: 'Na razie nie widzę go w swoich planach.', e: { star: -5, fans: -2 } },
  ] },
  { ctx: 'call_plans', q: 'Co chce pan zmienić w grze zespołu w najbliższych miesiącach?', a: [
    { t: 'Chcę, żebyśmy grali odważniej i częściej atakowali.', e: { fans: 2, media: 1 } },
    { t: 'Przede wszystkim poprawić organizację gry w obronie.', e: { fed: 2, media: 1 } },
    { t: 'Szykuję sporo zmian personalnych. Nikt nie może być pewny miejsca.', e: { pl: -3, media: 2, fans: 1 } },
  ] },
  { ctx: 'call_bad', q: 'Ostatnie wyniki są rozczarowujące. Czy szatnia wciąż za panem stoi?', a: [
    { t: 'Absolutnie. Atmosfera w zespole jest bardzo dobra.', e: { pl: 1, media: -1 } },
    { t: 'Mamy trudny moment, ale wspólnie z niego wyjdziemy.', e: { pl: 2, media: 1 } },
    { t: 'Kto nie wierzy w mój plan, może zostać w domu.', e: { pl: -5, fans: 1, media: 1 } },
  ] },
  { ctx: 'call_good', q: 'Dobre wyniki sprawiają, że kibice zaczynają marzyć. Gdzie jest sufit tej drużyny?', a: [
    { t: 'Stać nas na walkę o najwyższe cele.', e: { fans: 3, pl: 1, media: -1 } },
    { t: 'Skupiamy się na najbliższym meczu, a nie na marzeniach.', e: { media: 2, fed: 1 } },
    { t: 'Nie przesadzajmy. Wciąż sporo brakuje nam do czołówki.', e: { fans: -2, pl: -1 } },
  ] },
  { ctx: 'call_fed', q: 'Jak układa się pańska współpraca z władzami federacji?', a: [
    { t: 'Wzorowo. Mam pełne wsparcie prezesa.', e: { fed: 3, media: -1 } },
    { t: 'Dobrze, choć czasem przydałoby się więcej wsparcia.', e: { fed: -1, pl: 1, media: 1 } },
    { t: 'Wolę o tym nie mówić publicznie.', e: { fed: -2, media: -1 } },
  ] },
  { ctx: 'call_fans', q: 'Kibice narzekają na styl gry kadry. Co pan im odpowie?', a: [
    { t: 'Rozumiem ich. Będziemy grać bardziej ofensywnie.', e: { fans: 3, fed: -1 } },
    { t: 'Liczy się skuteczność. Styl przyjdzie z czasem.', e: { fed: 2, fans: -1 } },
    { t: 'Kibice nie widzą tego, co my widzimy na treningach.', e: { fans: -3, pl: 1 } },
  ] },
  { ctx: 'call_club', q: '{P} rzadko gra w swoim klubie. Czy to problem dla reprezentacji?', a: [
    { t: 'Tak. Bez regularnej gry trudno o miejsce w kadrze.', e: { star: -4, media: 2, fans: 1 } },
    { t: 'To doświadczony zawodnik, wierzę, że szybko odzyska rytm.', e: { star: 4, pl: 1 } },
    { t: 'Rozmawiałem z nim. Być może powinien pomyśleć o zmianie klubu.', e: { star: 1, media: 1 } },
  ] },
  { ctx: 'call_rival', q: 'Szkoleniowiec najbliższego rywala ({O}) twierdzi, że pańska drużyna jest przereklamowana. Odpowie pan?', a: [
    { t: 'Odpowiemy na boisku.', e: { pl: 2, fans: 2 } },
    { t: 'Każdy ma prawo do opinii. Szanuję go.', e: { media: 2, fed: 1 } },
    { t: 'Niech lepiej zajmie się swoimi problemami.', e: { fans: 1, media: -2, fed: -1 } },
  ] },
];

/** Rozmowy indywidualne z zawodnikiem. */
export const TALKS = [
  { id: 'praise', t: 'Pochwal za ostatnie występy' },
  { id: 'motivate', t: 'Zmotywuj do cięższej pracy' },
  { id: 'promise', t: 'Obiecaj miejsce w wyjściowym składzie' },
  { id: 'criticize', t: 'Skrytykuj za słabą formę' },
  { id: 'club', t: 'Zapytaj o sytuację w klubie' },
];
