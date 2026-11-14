# Selekcjoner ⚽

Gra menedżerska na telefon: zostań selekcjonerem reprezentacji narodowej i poprowadź ją przez Ligę Narodów, eliminacje oraz turnieje finałowe (mistrzostwa kontynentów i świata).

Gra ma **własną oprawę graficzną** (ciemny motyw „nocny stadion”, własne ikony, proceduralne awatary) i **fikcyjnych zawodników** (nazwiska generowane losowo; w edytorze można je zmienić).

## Co jest w grze

- **119 reprezentacji** z 6 kontynentów, ok. 4500 fikcyjnych zawodników z atrybutami, formą, kondycją, morale, klubami i potencjałem.
- **Kalendarz w cyklu dwuletnim**: Liga Narodów (dywizje, turniej finałowy), eliminacje, turnieje finałowe z losowaniem grup i fazą pucharową, mecze towarzyskie.
- **Powołania** przed każdym zgrupowaniem (23 zawodników, na turniej 26), kontuzje, zawieszenia za kartki, kadra U-21 z własnymi meczami.
- **Taktyka**: 10 formacji, styl gry, pressing, gra na czas, pułapki ofsajdowe, polecenia indywidualne (strzały, drybling, podania, odbiór, symulowanie), wykonawcy stałych fragmentów, kapitan, zawodnicy w polu karnym.
- **Trening** – rozdzielanie punktów między 6 obszarów; poziom wytrenowania wpływa na mecze.
- **Mecz na żywo na animowanym boisku 2D**: 22 zawodników w barwach reprezentacji, piłka z wysokością lotu, sędzia i sędziowie liniowi. Drużyny trzymają ustawienie z wybranej formacji i reagują na piłkę i taktykę (linia obrony, pressing, krycie, linia spalonego). Każda akcja z silnika meczu ma własną choreografię: podania, prostopadłe piłki, drybling, kontry, odbiory i wślizgi, strzały z wynikiem zgodnym z silnikiem (gol, parada, słupek, pudło), rzuty rożne i wolne z murem, karne, spalone, kartki, kontuzje i zmiany. **Polski komentarz pojawia się dokładnie w chwili akcji** i opisuje to, co robią zawodnicy. Tempo ½×–4×, widok całego boiska albo kamera przy piłce, dźwięki (gwizdek, uderzenia, trybuny), zmiany i korekty taktyki w trakcie, dogrywki i seria rzutów karnych; statystyki i oceny zawodników.
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
  js/ui/              interfejs (mini-framework, ekrany, dźwięk)
  js/ui/pitch2d.js    animowany mecz 2D: zachowanie drużyn i choreografia akcji
  js/ui/pitch2d-draw.js  rysowanie boiska, zawodników, piłki i efektów (canvas)
android/              projekt Capacitor (Android)
tools/                testy i narzędzia (symulacja sezonów, kalibracja meczu, test UI, ikony)
```

## Testy

```bash
node tools/sim-test.mjs POL 6     # symulacja 6 lat kariery bez interfejsu
node tools/calib.mjs              # kalibracja silnika meczu (statystyki tysięcy meczów)
node tools/anim-test.mjs 24       # mecze przez animację 2D: komentarz 1:1 z akcjami, bez zawieszeń
node tools/ui-test.mjs URL DIR    # test interfejsu w przeglądarce (Playwright) ze zrzutami
node tools/device-test.mjs DIR    # test na urządzeniu z Androidem (adb + WebView)
```
