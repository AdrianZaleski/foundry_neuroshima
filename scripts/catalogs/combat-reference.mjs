// Dane pochodzą z zakładek DAMAGE i ATTACK arkusza referencyjnego.
// Na tym etapie są słownikami nazw i opisów. Nie uruchamiają jeszcze walki.
export const damageDefinitions = [
  {
    "sourceCode": "DAMAGE_D",
    "name": "Draśnięcie",
    "description": "Draśnięcie - tego nawet nie zauważysz",
    "symbol": "D_D",
    "effectCode": "",
    "flatModifier": -5,
    "painModifier": -5,
    "locationDescriptions": {
      "head": "Bez żadnych poważniejszych skutków.",
      "torso": "Bez żadnych poważniejszych skutków.",
      "rightArm": "Bez żadnych poważniejszych skutków.",
      "leftArm": "Bez żadnych poważniejszych skutków.",
      "leg": "Bez żadnych poważniejszych skutków."
    }
  },
  {
    "sourceCode": "DAMAGE_L",
    "name": "Obrażenia Lekkie",
    "description": "Rana lekka to taka którą sam sobie opatrzysz.",
    "symbol": "D_L",
    "effectCode": "",
    "flatModifier": -15,
    "painModifier": -15,
    "locationDescriptions": {
      "head": "Piekąca blizna, zdarta skóra",
      "torso": "Ból przy czynnościach wymagających elastyczności; blizna.",
      "rightArm": "Ból przy czynnościach wymagających wysiłku ręki; blizna",
      "leftArm": "Ból przy czynnościach wymagających wysiłku ręki; blizna",
      "leg": "Urażona noga boli; czasem ranny gubi krok."
    }
  },
  {
    "sourceCode": "DAMAGE_C",
    "name": "Obrażenia Ciężkie",
    "description": "Rana ciężka to taka, do której potzebujesz felczera. ",
    "symbol": "D_C",
    "effectCode": "",
    "flatModifier": -30,
    "painModifier": -60,
    "locationDescriptions": {
      "head": "Bóle i zawroty głowy; zdarta skóra (z włosami); mdłości",
      "torso": "Utrudnione bieganie, powracające bóle, krwotoki.",
      "rightArm": "Sztywność ręki; drżenie dłoni, zdarta skóra",
      "leftArm": "Sztywność ręki; drżenie dłoni, zdarta skóra",
      "leg": "Utykanie; drętwienie nogi; niezdolność do biegania."
    }
  },
  {
    "sourceCode": "DAMAGE_K",
    "name": "Obrażenia Krytyczne",
    "description": "Rana krytyczna to taka, przy której felczer już ci nie pomoże. Bez natychmiastowej pomocy postać umiera.",
    "symbol": "D_K",
    "effectCode": "EFFECT_DEATH",
    "flatModifier": -160,
    "painModifier": -160,
    "locationDescriptions": {
      "head": "Ogromny ból głowy, kłopoty z mówieniem. widzeniem, słuchem; zmasakrowana twarz; utrudnione jedzenie.",
      "torso": "Zwolnione poruszanie się; niezdolność do biegania; ręka odruchowo zasłania zranione miejsce.",
      "rightArm": "Nagłe omdlenia ręki; gwałtowne l silne bóle, sztywność; niezdolność do precyzyjnych czynności manualnych.",
      "leftArm": "Nagłe omdlenia ręki; gwałtowne l silne bóle, sztywność; niezdolność do precyzyjnych czynności manualnych.",
      "leg": "Spowolnione chodzenie; bezustanny ból; niewładna kończyna."
    }
  },
  {
    "sourceCode": "DAMAGE_S_D",
    "name": "Drobny Siniak",
    "description": "Drobne zaczerwienienie - nie ma o czym mówić",
    "symbol": "S_D",
    "effectCode": "",
    "flatModifier": -5,
    "painModifier": -5,
    "locationDescriptions": {
      "head": "Bez żadnych poważniejszych skutków.",
      "torso": "Bez żadnych poważniejszych skutków.",
      "rightArm": "Bez żadnych poważniejszych skutków.",
      "leftArm": "Bez żadnych poważniejszych skutków.",
      "leg": "Bez żadnych poważniejszych skutków."
    }
  },
  {
    "sourceCode": "DAMAGE_S_L",
    "name": "Siniak",
    "description": "Bolesny siniec",
    "symbol": "S_L",
    "effectCode": "",
    "flatModifier": -15,
    "painModifier": -15,
    "locationDescriptions": {
      "head": "Bez żadnych poważniejszych skutków.",
      "torso": "Bez żadnych poważniejszych skutków.",
      "rightArm": "Bez żadnych poważniejszych skutków.",
      "leftArm": "Bez żadnych poważniejszych skutków.",
      "leg": "Bez żadnych poważniejszych skutków."
    }
  },
  {
    "sourceCode": "DAMAGE_S_C",
    "name": "Ciężki Siniak",
    "description": "Duży, bolesny, krwawiący guz, pęknięcia kości.",
    "symbol": "S_C",
    "effectCode": "",
    "flatModifier": -30,
    "painModifier": -60,
    "locationDescriptions": {
      "head": "Piekąca blizna, zdarta skóra",
      "torso": "Ból przy czynnościach wymagających elastyczności; blizna.",
      "rightArm": "Ból przy czynnościach wymagających wysiłku ręki; blizna",
      "leftArm": "Ból przy czynnościach wymagających wysiłku ręki; blizna",
      "leg": "Urażona noga boli; czasem ranny gubi krok."
    }
  },
  {
    "sourceCode": "DAMAGE_S_K",
    "name": "Krytyczny Siniak",
    "description": "Rana krytyczna to taka, przy której felczer już ci nie pomoże. Bez natychmiastowej pomocy postać umiera.",
    "symbol": "S_K",
    "effectCode": "EFFECT_DEATH",
    "flatModifier": -160,
    "painModifier": -160,
    "locationDescriptions": {
      "head": "Zmasakrowana twarz; utrudnione jedzenie.",
      "torso": "Zwolnione poruszanie się; niezdolność do biegania; ręka odruchowo zasłania zranione miejsce.",
      "rightArm": "Nagłe omdlenia ręki; gwałtowne l silne bóle, sztywność; niezdolność do precyzyjnych czynności manualnych.",
      "leftArm": "Nagłe omdlenia ręki; gwałtowne l silne bóle, sztywność; niezdolność do precyzyjnych czynności manualnych.",
      "leg": "Spowolnione chodzenie; bezustanny ból; niewładna kończyna."
    }
  }
];

