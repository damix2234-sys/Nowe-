// Reprezentacje narodowe. str = ogólna siła kadry (0-100), pool = pula imion/nazwisk.
// pool może być obiektem z wagami, np. {fr: 0.7, afr_fr: 0.3}.

export const CONFS = {
  EU: { name: 'Europa', short: 'EU' },
  SA: { name: 'Ameryka Południowa', short: 'AmP' },
  NA: { name: 'Ameryka Północna', short: 'AmN' },
  AF: { name: 'Afryka', short: 'AF' },
  AS: { name: 'Azja', short: 'AZ' },
  OC: { name: 'Oceania', short: 'OC' },
};
export const CONF_ORDER = ['EU', 'SA', 'NA', 'AF', 'AS', 'OC'];

const N = (id, name, flag, conf, str, pool, cities) => ({ id, name, flag, conf, str, pool, cities });

export const NATIONS = [
  // ---------------- Europa ----------------
  N('ALB', 'Albania', '🇦🇱', 'EU', 66, 'al', ['Tirana', 'Durrës', 'Szkodra', 'Elbasan']),
  N('AND', 'Andora', '🇦🇩', 'EU', 41, 'es', ['Andora', 'Escaldes']),
  N('ARM', 'Armenia', '🇦🇲', 'EU', 59, 'hy', ['Erywań', 'Giumri']),
  N('AUT', 'Austria', '🇦🇹', 'EU', 75, 'de', ['Wiedeń', 'Salzburg', 'Graz', 'Linz', 'Innsbruck']),
  N('AZE', 'Azerbejdżan', '🇦🇿', 'EU', 57, 'az', ['Baku', 'Gandża']),
  N('BLR', 'Białoruś', '🇧🇾', 'EU', 57, 'ru', ['Mińsk', 'Borysów', 'Grodno', 'Brześć']),
  N('BEL', 'Belgia', '🇧🇪', 'EU', 81, { nl: 0.5, fr: 0.3, afr_fr: 0.2 }, ['Bruksela', 'Antwerpia', 'Gandawa', 'Brugia', 'Liège']),
  N('BIH', 'Bośnia i Hercegowina', '🇧🇦', 'EU', 66, 'yu', ['Sarajewo', 'Zenica', 'Mostar', 'Banja Luka']),
  N('BUL', 'Bułgaria', '🇧🇬', 'EU', 60, 'bg', ['Sofia', 'Płowdiw', 'Warna', 'Burgas']),
  N('CRO', 'Chorwacja', '🇭🇷', 'EU', 79, 'yu', ['Zagrzeb', 'Split', 'Rijeka', 'Osijek']),
  N('CYP', 'Cypr', '🇨🇾', 'EU', 55, 'gr', ['Nikozja', 'Limassol', 'Larnaka']),
  N('CZE', 'Czechy', '🇨🇿', 'EU', 71, 'cs', ['Praga', 'Brno', 'Ostrawa', 'Pilzno', 'Liberec']),
  N('DEN', 'Dania', '🇩🇰', 'EU', 77, 'nord', ['Kopenhaga', 'Aarhus', 'Odense', 'Aalborg']),
  N('ENG', 'Anglia', '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}', 'EU', 87, { en: 0.8, car: 0.2 }, ['Londyn', 'Manchester', 'Liverpool', 'Birmingham', 'Leeds', 'Newcastle']),
  N('EST', 'Estonia', '🇪🇪', 'EU', 53, 'ee', ['Tallinn', 'Tartu', 'Parnawa']),
  N('FRO', 'Wyspy Owcze', '🇫🇴', 'EU', 51, 'nord', ['Tórshavn', 'Klaksvík']),
  N('FIN', 'Finlandia', '🇫🇮', 'EU', 63, 'fi', ['Helsinki', 'Tampere', 'Turku']),
  N('FRA', 'Francja', '🇫🇷', 'EU', 88, { fr: 0.55, afr_fr: 0.35, ar: 0.1 }, ['Paryż', 'Marsylia', 'Lyon', 'Lille', 'Bordeaux', 'Nicea']),
  N('GEO', 'Gruzja', '🇬🇪', 'EU', 69, 'ka', ['Tbilisi', 'Batumi', 'Kutaisi']),
  N('GER', 'Niemcy', '🇩🇪', 'EU', 84, { de: 0.8, tr: 0.1, afr_fr: 0.1 }, ['Berlin', 'Monachium', 'Dortmund', 'Hamburg', 'Kolonia', 'Frankfurt', 'Stuttgart']),
  N('GIB', 'Gibraltar', '🇬🇮', 'EU', 37, 'en', ['Gibraltar']),
  N('GRE', 'Grecja', '🇬🇷', 'EU', 70, 'gr', ['Ateny', 'Saloniki', 'Pireus', 'Heraklion']),
  N('HUN', 'Węgry', '🇭🇺', 'EU', 71, 'hu', ['Budapeszt', 'Debreczyn', 'Szeged', 'Győr']),
  N('ISL', 'Islandia', '🇮🇸', 'EU', 63, 'is', ['Reykjavík', 'Akureyri']),
  N('IRL', 'Irlandia', '🇮🇪', 'EU', 66, 'ie', ['Dublin', 'Cork', 'Limerick', 'Galway']),
  N('ISR', 'Izrael', '🇮🇱', 'EU', 64, 'he', ['Tel Awiw', 'Jerozolima', 'Hajfa', 'Beer Szewa']),
  N('ITA', 'Włochy', '🇮🇹', 'EU', 82, 'it', ['Rzym', 'Mediolan', 'Turyn', 'Neapol', 'Florencja', 'Bolonia']),
  N('KAZ', 'Kazachstan', '🇰🇿', 'EU', 58, { kz: 0.7, ru: 0.3 }, ['Astana', 'Ałmaty', 'Szymkent']),
  N('KOS', 'Kosowo', '🇽🇰', 'EU', 62, 'al', ['Prisztina', 'Prizren', 'Mitrowica']),
  N('LVA', 'Łotwa', '🇱🇻', 'EU', 52, 'lv', ['Ryga', 'Lipawa', 'Dyneburg']),
  N('LIE', 'Liechtenstein', '🇱🇮', 'EU', 40, 'de', ['Vaduz', 'Eschen']),
  N('LTU', 'Litwa', '🇱🇹', 'EU', 52, 'lt', ['Wilno', 'Kowno', 'Kłajpeda']),
  N('LUX', 'Luksemburg', '🇱🇺', 'EU', 57, { fr: 0.4, de: 0.35, pt: 0.25 }, ['Luksemburg', 'Esch-sur-Alzette']),
  N('MLT', 'Malta', '🇲🇹', 'EU', 47, 'mt', ['Valletta', 'Birkirkara']),
  N('MDA', 'Mołdawia', '🇲🇩', 'EU', 50, 'ro', ['Kiszyniów', 'Bielce', 'Tyraspol']),
  N('MNE', 'Czarnogóra', '🇲🇪', 'EU', 63, 'yu', ['Podgorica', 'Nikšić']),
  N('NED', 'Holandia', '🇳🇱', 'EU', 83, { nl: 0.75, car: 0.15, afr_fr: 0.1 }, ['Amsterdam', 'Rotterdam', 'Eindhoven', 'Haga', 'Utrecht']),
  N('MKD', 'Macedonia Północna', '🇲🇰', 'EU', 63, 'mk', ['Skopje', 'Bitola', 'Tetowo']),
  N('NIR', 'Irlandia Północna', '🇬🇧', 'EU', 62, { ie: 0.5, en: 0.5 }, ['Belfast', 'Derry', 'Lurgan']),
  N('NOR', 'Norwegia', '🇳🇴', 'EU', 74, 'nord', ['Oslo', 'Bergen', 'Trondheim', 'Stavanger']),
  N('POL', 'Polska', '🇵🇱', 'EU', 73, 'pl', ['Warszawa', 'Chorzów', 'Wrocław', 'Gdańsk', 'Poznań', 'Kraków']),
  N('POR', 'Portugalia', '🇵🇹', 'EU', 85, { pt: 0.9, ao: 0.1 }, ['Lizbona', 'Porto', 'Braga', 'Coimbra', 'Faro']),
  N('ROU', 'Rumunia', '🇷🇴', 'EU', 69, 'ro', ['Bukareszt', 'Kluż-Napoka', 'Konstanca', 'Jassy']),
  N('RUS', 'Rosja', '🇷🇺', 'EU', 72, 'ru', ['Moskwa', 'Petersburg', 'Kazań', 'Soczi', 'Rostów']),
  N('SMR', 'San Marino', '🇸🇲', 'EU', 32, 'it', ['Serravalle', 'San Marino']),
  N('SCO', 'Szkocja', '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}', 'EU', 70, 'sco', ['Glasgow', 'Edynburg', 'Aberdeen', 'Dundee']),
  N('SRB', 'Serbia', '🇷🇸', 'EU', 73, 'yu', ['Belgrad', 'Nowy Sad', 'Nisz', 'Kragujevac']),
  N('SVK', 'Słowacja', '🇸🇰', 'EU', 69, 'cs', ['Bratysława', 'Trnawa', 'Żylina', 'Koszyce']),
  N('SVN', 'Słowenia', '🇸🇮', 'EU', 68, 'yu', ['Lublana', 'Maribor', 'Celje']),
  N('ESP', 'Hiszpania', '🇪🇸', 'EU', 88, 'es', ['Madryt', 'Barcelona', 'Sewilla', 'Walencja', 'Bilbao', 'Malaga']),
  N('SWE', 'Szwecja', '🇸🇪', 'EU', 72, { nord: 0.8, yu: 0.1, ar: 0.1 }, ['Sztokholm', 'Göteborg', 'Malmö', 'Solna']),
  N('SUI', 'Szwajcaria', '🇨🇭', 'EU', 76, { de: 0.5, fr: 0.2, it: 0.1, al: 0.2 }, ['Berno', 'Zurych', 'Bazylea', 'Genewa', 'Lozanna']),
  N('TUR', 'Turcja', '🇹🇷', 'EU', 75, 'tr', ['Stambuł', 'Ankara', 'Izmir', 'Bursa', 'Trabzon']),
  N('UKR', 'Ukraina', '🇺🇦', 'EU', 73, 'ua', ['Kijów', 'Lwów', 'Charków', 'Dniepr', 'Odessa']),
  N('WAL', 'Walia', '🏴\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}', 'EU', 68, 'wal', ['Cardiff', 'Swansea', 'Wrexham']),

  // ---------------- Ameryka Południowa ----------------
  N('ARG', 'Argentyna', '🇦🇷', 'SA', 88, 'la', ['Buenos Aires', 'Córdoba', 'Rosario', 'La Plata', 'Mendoza']),
  N('BOL', 'Boliwia', '🇧🇴', 'SA', 61, 'la', ['La Paz', 'Santa Cruz', 'Cochabamba']),
  N('BRA', 'Brazylia', '🇧🇷', 'SA', 87, 'br', ['Rio de Janeiro', 'São Paulo', 'Belo Horizonte', 'Porto Alegre', 'Salvador']),
  N('CHI', 'Chile', '🇨🇱', 'SA', 72, 'la', ['Santiago', 'Valparaíso', 'Concepción']),
  N('COL', 'Kolumbia', '🇨🇴', 'SA', 80, 'la', ['Bogota', 'Medellín', 'Barranquilla', 'Cali']),
  N('ECU', 'Ekwador', '🇪🇨', 'SA', 77, 'la', ['Quito', 'Guayaquil', 'Cuenca']),
  N('PAR', 'Paragwaj', '🇵🇾', 'SA', 73, 'la', ['Asunción', 'Ciudad del Este', 'Encarnación']),
  N('PER', 'Peru', '🇵🇪', 'SA', 70, 'la', ['Lima', 'Arequipa', 'Cusco']),
  N('URU', 'Urugwaj', '🇺🇾', 'SA', 81, 'la', ['Montevideo', 'Maldonado', 'Salto']),
  N('VEN', 'Wenezuela', '🇻🇪', 'SA', 70, 'la', ['Caracas', 'Maracaibo', 'Barquisimeto']),

  // ---------------- Ameryka Północna ----------------
  N('USA', 'Stany Zjednoczone', '🇺🇸', 'NA', 77, { en: 0.65, la: 0.2, car: 0.15 }, ['Nowy Jork', 'Los Angeles', 'Chicago', 'Atlanta', 'Dallas', 'Seattle']),
  N('MEX', 'Meksyk', '🇲🇽', 'NA', 76, 'la', ['Meksyk', 'Guadalajara', 'Monterrey', 'Puebla']),
  N('CAN', 'Kanada', '🇨🇦', 'NA', 74, { en: 0.55, fr: 0.2, car: 0.25 }, ['Toronto', 'Vancouver', 'Montreal', 'Edmonton']),
  N('CRC', 'Kostaryka', '🇨🇷', 'NA', 66, 'la', ['San José', 'Alajuela', 'Heredia']),
  N('PAN', 'Panama', '🇵🇦', 'NA', 66, 'la', ['Panama', 'Colón']),
  N('JAM', 'Jamajka', '🇯🇲', 'NA', 64, 'car', ['Kingston', 'Montego Bay']),
  N('HON', 'Honduras', '🇭🇳', 'NA', 62, 'la', ['Tegucigalpa', 'San Pedro Sula']),
  N('SLV', 'Salwador', '🇸🇻', 'NA', 57, 'la', ['San Salvador', 'Santa Ana']),
  N('GUA', 'Gwatemala', '🇬🇹', 'NA', 58, 'la', ['Gwatemala', 'Quetzaltenango']),
  N('HAI', 'Haiti', '🇭🇹', 'NA', 56, 'ht', ['Port-au-Prince', 'Cap-Haïtien']),
  N('TRI', 'Trynidad i Tobago', '🇹🇹', 'NA', 56, 'car', ['Port of Spain', 'San Fernando']),
  N('CUW', 'Curaçao', '🇨🇼', 'NA', 58, { nl: 0.5, car: 0.5 }, ['Willemstad']),

  // ---------------- Afryka ----------------
  N('MAR', 'Maroko', '🇲🇦', 'AF', 81, 'ar', ['Rabat', 'Casablanca', 'Marrakesz', 'Tanger', 'Agadir']),
  N('SEN', 'Senegal', '🇸🇳', 'AF', 78, 'afr_fr', ['Dakar', 'Thiès', 'Saint-Louis']),
  N('EGY', 'Egipt', '🇪🇬', 'AF', 74, 'ar', ['Kair', 'Aleksandria', 'Port Said']),
  N('CIV', 'Wybrzeże Kości Słoniowej', '🇨🇮', 'AF', 75, 'afr_fr', ['Abidżan', 'Jamusukro', 'Bouaké']),
  N('NGA', 'Nigeria', '🇳🇬', 'AF', 76, 'afr_en', ['Lagos', 'Abudża', 'Ibadan', 'Kano']),
  N('ALG', 'Algieria', '🇩🇿', 'AF', 74, 'ar', ['Algier', 'Oran', 'Konstantyna']),
  N('TUN', 'Tunezja', '🇹🇳', 'AF', 71, 'ar', ['Tunis', 'Sfaks', 'Susa']),
  N('CMR', 'Kamerun', '🇨🇲', 'AF', 72, 'afr_fr', ['Jaunde', 'Duala', 'Garua']),
  N('GHA', 'Ghana', '🇬🇭', 'AF', 71, 'afr_en', ['Akra', 'Kumasi', 'Tamale']),
  N('MLI', 'Mali', '🇲🇱', 'AF', 72, 'afr_fr', ['Bamako', 'Sikasso']),
  N('BFA', 'Burkina Faso', '🇧🇫', 'AF', 69, 'afr_fr', ['Wagadugu', 'Bobo-Dioulasso']),
  N('RSA', 'RPA', '🇿🇦', 'AF', 69, { afr_en: 0.75, en: 0.25 }, ['Johannesburg', 'Kapsztad', 'Durban', 'Pretoria']),
  N('COD', 'DR Konga', '🇨🇩', 'AF', 70, 'afr_fr', ['Kinszasa', 'Lubumbashi']),
  N('GUI', 'Gwinea', '🇬🇳', 'AF', 67, 'afr_fr', ['Konakri', 'Kankan']),
  N('ZAM', 'Zambia', '🇿🇲', 'AF', 64, 'afr_en', ['Lusaka', 'Ndola']),
  N('GAB', 'Gabon', '🇬🇦', 'AF', 65, 'afr_fr', ['Libreville', 'Franceville']),
  N('ANG', 'Angola', '🇦🇴', 'AF', 63, 'ao', ['Luanda', 'Benguela']),
  N('UGA', 'Uganda', '🇺🇬', 'AF', 61, 'afr_en', ['Kampala', 'Entebbe']),
  N('KEN', 'Kenia', '🇰🇪', 'AF', 58, 'afr_en', ['Nairobi', 'Mombasa']),
  N('CPV', 'Republika Zielonego Przylądka', '🇨🇻', 'AF', 66, 'ao', ['Praia', 'Mindelo']),

  // ---------------- Azja ----------------
  N('JPN', 'Japonia', '🇯🇵', 'AS', 80, 'ja', ['Tokio', 'Osaka', 'Saitama', 'Jokohama', 'Nagoja']),
  N('KOR', 'Korea Południowa', '🇰🇷', 'AS', 77, 'ko', ['Seul', 'Pusan', 'Inczon', 'Daegu']),
  N('IRN', 'Iran', '🇮🇷', 'AS', 75, 'fa', ['Teheran', 'Isfahan', 'Tebriz', 'Szyraz']),
  N('AUS', 'Australia', '🇦🇺', 'AS', 74, { en: 0.75, yu: 0.15, it: 0.1 }, ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide']),
  N('KSA', 'Arabia Saudyjska', '🇸🇦', 'AS', 70, 'ar', ['Rijad', 'Dżudda', 'Dammam']),
  N('QAT', 'Katar', '🇶🇦', 'AS', 67, 'ar', ['Doha', 'Al-Wakra']),
  N('UAE', 'Zjedn. Emiraty Arabskie', '🇦🇪', 'AS', 66, 'ar', ['Abu Zabi', 'Dubaj', 'Al-Ajn']),
  N('IRQ', 'Irak', '🇮🇶', 'AS', 67, 'ar', ['Bagdad', 'Basra', 'Irbil']),
  N('UZB', 'Uzbekistan', '🇺🇿', 'AS', 69, 'uz', ['Taszkent', 'Samarkanda', 'Buchara']),
  N('JOR', 'Jordania', '🇯🇴', 'AS', 66, 'ar', ['Amman', 'Irbid', 'Zarka']),
  N('OMA', 'Oman', '🇴🇲', 'AS', 62, 'ar', ['Maskat', 'Salala']),
  N('CHN', 'Chiny', '🇨🇳', 'AS', 60, 'zh', ['Pekin', 'Szanghaj', 'Kanton', 'Wuhan']),
  N('BHR', 'Bahrajn', '🇧🇭', 'AS', 60, 'ar', ['Manama', 'Rifa']),
  N('SYR', 'Syria', '🇸🇾', 'AS', 60, 'ar', ['Damaszek', 'Aleppo', 'Latakia']),
  N('THA', 'Tajlandia', '🇹🇭', 'AS', 59, 'th', ['Bangkok', 'Chiang Mai', 'Buriram']),
  N('VIE', 'Wietnam', '🇻🇳', 'AS', 58, 'vi', ['Hanoi', 'Ho Chi Minh', 'Hajfong']),
  N('IDN', 'Indonezja', '🇮🇩', 'AS', 60, 'id', ['Dżakarta', 'Surabaja', 'Bandung']),
  N('IND', 'Indie', '🇮🇳', 'AS', 52, 'in', ['Nowe Delhi', 'Kalkuta', 'Bombaj', 'Bengaluru']),

  // ---------------- Oceania ----------------
  N('NZL', 'Nowa Zelandia', '🇳🇿', 'OC', 64, 'en', ['Auckland', 'Wellington', 'Christchurch']),
  N('SOL', 'Wyspy Salomona', '🇸🇧', 'OC', 46, 'pac', ['Honiara']),
  N('FIJ', 'Fidżi', '🇫🇯', 'OC', 44, 'pac', ['Suva', 'Lautoka']),
  N('TAH', 'Tahiti', '🇵🇫', 'OC', 42, 'pac', ['Papeete']),
];

export const NAT = Object.fromEntries(NATIONS.map((n) => [n.id, n]));

/** Ocena gwiazdkowa (0.5-5) na podstawie siły. */
export function starsFor(str) {
  const s = (str - 30) / 12;
  return Math.max(0.5, Math.min(5, Math.round(s * 2) / 2));
}

/** Ligi klubowe, gdzie grają najlepsi zawodnicy. tier: 1 = najmocniejsza liga. */
export const LEAGUES = {
  ENG: { tier: 1, cities: ['Londyn', 'Manchester', 'Liverpool', 'Birmingham', 'Leeds', 'Newcastle', 'Brighton', 'Southampton', 'Bristol', 'Nottingham', 'Leicester', 'Sheffield'], style: 'en' },
  ESP: { tier: 1, cities: ['Madryt', 'Barcelona', 'Sewilla', 'Walencja', 'Bilbao', 'Malaga', 'Vigo', 'Saragossa', 'Grenada', 'Kadyks'], style: 'es' },
  GER: { tier: 1, cities: ['Monachium', 'Dortmund', 'Berlin', 'Hamburg', 'Kolonia', 'Frankfurt', 'Stuttgart', 'Brema', 'Lipsk', 'Hanower', 'Moguncja'], style: 'de' },
  ITA: { tier: 1, cities: ['Mediolan', 'Turyn', 'Rzym', 'Neapol', 'Florencja', 'Bolonia', 'Genua', 'Werona', 'Bergamo', 'Udine', 'Parma'], style: 'it' },
  FRA: { tier: 1, cities: ['Paryż', 'Marsylia', 'Lyon', 'Lille', 'Bordeaux', 'Nicea', 'Nantes', 'Rennes', 'Tuluza', 'Strasburg', 'Lens'], style: 'fr' },
  NED: { tier: 2, cities: ['Amsterdam', 'Rotterdam', 'Eindhoven', 'Utrecht', 'Arnhem', 'Groningen', 'Alkmaar', 'Enschede'], style: 'nl' },
  POR: { tier: 2, cities: ['Lizbona', 'Porto', 'Braga', 'Guimarães', 'Coimbra', 'Faro'], style: 'pt' },
  BEL: { tier: 2, cities: ['Bruksela', 'Brugia', 'Gandawa', 'Antwerpia', 'Genk', 'Liège'], style: 'nl' },
  TUR: { tier: 2, cities: ['Stambuł', 'Ankara', 'Izmir', 'Trabzon', 'Bursa', 'Konya'], style: 'gen' },
  SCO: { tier: 3, cities: ['Glasgow', 'Edynburg', 'Aberdeen', 'Dundee', 'Kilmarnock'], style: 'en' },
  KSA: { tier: 3, cities: ['Rijad', 'Dżudda', 'Dammam', 'Mekka'], style: 'ar' },
  USA: { tier: 3, cities: ['Los Angeles', 'Nowy Jork', 'Miami', 'Seattle', 'Atlanta', 'Chicago', 'Austin'], style: 'us' },
  BRA: { tier: 3, cities: ['Rio de Janeiro', 'São Paulo', 'Belo Horizonte', 'Porto Alegre', 'Curitiba'], style: 'br' },
  ARG: { tier: 3, cities: ['Buenos Aires', 'Rosario', 'Córdoba', 'La Plata', 'Avellaneda'], style: 'la' },
};
