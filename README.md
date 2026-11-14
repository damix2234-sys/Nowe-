# Selekcjoner ⚽

Gra menedżerska na telefon: zostań selekcjonerem reprezentacji narodowej i poprowadź ją przez Ligę Narodów, eliminacje oraz turnieje finałowe (mistrzostwa kontynentów i świata).

Gra ma **własną oprawę graficzną** (ciemny motyw „nocny stadion”, własne ikony, proceduralne awatary) i **fikcyjnych zawodników** (nazwiska generowane losowo; w edytorze można je zmienić).

## Co jest w grze

- **119 reprezentacji** z 6 kontynentów, ok. 4500 fikcyjnych zawodników z atrybutami, formą, kondycją, morale, klubami i potencjałem.
- **Kalendarz w cyklu dwuletnim**: Liga Narodów (dywizje, turniej finałowy), eliminacje, turnieje finałowe z losowaniem grup i fazą pucharową, mecze towarzyskie.
- **Powołania** przed każdym zgrupowaniem (23 zawodników, na turniej 26), kontuzje, zawieszenia za kartki, kadra U-21 z własnymi meczami.
- **Taktyka**: 10 formacji, styl gry, pressing, gra na czas, pułapki ofsajdowe, polecenia indywidualne (strzały, drybling, podania, odbiór, symulowanie), wykonawcy stałych fragmentów, kapitan, zawodnicy w polu karnym.
- **Trening** – rozdzielanie punktów między 6 obszarów; poziom wytrenowania wpływa na mecze.
- **Mecz na żywo** minuta po minucie z polskim komentarzem: zmiany, korekty taktyki, przerwy, dogrywki i rzuty karne; statystyki i oceny zawodników.
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
  js/ui/              interfejs (mini-framework, ekrany)
android/              projekt Capacitor (Android)
tools/                testy i narzędzia (symulacja sezonów, kalibracja meczu, test UI, ikony)
```

## Testy

```bash
node tools/sim-test.mjs POL 6     # symulacja 6 lat kariery bez interfejsu
node tools/calib.mjs              # kalibracja silnika meczu (statystyki tysięcy meczów)
node tools/ui-test.mjs URL DIR    # test interfejsu w przeglądarce (Playwright) ze zrzutami
```
