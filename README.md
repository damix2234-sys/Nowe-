# Selekcjoner ⚽

Gra menedżerska na telefon: zostań selekcjonerem reprezentacji narodowej i poprowadź ją przez Ligę Narodów, eliminacje oraz turnieje finałowe (mistrzostwa kontynentów i świata).

Gra ma **własną oprawę graficzną** (ciemny motyw „nocny stadion”, własne ikony, proceduralne awatary) i **fikcyjnych zawodników** (nazwiska generowane losowo; w edytorze można je zmienić).

## Co jest w grze

- **119 reprezentacji** z 6 kontynentów, ok. 4500 fikcyjnych zawodników z atrybutami, formą, kondycją, morale, klubami i potencjałem.
- **Kalendarz w cyklu dwuletnim**: Liga Narodów (dywizje, turniej finałowy), eliminacje, turnieje finałowe z losowaniem grup i fazą pucharową, mecze towarzyskie.
- **Powołania** przed każdym zgrupowaniem (23 zawodników, na turniej 26), kontuzje, zawieszenia za kartki, kadra U-21 z własnymi meczami.
- **Taktyka**: 10 formacji, styl gry, pressing, gra na czas, pułapki ofsajdowe, polecenia indywidualne (strzały, drybling, podania, odbiór, symulowanie), wykonawcy stałych fragmentów, kapitan, zawodnicy w polu karnym.
- **Trening** – rozdzielanie punktów między 6 obszarów; poziom wytrenowania wpływa na mecze.
- **Mecz na żywo, w którym zawodnicy grają sami**: na boisku 2D jest 22 zawodników i piłka z fizyką (lot, odbicia, toczenie). Każdy zawodnik sam decyduje, co zrobić (podanie, prostopadła piłka, prowadzenie, drybling, dośrodkowanie, strzał, wybicie), drużyny trzymają ustawienie z formacji, pressują, kryją, odcinają podania i wybiegają za linię obrony. **Wynik każdej akcji rozstrzyga pojedynek umiejętności**: Strzały + Technika + Opanowanie przeciw Bramkarstwu, Drybling przeciw Odbiorowi, Podania przeciw Kryciu, Gra głową + Siła w powietrzu, Szybkość w wyścigach do piłki, Wyjścia bramkarza przy dośrodkowaniach. Stałe fragmenty powstają wyłącznie z prawdziwych sytuacji (piłka za linią, faul, spalony), bez przeskoków czasu i teleportów. **Komentator opisuje to, co faktycznie wydarzyło się na boisku.** Umiejętności w meczu zależą od **formy** (najwyższa – premia, przeciętna – bez zmian, słaba – kara), **oceny na żywo** (od 7,0 premia, poniżej 6,3 kara i więcej błędów) i **zmęczenia** (Kondycja). Tempo ½×–4×, widok całego boiska albo kamera przy piłce, dźwięki, zmiany (przy najbliższej przerwie w grze) i taktyka w trakcie, oceny i świeżość zawodników na żywo, dogrywki i seria rzutów karnych.
- **Zaufanie** federacji, kibiców, piłkarzy i mediów; **konferencje prasowe** i telefony od dziennikarzy; rozmowy z zawodnikami.
- **Cele federacji**, kontrakty, zwolnienia, **oferty pracy** od innych reprezentacji, reputacja trenera.
- **Ranking światowy** (system punktowy), statystyki kariery, osiągnięcia, zapis gry (3 sloty + autozapis).
- **Edytor zawodników** z eksportem/importem (np. żeby wpisać prawdziwe nazwiska).

## Jak uruchomić

### Na telefonie z Androidem (APK)
Każdy push buduje plik APK w GitHub Actions:
1. Zakładka **Actions** → workflow **Android APK** → ostatnie uruchomienie.
2. Na dole strony, w sekcji **Artifacts**, pobierz `selekcjoner-apk` (plik ZIP z `selekcjoner-debug.apk`).
3. Rozpakuj i zainstaluj APK na telefonie (trzeba zezwolić na instalację z nieznanych źródeł).

### Test na telefonie z Androidem (emulator w GitHub Actions)
Workflow **Test na emulatorze Androida** przy każdym pushu buduje APK, uruchamia emulator Androida 15 (Pixel 6), instaluje aplikację i przechodzi grę: nowa kariera, systemowy przycisk wstecz, powrót z tła, mecz na żywo z animacją 2D, podsumowanie. Zrzuty ekranu z urządzenia i raport (`report.json`, `logcat.txt`) są w artefakcie `zrzuty-z-telefonu`. Ten sam skrypt działa z prawdziwym telefonem podłączonym przez adb:
```bash
npm i --no-save playwright-core
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
node tools/device-test.mjs wyniki
```

### W przeglądarce (także jako aplikacja na ekranie głównym)
```bash
npm run serve        # http://localhost:8080
```
Gra działa offline (service worker) i można ją dodać do ekranu głównego telefonu. Wersję online można opublikować na GitHub Pages: Settings → Pages → Source: *GitHub Actions*, a potem Actions → **Wersja przeglądarkowa** → *Run workflow*.

### Lokalne budowanie APK (Android Studio)
```bash
npm install
npx cap sync android
npx cap open android   # lub: cd android && ./gradlew assembleDebug
```

## Struktura projektu

```
www/                  aplikacja (HTML/CSS/JS, bez bundlera)
  js/core/            narzędzia, zapis (IndexedDB)
  js/data/            reprezentacje, pule nazwisk, komentarz, pytania prasowe, osiągnięcia
  js/engine/          silnik: zawodnicy, generator świata, taktyka, mecz, rozgrywki, ranking, stan gry
  js/engine/sim.js    mecz na żywo: zawodnicy-agenci, fizyka piłki, pojedynki umiejętności, stałe fragmenty
  js/engine/narrator.js  komentator opisujący zdarzenia z boiska
  js/engine/match.js  szybki silnik statystyczny (mecze innych reprezentacji)
  js/ui/              interfejs (mini-framework, ekrany, dźwięk)
  js/ui/pitch2d.js    widok meczu 2D: tempo, kamera, efekty
  js/ui/pitch2d-draw.js  rysowanie boiska, zawodników, piłki i efektów (canvas)
android/              projekt Capacitor (Android)
tools/                testy i narzędzia (symulacja sezonów, kalibracja meczu, test UI, ikony)
```

## Testy

```bash
node tools/sim-test.mjs POL 6     # symulacja 6 lat kariery bez interfejsu
node tools/calib.mjs              # kalibracja silnika meczu (statystyki tysięcy meczów)
node tools/live-test.mjs 20       # mecz na żywo bez rysowania: statystyki, przewaga lepszych, oceny
node tools/view-test.mjs 6        # widok 2D: bez teleportów, stałe fragmenty tylko po wyjściu piłki, komentarz po kolei
node tools/ui-test.mjs URL DIR    # test interfejsu w przeglądarce (Playwright) ze zrzutami
node tools/device-test.mjs DIR    # test na urządzeniu z Androidem (adb + WebView)
```
