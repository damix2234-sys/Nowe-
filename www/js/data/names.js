// Pule imion (f) i nazwisk (l). Podkreślnik "_" zamieniany jest na spację.
// order: 'fl' = nazwisko wyświetlane przed imieniem (Korea, Chiny, Wietnam).
// nick: pseudonimy (np. brazylijskie), część zawodników występuje tylko pod pseudonimem.

const RAW = {
  pl: {
    f: 'Jakub Kacper Mateusz Michał Bartosz Krzysztof Paweł Tomasz Marcin Kamil Łukasz Adrian Damian Szymon Filip Dawid Patryk Sebastian Przemysław Wojciech Grzegorz Maciej Oskar Igor Antoni Karol Hubert Dominik Arkadiusz Rafał Mikołaj Konrad Norbert Daniel Marek',
    l: 'Nowak Kowalczyk Wiśniewski Wójcik Woźniak Dąbrowski Jankowski Mazur Kwiatkowski Krawczyk Grabowski Pawłowski Michalski Nowakowski Adamczyk Wieczorek Jabłoński Król Majewski Olszewski Jaworski Malinowski Pawlak Witkowski Walczak Stępień Górski Rutkowski Michalak Sikora Ostrowski Baran Szewczyk Tomaszewski Pietrzak Marciniak Wróbel Jakubowski Sadowski Zawadzki Chmielewski Borkowski Czarnecki Sawicki Sokołowski Kubiak Maciejewski Szczepański Kucharski Wilk Kalinowski Lis Mazurek Wysocki Adamski Kaźmierczak Wasilewski Sobczak Czerwiński Andrzejewski Cieślak Głowacki Zakrzewski Kołodziej Sikorski Krajewski Gajewski Szulc Baranowski Laskowski Brzeziński Makowski Ziółkowski Przybylski Domański Kozak Lewicki Bielecki Kurek Leśniak Banaś Gołębiowski Nawrocki Kaczmarczyk Żak Konieczny Kowal Bąk Stachowiak',
  },
  cs: {
    f: 'Jan Jakub Tomáš Lukáš Martin Ondřej Petr David Adam Matěj Filip Vojtěch Michal Pavel Marek Patrik Dominik Šimon Milan Radek Juraj Peter Marián Ľubomír Stanislav',
    l: 'Novák Svoboda Novotný Dvořák Černý Procházka Kučera Veselý Horák Němec Pokorný Pospíšil Hájek Jelínek Král Růžička Beneš Fiala Sedláček Doležal Zeman Kolář Navrátil Čermák Urban Vaněk Blažek Kříž Kovačik Horváth Varga Tóth Baláž Molnár Lukáč Kováč Oravec Hudák Kubík Polák Šimek Bartoš Malý Mareček Holub',
  },
  ru: {
    f: 'Aleksandr Dmitrij Maksim Siergiej Andriej Aleksiej Artiom Ilja Kiriłł Michaił Nikita Matwiej Roman Jegor Iwan Daniił Igor Władimir Paweł Anton Gleb Fiodor Timur Witalij',
    l: 'Iwanow Smirnow Kuzniecow Popow Wasiljew Pietrow Sokołow Michajłow Nowikow Fiodorow Morozow Wołkow Aleksiejew Lebiediew Siemionow Jegorow Pawłow Kozłow Stiepanow Nikołajew Orłow Andriejew Makarow Nikitin Zacharow Zajcew Sołowjow Borisow Jakowlew Grigorjew Romanow Worobjow Sergiejew Kuźmin Frołow Aleksandrow Dmitrijew Korolow Gusiew Kisieliow Iljin Maksimow Polakow Sorokin Winogradow Kowalow Biełow Antonow Tarasow Żukow Baranow',
  },
  ua: {
    f: 'Ołeksandr Andrij Wołodymyr Mykoła Serhij Dmytro Ołeh Taras Bohdan Wiktor Wasyl Jurij Ihor Maksym Artem Danyło Wadym Roman Witalij Denys Illia Mychajło Ostap Nazar Heorhij',
    l: 'Kowalenko Bondarenko Tkaczenko Krawczenko Szewczuk Kowalczuk Bojko Melnyk Łysenko Marczenko Olijnyk Rudenko Sawczenko Petrenko Ponomarenko Moroz Kłymenko Pawlenko Hawryluk Kuźmenko Hryhorenko Tymoszczuk Romanenko Sydorenko Fedorczuk Ostapczuk Karpenko Didenko Kowal Lewczenko Nesterenko Pałamarczuk Wasylenko Demczenko Hnatiuk Zacharczenko Prychodko Iwanenko Biłyk',
  },
  yu: {
    f: 'Luka Marko Nikola Stefan Filip Ivan Milan Dušan Aleksandar Petar Matej Josip Ante Mateo Lovro Mario Dario Tomislav Nemanja Lazar Miloš Vuk Ognjen Andrej Haris Edin Amar Emir Jan Žan Tim Nejc',
    l: 'Horvat Kovačević Babić Marić Jurić Novak Knežević Vuković Marković Petrović Jovanović Nikolić Ilić Đorđević Stojanović Pavlović Milošević Popović Lukić Kostić Radović Tomić Božić Perić Grgić Pavić Matić Šarić Blažević Lovrić Begić Hodžić Mujić Delić Hasanović Kadrić Zukić Krajnc Zupan Kovač Potočnik Mlakar Kos Vidmar Golob Turk Božović Vujović Radulović Šćekić',
  },
  mk: {
    f: 'Aleksandar Stefan Darko Goran Bojan Nikola Filip Marko Ilija Viktor Dimitar Jovan Vlatko Martin Todor Gjorgji Arijan Visar Besart',
    l: 'Nikolovski Stojanovski Petrovski Jovanovski Trajkovski Dimitrovski Ristovski Georgievski Angelovski Kostovski Velkovski Mitrevski Spasovski Ivanovski Gjorgjievski Bogdanovski Tasevski Zdravkovski Atanasov Ademi Bajrami Alili Musliu Elmazi',
  },
  al: {
    f: 'Arbër Besnik Endrit Ermal Klajdi Kristjan Amir Ardian Arlind Blerim Dardan Driton Fatos Florent Ilir Leotrim Liridon Mergim Rei Valon Ylber Altin Bekim Sokol Agon Edon Lorik',
    l: 'Hoxha Shehu Krasniqi Gashi Berisha Morina Hysa Kola Lleshi Rama Dervishi Bajrami Gjoka Hasani Kelmendi Ismaili Mustafa Sadiku Xhafa Zeneli Bytyqi Dushku Prenga Mehmeti Uka Shala Rexhepi Halili Cani Mema Lika Rugova Veseli Murati Zeqiri',
  },
  gr: {
    f: 'Giorgos Dimitris Kostas Nikos Giannis Christos Panagiotis Vasilis Thanasis Michalis Stelios Sotiris Tasos Petros Lefteris Alexandros Andreas Charalambos Manolis Kyriakos Spyros Fotis Theodoros Anestis Pantelis',
    l: 'Papadopoulos Pappas Georgiou Oikonomou Nikolaou Vlachos Angelopoulos Dimitriou Konstantinou Karagiannis Makris Christodoulou Ioannou Theodorou Antoniou Papanikolaou Michailidis Stavrou Kyriakou Alexiou Galanis Mitropoulos Zervas Lazaridis Raptis Fotiou Kalogeropoulos Charalambous Stylianou Economides',
  },
  tr: {
    f: 'Mehmet Ahmet Mustafa Emre Burak Can Kerem Yusuf Ömer Efe Serdar Hakan Onur Oğuzhan Ozan Cenk Barış Kaan Berk Umut Uğur Furkan Halil Enes Selim Taylan Doğukan Eren Alper',
    l: 'Yılmaz Kaya Demir Şahin Çelik Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Doğan Kılıç Aslan Çetin Kara Koç Kurt Özkan Şimşek Polat Korkmaz Erdoğan Akın Tekin Ünal Karaca Bulut Avcı Turan Bozkurt Ateş Özer Kaplan Uçar Sarı Tunç Ersoy Cengiz Bayram',
  },
  az: {
    f: 'Rauf Emin Mahir Ramil Elvin Namik Tural Rashad Orxan Murad Toral Ruslan Aqil Vüsal Emil Kamran Ceyhun Bahlul Renat Abbas Musa Nihat Ilkin Farid Elnur',
    l: 'Aliyev Mammadov Hasanov Huseynov Guliyev Ismayilov Abdullayev Babayev Rzayev Jafarov Karimov Nabiyev Qurbanov Salahli Mustafazade Sadiqov Ibrahimli Bayramov Hajiyev Agayev Ahmadov Shirinov Mahmudov Dadashov Isayev',
  },
  ro: {
    f: 'Andrei Alexandru Ionuț Florin Răzvan Mihai Cristian Vlad Bogdan Gabriel Adrian Ciprian Darius Denis Marius Nicolae Ovidiu Radu Sergiu Ștefan Valentin Victor Lucian Claudiu Cosmin Dorin Octavian',
    l: 'Popescu Ionescu Popa Stan Dumitru Stoica Gheorghe Rusu Munteanu Matei Constantin Șerban Moldovan Ene Lazăr Mocanu Toma Dinu Neagu Cristea Florea Barbu Nistor Tudor Ilie Grigore Marin Iordache Sârbu Ciobanu Nedelcu Pârvu Voicu Sandu',
  },
  hu: {
    f: 'Dániel Bence Ádám Gergő Dávid Márton Balázs Péter Zoltán Tamás Attila Norbert Roland Krisztián Barnabás Levente Bálint Milán Szabolcs Kristóf Botond Zsolt Gábor László András',
    l: 'Nagy Kovács Tóth Szabó Horváth Varga Kiss Molnár Németh Farkas Balogh Papp Takács Juhász Lakatos Mészáros Oláh Simon Rácz Fekete Szilágyi Török Fehér Balázs Gál Kis Szűcs Kocsis Pintér Fodor Sipos Magyar Lukács Biró Király Katona',
  },
  bg: {
    f: 'Georgi Dimitar Ivan Nikolay Petar Stoyan Hristo Martin Kiril Radoslav Valentin Todor Vasil Iliyan Yordan Aleksandar Krasimir Plamen Svetoslav Atanas Bozhidar Momchil Preslav Kristian',
    l: 'Ivanov Georgiev Dimitrov Petrov Nikolov Hristov Stoyanov Todorov Iliev Vasilev Atanasov Petkov Angelov Kolev Yordanov Marinov Popov Mihaylov Krastev Dobrev Tsvetkov Kirilov Penev Velkov Stefanov Bozhinov Karadzhov Yankov Delchev Gospodinov',
  },
  de: {
    f: 'Lukas Leon Jonas Felix Maximilian Paul Elias Ben Julian Niklas Tim Jan Moritz Florian Tobias David Fabian Philipp Marvin Kevin Dennis Marco Sebastian Lennart Nico Luca Robin Jannik Malte Henrik Konstantin',
    l: 'Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Bauer Richter Klein Wolf Schröder Neumann Schwarz Zimmermann Braun Krüger Hofmann Hartmann Lange Schmitt Werner Schmitz Krause Meier Lehmann Schmid Schulze Maier Köhler Herrmann König Walter Mayer Huber Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Vogel Friedrich Keller Günther Frank Berger Winkler Roth Beck Lorenz Baumann Albrecht Ludwig Kraus Gruber Steiner Moser Brunner Egger Hofer Pichler Aigner',
  },
  nl: {
    f: 'Daan Sem Lucas Milan Levi Thijs Jesse Bram Stijn Ruben Lars Niels Tom Sven Joris Wout Jens Pieter Gijs Koen Bas Teun Rick Jasper Mats Thomas Kees Dirk Arne Bart Senne Lander',
    l: 'Jansen de_Vries van_den_Berg Bakker Janssen Visser Smit Meijer de_Boer Mulder de_Groot Bos Vos Hendriks van_Leeuwen Dekker Brouwer de_Wit Dijkstra Smits de_Graaf van_der_Meer van_der_Linden Kok Jacobs de_Haan Vermeulen van_den_Heuvel van_der_Veen van_den_Broek Schouten van_Beek Willems Hoekstra Maas Verhoeven Koster Prins Huisman Peeters Maes Claes Goossens Wouters De_Smet Lambrechts Van_Damme Verbeke',
  },
  fr: {
    f: 'Lucas Hugo Théo Louis Nathan Mathis Enzo Tom Maxime Antoine Clément Alexandre Baptiste Quentin Romain Julien Thomas Florian Benjamin Valentin Adrien Mathéo Rayan Matthieu Jules Nicolas Jérémy Corentin Bastien Loïc',
    l: 'Martin Bernard Dubois Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia Bertrand Roux Vincent Fournier Morel Girard André Lefèvre Mercier Dupont Lambert Bonnet François Legrand Garnier Faure Rousseau Blanc Guérin Henry Roussel Perrin Morin Mathieu Gauthier Dumont Fontaine Chevalier Masson Boyer Lemaire Duval Joly Roche Meunier Marchand Dufour Blanchard Barbier Brunet Leroux Colin Renard Arnaud Caron Aubert Giraud Leclerc Vidal Renaud Lemoine Picard',
  },
  es: {
    f: 'Pablo Álvaro Hugo Mario Daniel Adrián Diego Sergio Javier Alejandro Iván Rubén Raúl Jorge Marcos Óscar Carlos Víctor Íñigo Unai Aitor Mikel Gorka Pau Marc Jordi Gerard Nico Pedro Fran Dani Borja Iker Asier Rodrigo Gonzalo',
    l: 'García González Rodríguez Fernández López Martínez Sánchez Pérez Gómez Martín Jiménez Ruiz Hernández Díaz Moreno Muñoz Álvarez Romero Alonso Gutiérrez Navarro Torres Domínguez Vázquez Gil Ramírez Serrano Blanco Molina Morales Ortega Delgado Castro Ortiz Rubio Marín Sanz Núñez Iglesias Medina Garrido Cortés Castillo Santos Lozano Guerrero Cano Prieto Méndez Cruz Calvo Gallego León Márquez Herrera Peña Flores Cabrera Campos Vega Fuentes Carrasco Caballero Reyes Nieto Aguilar Etxeberria Arrieta Goikoetxea Aguirre Ibarra Uriarte',
  },
  pt: {
    f: 'João Rodrigo Martim Tiago Diogo Gonçalo Afonso Tomás Pedro Rafael Duarte Francisco Miguel Ricardo Nuno André Vítor Hugo Fábio Daniel Gil Renato Samuel Vasco Leandro',
    l: 'Silva Santos Ferreira Pereira Oliveira Rodrigues Martins Jesus Sousa Gonçalves Gomes Lopes Marques Alves Almeida Ribeiro Pinto Carvalho Teixeira Moreira Correia Mendes Nunes Soares Vieira Monteiro Cardoso Rocha Raposo Coelho Cruz Reis Simões Antunes Matos Fonseca Machado Araújo Barbosa Tavares Lourenço Castro Figueiredo Azevedo Freitas Batista Esteves Domingues Campos Pires Henriques Morais Faria Brito Leite Guerreiro Paiva Magalhães',
  },
  it: {
    f: 'Lorenzo Alessandro Leonardo Francesco Andrea Mattia Gabriele Tommaso Riccardo Edoardo Matteo Giuseppe Antonio Federico Davide Simone Luca Marco Nicolò Giacomo Pietro Filippo Michele Stefano Daniele Emanuele Gianluca Fabio Manuel Christian Samuele Alberto',
    l: 'Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De_Luca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo Gentile Martinelli Vitale Lombardo Serra Coppola De_Santis D\'Angelo Marchetti Parisi Villa Ferraro Ferri Fabbri Bianco Marini Grasso Valentini Messina Sala De_Angelis Palumbo Sanna Farina Rizzi Monti Cattaneo Morelli Amato Silvestri Mazza Testa Grassi Carbone Giuliani Benedetti Barone Caputo Montanari Guerra Palmieri Bernardi',
  },
  en: {
    f: 'Harry Jack Oliver George Charlie Jacob Thomas James William Joshua Daniel Alfie Ethan Callum Kieran Ryan Connor Luke Lewis Jamie Ben Sam Joe Max Nathan Tyler Marcus Aaron Liam Adam Owen Jarrod Dominic Ollie Morgan Elliot Archie Freddie Leo Toby',
    l: 'Smith Jones Taylor Brown Williams Wilson Johnson Davies Robinson Wright Thompson Evans White Roberts Green Hall Wood Harris Lewis Martin Jackson Clarke Turner Hill Scott Cooper Morris Ward Moore Watson Baker Harrison Morgan Young Allen Mitchell Anderson Bell Parker Cook Carter Shaw Phillips Richardson Chapman Adams Holmes Hughes Marshall Webb Rogers Gray Mills Stevens Murray Barnes Pearson Fletcher Holland Dixon Burton Lloyd Matthews Knight Ellis Price Hunt Butler Fox Russell Simpson Kennedy Fisher Wells Booth Hayes Gibson Lawrence Marsh Riley Spencer Atkinson Stone Barker Payne Dawson Saunders Lane Rowe Hudson Kelly Sharp Pearce Newman Sutton Bennett Griffiths Bradley Francis Gardner West Nash Steele Dean Hammond',
  },
  ie: {
    f: 'Seán Conor Cian Darragh Oisín Ciarán Liam Jamie Callum Evan Aaron Adam Dara Fionn Rory Shane Niall Eoin Kevin Mark Cillian Tadhg Ronan Patrick Michael Gavin Jason Troy',
    l: 'Murphy Kelly O\'Sullivan Walsh O\'Brien Byrne Ryan O\'Connor O\'Neill O\'Reilly Doyle McCarthy Gallagher O\'Doherty Kennedy Lynch Murray Quinn Moore McLoughlin O\'Carroll Connolly Daly O\'Connell Brennan Burke Collins Campbell Johnston Hughes Farrell Fitzgerald Maguire Nolan Flynn Callaghan O\'Donnell Duffy Mahony Boyle Healy Kavanagh Hegarty Dunne Cullen Power Egan',
  },
  sco: {
    f: 'Callum Lewis Jamie Ryan Ross Scott Kieran Craig Andrew Stuart Fraser Euan Calum Grant Liam Connor Jack Ewan Kyle Greg Alan Graeme Aidan Ally Lennon Finlay Kenny',
    l: 'Smith Brown Wilson Campbell Stewart Thomson Anderson MacDonald Reid Murray Taylor Clark Ross Watson Morrison Paterson Young Mitchell Fraser McDonald Gray Henderson Hamilton Graham Kerr Johnston Cameron Ferguson Duncan Hunter Kelly Bell McKenzie Mackay Allan Black MacLeod McLean Russell Gibson Wallace Marshall Sutherland Wright McKay Burns McLaughlin Docherty Lennox Boyd Porteous',
  },
  wal: {
    f: 'Rhys Dylan Gareth Ethan Wes Owain Ioan Llŷr Cai Gethin Huw Iwan Tomos Osian Rhodri Steffan Emyr Aled Jac Morgan Sion Elis Dafydd Gruffydd Liam Tom',
    l: 'Jones Williams Davies Evans Thomas Roberts Lewis Hughes Morgan Griffiths Edwards Owen Price Jenkins Powell Rees James Phillips Parry Pugh Lloyd Morris Watkins Harries Bowen Howells Pritchard Vaughan Prosser Rowlands Llewellyn Matthias Probert Gwynne Meredith Bevan Beynon',
  },
  nord: {
    f: 'Mikkel Rasmus Kasper Jonas Emil Oliver Victor William Magnus Lucas Tobias Andreas Christian Frederik Sander Jesper Joakim Kristoffer Martin Henrik Anders Isak Viktor Hugo Elias Filip Linus Ludvig Albin Gustav Axel Oscar Thomas Sondre Fredrik Eirik Morten Jens Patrick',
    l: 'Jensen Nielsen Hansen Pedersen Andersen Larsen Sørensen Rasmussen Jørgensen Petersen Madsen Kristensen Olsen Thomsen Poulsen Johansen Knudsen Mortensen Møller Johansson Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Pettersson Jonsson Lindberg Lindqvist Berg Lund Dahl Bakke Haugen Johannessen Strand Solberg Moen Lie Berntsen Halvorsen Nygaard Kristiansen Lindström Sandberg Joensen Jacobsen Vatnhamar Davidsen',
  },
  is: {
    f: 'Jón Gunnar Sigurður Guðmundur Ólafur Einar Kristján Magnús Stefán Björn Árni Birkir Rúnar Alfreð Hákon Ísak Andri Sverrir Jökull Viðar Bjarki Daníel Logi Orri',
    l: 'Jónsson Sigurðsson Guðmundsson Gunnarsson Ólafsson Einarsson Kristjánsson Magnússon Stefánsson Jóhannsson Björnsson Árnason Helgason Þórsson Halldórsson Pálsson Sveinsson Karlsson Ragnarsson Friðriksson Hauksson Eiríksson Arnarson',
  },
  fi: {
    f: 'Mikko Juho Jussi Antti Joni Teemu Lauri Eetu Onni Leo Elias Aleksi Niko Oliver Valtteri Tuomas Joel Robin Ville Daniel Rasmus Oskari Topi Matti Pyry',
    l: 'Korhonen Virtanen Mäkinen Nieminen Mäkelä Hämäläinen Laine Heikkinen Koskinen Järvinen Lehtonen Lehtinen Saarinen Salminen Heinonen Niemi Heikkilä Kinnunen Salonen Turunen Salo Laitinen Tuominen Rantanen Karjalainen Jokinen Mattila Savolainen Lahtinen Ahonen Hakala Leppänen Kallio',
  },
  ee: {
    f: 'Martin Karl Rasmus Mattias Markus Sander Kristjan Henri Joonas Ragnar Siim Taavi Erik Rauno Mihkel Kevin Robert Marten Artur Oliver Tanel Andres',
    l: 'Tamm Saar Sepp Mägi Kask Kukk Rebane Ilves Pärn Koppel Kuusk Lepik Karu Kangur Ots Raudsepp Vaher Luik Kallas Teder Toom Laur Pihlak Kivi Sarapuu Aas Lill Paju Org',
  },
  lv: {
    f: 'Jānis Andris Kristaps Roberts Artūrs Mārtiņš Edgars Raivis Vladislavs Aleksejs Kaspars Gints Rūdolfs Dmitrijs Marko Eduards Antonijs Renārs Krišjānis Toms Emīls',
    l: 'Bērziņš Kalniņš Ozoliņš Jansons Ozols Liepiņš Krūmiņš Balodis Eglītis Zariņš Pētersons Vītols Kļaviņš Lācis Zvirbulis Siliņš Rozītis Āboliņš Grīnbergs Lapiņš Krastiņš Vanags Sproģis Šteins',
  },
  lt: {
    f: 'Lukas Tomas Mantas Paulius Justas Gvidas Domantas Edvinas Vytautas Rokas Arvydas Karolis Deividas Modestas Armandas Donatas Linas Simonas Matas Ignas Nojus Dovydas',
    l: 'Kazlauskas Jankauskas Petrauskas Stankevičius Vasiliauskas Žukauskas Butkus Paulauskas Urbonas Kavaliauskas Rimkus Navickas Ramanauskas Savickas Bernotas Grigaliūnas Mikulėnas Dapkus Adomaitis Valančius Baranauskas Mažeika Šimkus Žemaitis Jonaitis Klimavičius Gudelis Rutkauskas',
  },
  ka: {
    f: 'Giorgi Luka Davit Levan Nika Otar Zurab Irakli Lasha Saba Guram Valeri Budu Jaba Anzor Tornike Beka Sandro Lado Mamuka Gela Aleksandre Gabriel Zuriko',
    l: 'Beridze Kapanadze Gelashvili Maisuradze Giorgadze Lomidze Tsiklauri Abuladze Mikadze Nozadze Dvali Tabatadze Shengelia Japaridze Chkhaidze Bakradze Javakhishvili Kvirikashvili Meladze Sikharulidze Tsereteli Kobakhidze Gogia Jikia Ugrekhelidze',
  },
  hy: {
    f: 'Aram Artur Davit Gevorg Hovhannes Karen Levon Narek Tigran Vahe Sargis Ruben Edgar Khoren Arman Varazdat Erik Artak Gor Hrayr Kamo Zaven Vardan',
    l: 'Hovhannisyan Harutyunyan Sargsyan Khachatryan Grigoryan Petrosyan Hakobyan Vardanyan Karapetyan Gevorgyan Avetisyan Ghazaryan Martirosyan Arakelyan Manukyan Babayan Simonyan Galstyan Movsisyan Danielyan Tadevosyan Adamyan Mnatsakanyan Zakaryan Melkonyan',
  },
  kz: {
    f: 'Askhat Bauyrzhan Nurlan Yerzhan Islambek Aibol Abat Ruslan Daniyar Temirlan Sultan Arman Dastan Didar Marat Yerkebulan Aslan Bakhtiyar Olzhas Zhaslan Azat',
    l: 'Zhaksylykov Abiken Zhangylyshbay Nurgaliev Seitkali Bekov Aimbetov Sadybekov Kuat Darabayev Beisebekov Suyumbayev Alimbetov Ermekov Toktarov Zhumabekov Satpayev Kairov Akhmetov Tolegenov Baimukhamedov',
  },
  he: {
    f: 'Eran Omer Itay Dor Yonatan Eli Tomer Shon Liel Manor Dean Gavriel Mohammad Anan Yarden Idan Raz Amir Oscar Nir Ofir Ariel Guy Roy Neta',
    l: 'Cohen Levi Mizrahi Biton Dahan Avraham Friedman Azoulay Malka Katz Hadad Amar Gabay Shapira Ohana Ben_David Yosef Golan Ashkenazi Elbaz Sabag Glazer Lavi Turgeman Haziza Kandil Nachmias Revivo Toledano Atar Baribo Suissa Barak',
  },
  mt: {
    f: 'Joseph Matthew Luke Jean Kurt Andrei Steve Teddy Jodi Zach Yannick Paul Juan Alexander Ryan Cain Enrico Nicholas Clayton Gabriel Karl Brandon',
    l: 'Borg Camilleri Vella Farrugia Zammit Galea Micallef Grech Attard Spiteri Azzopardi Mifsud Agius Pace Sammut Cassar Muscat Xuereb Bonnici Caruana Fenech Gatt Debono Busuttil Mallia Cutajar Abela Schembri Bugeja Tabone Mizzi Dimech',
  },
  la: {
    f: 'Juan Carlos Luis José Diego Santiago Matías Nicolás Sebastián Alejandro Gonzalo Facundo Agustín Joaquín Franco Thiago Benjamín Rodrigo Germán Cristian Jhon Brayan Kevin Jefferson Yeferson Anderson Wilmer Luciano Maximiliano Marcelo Hernán Esteban Fabián Andrés Felipe Camilo Mauricio Héctor Óscar Jesús Erick Jorge Brian Ignacio Bruno Tomás Gastón Ezequiel Lucas Valentín Mateo',
    l: 'González Rodríguez Gómez Fernández López Martínez Pérez García Sánchez Sosa Torres Álvarez Ruiz Ramírez Flores Benítez Acosta Medina Herrera Aguirre Gutiérrez Pereyra Rojas Molina Castro Ortiz Silva Núñez Luna Juárez Cabrera Ríos Ferreyra Godoy Morales Domínguez Moreno Peralta Vega Carrizo Quiroga Ponce Vargas Correa Castillo Mendoza Cáceres Arias Ledesma Vera Paredes Cardozo Montiel Villalba Ayala Zapata Mosquera Valencia Arboleda Palacios Mina Murillo Lerma Borja Quintero Guerrero Lozano Chávez Salazar Maldonado Escobar Cisneros Montes Bustos Figueroa Valdés Araya Contreras Muñoz Fuentes Tapia Reyes Espinoza Navarro Alarcón Valdivia Cortés Jara Pizarro Sepúlveda Mena Ortega Lagos',
  },
  br: {
    f: 'Gabriel Lucas Matheus Pedro Guilherme Felipe Rafael Bruno Rodrigo Leonardo Gustavo Diego Eduardo Igor João André Caio Danilo Douglas Éder Fabrício Henrique Luiz Marcos Paulo Renan Wesley Willian Yan Kaio Talles Murilo Arthur',
    l: 'Silva Santos Oliveira Souza Lima Pereira Ferreira Rodrigues Almeida Nascimento Alves Carvalho Araújo Ribeiro Gomes Martins Rocha Dias Teixeira Correia Cardoso Moreira Mendes Freitas Barros Pinto Cavalcanti Monteiro Campos Vieira Nunes Batista Ramos Castro Andrade Machado Reis Fernandes Lopes Sales Bezerra Farias Duarte Rezende Paixão Assunção Brandão Medeiros',
    nick: 'Dudu Juninho Tiquinho Pepê Léo Zé_Lucas Toninho Juca Didi Nenê Dedé Tetê Chiquinho Biro Wendel Serginho Zinho Mineiro Carlinhos Pedrinho Marcelinho Luquinha Zezinho Paulinho Cacá Lelê Thiaguinho',
  },
  car: {
    f: 'Leon Shamar Kemar Andre Damion Ravel Kevaughn Romario Dexter Jahmali Jermaine Tyreek Kaheim Lamar Darren Marlon Junior Dwayne Jamal Daniel Ethan Kasey Alvas Nathaniel Rodney',
    l: 'Brown Campbell Williams Smith Johnson Thompson Gordon Francis Grant Reid Walker Wright Bryan Powell Hector Lindo Bell Gray Bernard Bonds Cephas Leigh Ward Fisher Dixon Harvey Joseph Charles Garcia Phillip Jones Molino Hackshaw Cyrus Jules Hosein Bateau Kerr Roach Peltier',
  },
  ht: {
    f: 'Jean Pierre Derrick Carnejy Ricardo Steeven Mechack Bryan Mondy Danley Josué Leverton Garven Kervens Johny Alex Stéphane Wilguens Fabrice Jems Louicius',
    l: 'Pierre Jean-Baptiste Joseph Charles Louis Desir Etienne Alcéus Saint-Fleur Jean-Louis Exantus Placide Lambese Antoine Arcus Lafrance Duverger Guerrier Delva Herivaux Jérôme Bellegarde Pierre-Louis Toussaint Dorsainvil Fils-Aimé Augustin',
  },
  ar: {
    f: 'Mohamed Ahmed Youssef Omar Ali Hassan Hamza Karim Amine Mehdi Ayoub Bilal Ismail Ibrahim Khalid Abdullah Salem Fahad Saud Nasser Faisal Sami Tarek Walid Adel Nabil Rachid Sofiane Yacine Zakaria Anas Marwan Rayan Mohanad Ziyad Abdulrahman Mustafa Hussein',
    l: 'El_Amrani Benali Haddad Mansour Saleh Nasser Khalil Hamdi Rahman Aziz Ibrahim Hassan Mahmoud Abdallah Farouk Youssef Belkacem Bensaid Bouzid Chafik Ouali Ziani Dahmani Benkhalifa Ait_Ali Belhadj Ghali Saadi Jaziri Trabelsi Ben_Salah Gharbi Mejri Jebali Abdelaziz Fathy Shehata Gaber Al-Shahrani Al-Harbi Al-Ghamdi Al-Otaibi Al-Malki Al-Mutairi Al-Qahtani Al-Shammari Al-Abed Al-Ali Al-Hammadi Al-Rawi Al-Saadi Mahdi Kadhim Jassim Abdulkarim Hamdan Rashed Mubarak Juma',
  },
  afr_fr: {
    f: 'Moussa Ibrahima Mamadou Cheikh Ousmane Abdoulaye Amadou Boubacar Youssouf Pape Souleymane Nicolas Serge Christian Yves Arnaud Jean-Philippe Stéphane Eric Samuel Patrick Karim Ismaël Junior Hervé Brice Axel Jordan Bertrand Rodrigue Cédric Landry Yannick Chancel Fabrice Dylan',
    l: 'Diallo Traoré Koné Coulibaly Diop Ndiaye Sow Cissé Camara Touré Sylla Keita Bamba Kouassi Diarra Sangaré Doumbia Ba Faye Mendy Gueye Niang Seck Diakité Zoro N\'Guessan Yao Gnagnon Aboubakar Mbarga Ekambi Nkoulou Ngamaleu Kalulu Mukau Bakambu Banza Mbemba Kakuta Mayele Nsimba Ondoua Moukandjo Obiang Lemina Mabiala Ntsiba',
  },
  afr_en: {
    f: 'Chukwuemeka Emmanuel Samuel Tolu Femi Chidera Uche Bright Kingsley Daniel Joseph Ransford Kwame Kofi Yaw Kwabena Kojo Ebenezer Elisha Benson Themba Sipho Teboho Thapelo Siyabonga Bongani Fashion Enock Kings Clatous Lameck Allan Farouk Isaac Michael Brian Joel',
    l: 'Okafor Okonkwo Adeyemi Balogun Eze Nwosu Obi Chukwu Onyeka Uzoho Ogunleye Akinola Bassey Okoye Olayinka Mensah Asante Owusu Osei Appiah Agyemang Darko Tetteh Amankwah Addo Ofori Danso Nkosi Dlamini Ndlovu Khumalo Zungu Mthethwa Sithole Mabaso Banda Phiri Mwale Musonda Chama Kapumbu Lungu Mukasa Okello Ochieng Otieno Omondi Kimani Mutua Odhiambo',
  },
  ao: {
    f: 'Zito Jonathan Manuel Hélder Mário Nuno Ary Jamiro Kenny Dylan Willy Logan Roberto Edson Rui Bruno Carlos Wilson Elvis Kiki Patrick Joel Lito Paulo Danilson',
    l: 'Mendes Rodrigues Fortes Lopes Andrade Correia Pina Delgado Gomes Duarte Cabral Moreira Furtado Brito Évora Graça Neto Fernandes Silva Baptista Mateus Kiala Massunguna Pedro Miguel Afonso Domingos Sebastião Panzo Mabiala',
  },
  fa: {
    f: 'Ali Mohammad Reza Mehdi Hossein Amir Saeid Majid Milad Morteza Ehsan Karim Omid Vahid Payam Kaveh Arash Babak Shahab Ramin Hamed Sina Pouria Rouzbeh Mehrdad Aria Kasra Hadi',
    l: 'Ahmadi Rezaei Moradi Hashemi Rahimi Mousavi Jafari Sadeghi Ghasemi Nazari Kazemi Ebrahimi Akbari Heidari Rostami Shirazi Asadi Ghorbani Abbasi Bagheri Soltani Kanaani Farahani Tavakoli Esmaeili Navidi Mirzaei Zare Shahbazi Yousefi Salehi Golzari',
  },
  ja: {
    f: 'Yuki Haruto Sota Yuto Riku Kaito Ren Hayato Shota Kenta Ryota Yusuke Shun Kazuki Taiga Koki Naoki Tatsuya Daiki Kenshin Gaku Reo Sho Itsuki Rui Hiroto Tomoya Yuma Masaya Kosei Kohei',
    l: 'Sato Suzuki Takahashi Tanaka Watanabe Yamamoto Nakamura Kobayashi Kato Yamada Sasaki Yamaguchi Matsumoto Inoue Kimura Hayashi Shimizu Yamazaki Mori Abe Ikeda Hashimoto Ishikawa Ogawa Okada Goto Hasegawa Murakami Kondo Ishii Saito Sakamoto Aoki Fujita Nishimura Fukuda Ota Miura Okamoto Matsuda Harada Kaneko Wada Nakano Ono Tamura Takeuchi Kaneda Morita Sugimoto Kubota Tsuchiya Hirano',
  },
  ko: {
    order: 'fl',
    f: 'Min-jun Seo-jun Ji-ho Ha-joon Do-yun Jun-woo Hyun-woo Ji-hoon Woo-jin Sung-min Tae-hyun Jae-won Dong-hyun Young-woo Seung-ho Kyung-won Chang-hoon Joon-ho Sang-woo Yeon-woo Tae-hwan Jin-ho Si-woo Eun-sung',
    l: 'Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn Song Hong Yoo Jeon Ko Moon Yang Bae Baek Heo Nam',
  },
  zh: {
    order: 'fl',
    f: 'Wei Jun Yang Hao Peng Bin Tao Chao Jie Yu Long Fei Kai Xin Rui Ming Yifan Zihao Haoran Jiahao Junjie Tianyu Yuxuan Zhiwei Shihao Chenxi Xiaoyu Jiawei Ziyang',
    l: 'Wang Li Zhang Liu Chen Yang Zhao Huang Zhou Wu Xu Sun Hu Zhu Gao Lin He Guo Ma Luo Liang Song Zheng Xie Han Tang Feng Yu Dong Xiao',
  },
  uz: {
    f: 'Jasurbek Odiljon Aziz Sherzod Rustam Dostonbek Bobur Islom Akmal Sanjar Ulugbek Farrukh Javokhir Oston Sardor Shokhrukh Asilbek Alisher Davron Bekhruz Temur Nodir Laziz Utkir',
    l: 'Karimov Rakhimov Tursunov Yusupov Nurmatov Abdullaev Ergashev Alimov Sobirov Kholmatov Mirzaev Saidov Rashidov Normatov Hamroev Akhmedov Usmonov Turgunov Boboev Iskanderov Sultanov Davletov Ismoilov Yakubov Juraev Mahmudov Abdikholikov Khamraev',
  },
  th: {
    f: 'Kritsada Weerathep Pansa Bordin Somsak Anan Prasit Thanawat Kittipong Narubadin Siwakorn Phitiwat Jakkapan Peeradon Worachit Tanaboon Ekkapoj Chatchai Nattawut Apisit Kanokpon Sakda',
    l: 'Srisuk Saelim Wongsa Boonmee Sukjai Thongdee Phromsri Kaewmanee Rattanakul Suwannarat Jaidee Somboon Inthasen Kongsri Panyasri Meesuk Promma Nakprasert Chaisri Thepkham Yodsri Sangkhao Pongsak Charoensuk Sitthichok',
  },
  vi: {
    order: 'fl',
    f: 'Minh_Khoa Đức_Anh Thành_Nam Văn_Thắng Quốc_Bảo Hữu_Phước Minh_Tuấn Gia_Huy Trọng_Nghĩa Đình_Phong Thanh_Tùng Văn_Khải Hoài_Nam Quốc_Việt Xuân_Bách Minh_Trí Văn_Tài Tấn_Sinh Bảo_Long Đức_Huy Hoàng_Thịnh Thế_Anh Khắc_Ngọc',
    l: 'Nguyễn Trần Lê Phạm Hoàng Huỳnh Phan Vũ Võ Đặng Bùi Đỗ Hồ Ngô Dương Lý Đinh Đoàn Trương Mai',
  },
  id: {
    f: 'Rizky Dimas Ricky Fajar Yakob Hokky Ramadhan Irfan Evan Dendy Arkhan Muhammad Rachmat Andik Bagas Dewa Putu Made Ilham Febri Agung Bayu Teguh Wahyu Yudha',
    l: 'Pratama Saputra Hidayat Santoso Wijaya Nugroho Kurniawan Setiawan Gunawan Hakim Firmansyah Syahputra Siregar Nainggolan Simanjuntak Lubis Harahap Tambunan Sitompul Wibowo Susanto Prasetyo Maulana Hermawan Irawan Sembiring',
  },
  in: {
    f: 'Akash Rahul Nikhil Vikram Rohit Arjun Karan Vishal Deepak Ankit Ajay Mohit Sumit Naveen Ravi Imran Vinit Harsh Aman Siddharth Tejas',
    l: 'Singh Kumar Sharma Verma Gupta Yadav Patel Das Nair Menon Pillai Reddy Rao Iyer Bose Sen Thapa Gurung Lama Shetty Naik Fernandes Dsouza Rodrigues Malik Khan Chauhan Rawat Bhutia Lalrinzuala',
  },
  pac: {
    f: 'Roy Micah Junior Clifford Ratu Napolioni Tevita Iosefo Hiro Manu Tamatoa Heimano Raimana Vaitea Pita Waisake Setareki Saula Jone Josaia Nemani Tomasi Gagame Leon Henry',
    l: 'Tavake Naqiri Waqa Ravuvu Kumar Tabua Lomani Nadolo Ratukana Vakatalesau Tehau Tuiamo Faatau Teariki Vahirua Tinirau Mataitai Taufa Kakai Lea Tome Totori Sau Hou Konofilia Lenga Wate Kaua',
  },
};

const split = (s) => (s ? s.trim().split(/\s+/).map((x) => x.replace(/_/g, ' ')) : []);

export const POOLS = Object.fromEntries(
  Object.entries(RAW).map(([k, v]) => [k, { f: split(v.f), l: split(v.l), nick: split(v.nick), order: v.order || 'lf' }])
);

/** Imię i nazwisko do wyświetlenia. */
export function fullName(p) {
  if (!p.fn) return p.ln;
  return p.ord === 'fl' ? `${p.ln} ${p.fn}` : `${p.fn} ${p.ln}`;
}

/** Krótka forma (np. "J. Kowalski"). */
export function shortName(p) {
  if (!p.fn) return p.ln;
  if (p.ord === 'fl') return `${p.ln} ${p.fn}`;
  return `${p.fn[0]}. ${p.ln}`;
}