export const attackDefinitions = [
  {
    "sourceCode": "ATTACK_SNIPER",
    "name": "Strzał snajperski",
    "symbol": "R",
    "description": "Strzał snajperski: Karabiny mają niezły zasięg, trzeba to przyznać. Jeśli dobrze przymierzysz, a nie używałeś swojego karabinu jako maczugi do walki z mutkami i lufa nie jest pokrzywlona, to przy sporej dawce talentu i umiejętności, możesz trafić gostka na przysłowiowym horyzoncie.\r\n\r\nTaki strzał oddajesz w spokoju, bez pośpiechu. Dokładnie mierzysz, czekasz l strzelasz. Strzał snajperski oddaJesz bez pieprzenia o turach czy segmentach. Po prostu masz chwilę spokoju i nie podoba ci clę koleś łażący gdzieś daleko (pewnie nawet nie wie. że tu Jesteś) - możesz spróbować.\r\n\r\nI wiesz co, najlepiej załatw sobie celownik optyczny. Nie będzie za ciebie strzelał, ale może pomóc, bo +40% do testu może przesądzić sprawę. Szczególnie, jeśli umiesz go obsługiwać (patrz Sztuczka \"Snajper\"). Przy bardzo dalekich strzałach MG może dodatkowo zażądać testu Percepcji.\r\n\r\nJeśli zaś chcesz na zimno przymierzyć przez lunetkę do gościa w trakcie walki, zajmle cl to całą jedną turę na samo mierzenie. Jeśli dodatkowo gość na ciebie biegnie z jakąś siekierą, jak najbardziej na miejscu będzie test Charakteru, czy nie wymiękniesz. Czasem zdarzy się tak, że nie wytrzymasz, powiesz sobie \"chrzanić lunetkę\" i po prostu wywalisz do gościa wszystko co masz, zanim clę dopadnle.\r\n"
  },
  {
    "sourceCode": "ATTACK_HIPFIRE",
    "name": "Strzał z biodra",
    "symbol": "H",
    "description": "Strzał z biodra: Gdy jakiś frajer zaskoczy rewolwerowca, może na własnej skórze poznać, o ile szybszy Jest strzał z biodra. Bez żadnego mierzenia, ot, wyrywasz spluwę z kabury i bez zbędnych ruchów gasisz gościa. Oczywiście, strzał taki Jest mniej celny. Wygląda to tak: w segmentach poświęconych na Dobycie (standardowo 2 segmenty) zmieści się jeszcze strzał. Do strzału trzeba doliczyć karę 60%. Strzał z biodra można wykonać tylko krótką i lekką bronią (pistolety. rewolwery)."
  },
  {
    "sourceCode": "ATTACK_SEMI",
    "name": "Strzał pojedyńczy",
    "symbol": "S",
    "description": "Testowanie akcji\n\nTestowanie k20: Każdą z akcji bojowych (strzelanie, rzucanie) w czasie walki testujemy używajqc 1k20, zamiast 3k20 jak w przypadku normalnych testów poza walką. Bez względu na to, ilu segmentowa jest akcja, aby ją przetestować, rzucasz tylko jedną k20.\n\nAby trafić w cel, wystarczy jeden sukces. Bohater musi zdać Przeciętny test odpowiedniej Umiejętności strzelania lub rzucania opartej na Zręczności. Różne okoliczności, jak odległość, widoczność, ruch, wielkość celu, osłony itp, utrudniqjq ten test.\n\nCelowanie: Za każdy dodatkowy segment poświęcony na strzał otrzymujesz dodatkową kość k20 do testu. Bez względu na to, iloma kośćmi rzucasz, nadal wystarczy uzyskać jeden sukces, by trafić w cel.\n\nUżywanie Umiejętności: W ciągu jednej tury możesz obniżyć wyniki na dowolnych z trzech kostek używanych w walce o tyle oczek, ile wynosi twoja odpowiednia Umiejętność walki. Walczący nie musi od razu decydować, czy i na które kości używa Umiejętności, może to zrobić w dowolnym segmencie. Jeśli chcesz użyć dwóch różnych Umiejętności w Jednej turze, wtedy wartość każdej z nich spada o połowę. Jeśli chcesz użyć trzech różnych Umiejętności w turze, wtedy każda z nich ma tylko 1/3 swojej normalnej wartości.\n\nPechowa 20-tka: Każda kość, na której w walce wypadnie 20 oznacza automatyczną porażkę na tej kości. Zasada ta dotyczy tylko wyników na kości, nie zaś wyników po zmodyfikowaniu (np. przez zastosowanie Umiejętności).\n\n\nPodwójne działanie Umiejętności walki. Walczący może użyć swoich punktów Umiejętności walki nie tylko po to by obniżyć oczka na swoich kościach, ale także po to by dodać oczka do kości przeciwnika. Dzięki temu kości, które są sukcesami, nagle mogą zostać zmienione przez przeciwnika w porażki. Lepiej trzymać w pogotowiu swoje punkty Umiejętności na taką ewentualność. Samo dodawanie oczek do kości przeciwnika jest zagraniem vabank, ponieważ skąd można wiedzieć, jak wysoką Zręczność ma przeciwnik. Punktów Umiejętności można używać w dowolnym segmencie tury.\n\nJeśli walczący osiągnął 3 sukcesy i deklaruje atak za 3s, zaś jego przeciwnik za pomocą swoich punktów Umiejętności \"psuje\" mu np 1 sukces, wtedy tamten zadaje cios za 2 sukcesy. Jeśli postać wyprowadza specjalną akcję za 3 sukcesy (np. dzięki Sztuczce), a przeciwnik \"popsuje” mu 1 sukces, wtedy postać zamiast tego wyprowadza standardową akcję za 2 sukcesy.\n\nTen, kto używa punktów Umiejętności do podwyższenia przeciwnikowi wyników na kościach, wybiera, którą konkretnie kość „psuje\"."
  },
  {
    "sourceCode": "ATTACK_AUTO",
    "name": "Strzał serią",
    "symbol": "A",
    "description": "Seria krótka:         1 segment, X kul\nSeria długa:         2 segmeny, 3X kul\nOgień ciągły:         3 segmeny, 6X kul\n\nEfekty serii: Każda kolejna kula z serii pogarsza osiągnięty wynik testu strzelania o 1 (ma to wpływ także na lokalizację trafienia). Czyli w cel wchodzi tyle pocisków, ile punktów sukcesu uzyskał gracz w teście strzelania (i jeszcze jedna kula dodatkowo, ponieważ test zdany \"na styk\" również oznacza trafienie). Oczywiście, trafień nie może być więcej, niż kul wystrzelonych w serii. Każda kula, która dosięgła celu, zadaje osobną ranę.\n\nKorygowanie I przenoszenie ognia: Długie serie mają to do siebie, te nawet jak nie trafisz pierwszą kulą, to możess przeciągnąć po gościu kolejnymi, czasem nawet po kilku gościach, aż w końcu będą podskakiwać l padać Jak ścięte zboże. Nie Jest to łatwe, ale się da.\n\nKorygowanie ognia: Gdy walisz w gościa 12 kul i nie trafiłeś, ważne jest o lie nie trafiłeś, bo kosztem 3 kul możesz odrobić 1 Punkt Porażki. Jeśli miałeś\n\nrzucić poniżej lub równo z 10, a wypadło 12. niby nie trafiłeś. Ok, nic straconego, zobaczmy, co się z tym da zrobić. Wystrzeliłeś 12 kuł, a do sukcesu zabrakło ci 2 punkty na kostce. Wysil się więc i pociągnij serię\nw stronę celu: tracisz 3 kule i już brakuje ci tylko 1 punktu na kostce. Tracisz następne 3 kule i Jesteś na zerze, to trafienie „na styki\". Dzięki temu kolejna kula wchodzi w cel. Niestety, broń, dalej ucieka i następna kula będzie o 1 punkt mniej celna, czyli nie trafi, więc znowu poprawka. 3 kule i znowu Jesteś na zerze! I znowu kolejna wchodzi!\n\nW skrócie wygląda to tak. 3 kule na poprawkę, 1 wchodzi, 3 na poprawkę. 1 wchodzi- Proste? Jeszcze jedno: korygować można oczywiście nie tylko serie nlecelne, ale i te całkiem dobre. Jeśli wywaliłeś długą serię i trafiłeś, ale niezbyt dobrze i seria zbyt szybko zeszła z celu, możesz ją skorygować w identyczny sposób.\n\nPrzenoszenie ognia: W podobny sposób możesz przenosić ogień z Jednego gościa na Innego, a nawet skosić kilku przeciwników jedną serią. Za każdym razem, gdy chcesz przenieść ogień tej samej serii na inny cel, nie wykonujesz nowego testu, a jedynie MG przydzieli cl dla niego automatyczne Punkty Porażki, które musisz odrobić. Jeśli cele są blisko siebie, będzie to 1 lub 2 PP. Można założyć, że za każde 5 stopni. o Jakie musisz przeciągnąć lufę w bok. dostajesz 1 PP.\n\nPamiętaj, że jeśli kolejny cel jest trudniejszy do trafienia (np jest ukryty, klęczy, leży biegnie ltd.), wzrasta PT trafienia, co znaczy, że możesz otrzymać dodatkowe Punkty Porażki.\n\nWymagania: Aby skorygować łub przenieść ogień serii z broni maszynowej, potrzeba odpowiedniej Budowy l Umiejętności. Zsumuj swoją Budowę 1 Umiejętność Broń maszynowa Możesz skorygować serię maksymalnie o tyle punktów, o Ile ta suma przekroczyła wymaganą dlu broni Budowę.\n"
  },
  {
    "sourceCode": "ATTACK_BUCK",
    "name": "Strzał śrutem",
    "symbol": "V",
    "description": "Strzał ze śrutówki nie wymaga od strzelca zbyt wiele. Bach - i chmura kulek zmiata wszystko, co stanęło ci na drodze. A oto, co mówią o śrutówkach reguły: \r\nDo 2 metrów strzał ze śrutówki zadaje ranę Krytyczną oraz Draśnięcia. \r\nDo 5 metrów strzał ze śrutówki zadaje ranę Ciężką oraz Draśnięcia. \r\nDo 20 metrów strzał ze śrutówki zadaje tylko Draśnięcia. \r\nTrafienie śrutem powoduje tyle Draśnięć, ile strzelec osiągnął Punktów Sukcesu. \r\nLokacja draśnięć: Pierwsze Draśnięcie w normalny sposób, tzn. zgodnie z wynikiem na kostce. Dla każdego kolejnego trafienia należy zmniejszyć ten wynik o 1. Śrutówki nie posiadają w ogóle punktów Przebicia Pancerza."
  },
  {
    "sourceCode": "ATTACK_MULTI_TRIGGER",
    "name": "Strzał wieloma spustami",
    "symbol": "T",
    "description": "Ta giwera ma więcej niż jeden spust, pozwalając wykonać tyle strzałów pojedynczych w jednym segmencie, ile ma spustów. Rzucasz Przeciętny test Zręczności na to czy udało ci się wcisnąć tyle spustów ile chciałeś."
  },
  {
    "sourceCode": "ATTACK_PROJECTILE",
    "name": "Trafienie pociskiem",
    "symbol": "O",
    "description": "Rzut granatem: do 10m 0%, powyżej 10m utruenienie równe jest odległości w metrach pomnożonej przez 3. Zależnie od Budowy rzucającego, utrudnienie się zmniejsza. Budowa od 12 do 14 = -10%, Budowa do 16 = -20%, Budowa powyżej 16 = -30%. Nie zdany rzut testu granatem oznacza, że cel nie trafiony został bezpośrednio. Do 10 metrów każdy punkt porażki w teście oznacza jeden metr, o jaki rzucający spudłował. Przy odległości do 20m należy pomnożyć to razy 30, do 30m razy 3... itd."
  },
  {
    "sourceCode": "ATTACK_BURST",
    "name": "Seria",
    "symbol": "B",
    "description": "Pukawka którą trzymasz oddaje 3-strzałowe serie. "
  },
  {
    "sourceCode": "ATTACK_OVERWATCH",
    "name": "Przygotowany strzał",
    "symbol": "P",
    "description": "Przygotowany strzał. Popatrz, taka sytuacja: jeden kolo siedzi w ruinach i ma pistolet. Drugi kolo leży w okopie i też ma pistolet,. Postrzelali do siebie trochę, kule poświstały im koło uszu i brakło im werwy, schowali się obaj. W końcu jeden z nich odważył się wychylić. Uff, nie ma tamtego. Mówi sobie: Dobra, to teraz sobie na niego poczekam. Kładzie się płasko na ziemi, celuje w miejsce, skąd tamten lada chwila się wychyli i... czeka\r\n\r\nZa tak przygotowany strzał dostajesz premię - \"zamrożone\" 2 segmenty. Gdy tamten się w końcu\r\n\r\nwychyli, możesz Jako pierwszy wykorzystać swoje segmenty. A potem dopiero rozpoczyna się normalna tura.\r\n\r\nWycelowanie broni i przygotowanie strzału nie oznacza bynajmniej kontrolowania całego otoczenia a jedynie fragmentu - około 45 stopni w wybranym kierunku. Można zwiększyć ten zakres do 90 stopni, ale wtedy „zamrożony” będzie Już tylko 1 segment (postać lustruje większy teren).\r\n\r\nWarunkiem oddania przygotowanego strzału Jest udane wypatrzenie wychylającego się przeciwnika Zaś \"zamrożone\" segmenty można poświęcić np. właśnie na próby wypatrywania.\r\n"
  },
  {
    "sourceCode": "MANEUVER_ZWIEKSZONETEMPO",
    "name": "Manewr Zwiększone Tempo",
    "symbol": "M_ZT",
    "description": "Walczący, który posiada Inicjatywę, może zdecydować się na zwiększenie tempa walki. Podnosi PT własnych testów akcji, a jego przeciwnik będzie musiał zdawać testy na tym samym, podwyższonym PT. Walczący może zwiększyć PT maksymalnie o tyle poziomów, ile posiada punktów używanej Umiejętności walki (Bijatyka lub Broń ręczna) i nie więcej niż 3. Decyzję o zastosowaniu manewru trzeba podjąć na samym początku każdej tury. Jeszcze przed rzutem kośćmi.Nie można łączyć manewrów."
  },
  {
    "sourceCode": "MANEUVER_SZARŻA",
    "name": "Manewr Szarża",
    "symbol": "M_S",
    "description": "Szarżę można zastosować na początku walki, podczas sprawdzania Inicjatywy testowanej na Zręczności. Walczący otrzymuje bonus od +1 do +3 do Zręczności podczas testu Inicjatywy, ale w przypadku przegranej (w stosunku do swojego przeclwnika) otrzymuje identyczną karę do Zręczności na czas pierwszej tury. Nie może w niej użyć żadnych defensywnych manewrów.. Decyzję o zastosowaniu manewru trzeba podjąć na samym początku każdej tury. Jeszcze przed rzutem kośćmi.Nie można łączyć manewrów."
  },
  {
    "sourceCode": "MANEUVER_FURIA",
    "name": "Manewr Furia",
    "symbol": "M_F",
    "description": "Walczący otrzymuje bonus +2 do Zręczności w ataku, ale każde przejęcie Inicjatywy przez przeciwnika jest jednocześnie celnym ciosem. Decyzję o zastosowaniu manewru trzeba podjąć na samym początku każdej tury. Jeszcze przed rzutem kośćmi.Nie można łączyć manewrów."
  },
  {
    "sourceCode": "MANEUVER_PELNAOBRONA",
    "name": "Manewr Pełna Obrona",
    "symbol": "M_PO",
    "description": "Walczący otrzymuje bonus +2 do Zręczności w obronie, za to aby przejąć Inicjatywę, musi, poświęcić na to aż dwa sukcesy (czyli musi mieć przewagę 2 własnych sukcesów w obronie pod rząd przeciwko 2 porażkom przeciwnika w ataku). Decyzję o zastosowaniu manewru trzeba podjąć na samym początku każdej tury. Jeszcze przed rzutem kośćmi.Nie można łączyć manewrów."
  }
];

export const damageOptions = Object.fromEntries(
  damageDefinitions.map((definition) => [definition.symbol, definition.name])
);

export const damageNamesBySymbol = damageOptions;

export const attackNamesBySymbol = Object.fromEntries(
  attackDefinitions.map((definition) => [definition.symbol, definition.name])
);

// Jedna broń może mieć kilka kodów rozdzielonych przecinkami, np. „S,A”.
// Funkcja zamienia je na zrozumiałą dla użytkownika listę nazw.
export function describeAttackTypes(attackTypeCodes) {
  return String(attackTypeCodes ?? "")
    .split(",")
    .map((attackTypeCode) => attackTypeCode.trim())
    .filter(Boolean)
    .map((attackTypeCode) => attackNamesBySymbol[attackTypeCode] ?? attackTypeCode)
    .join(", ");
}

