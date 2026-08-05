/**
 * #143 Identity-generation prototype — curated name pools per country.
 *
 * THROWSAWAY PROTOTYPE (branch prototype/143-identity-generation). NOT production
 * code. Feeds decision #143 only; the real schema + generateRoster wiring lands
 * in a later LID pass once this map is clear.
 *
 * Structure follows research/name-country-generation.md (Section G):
 *   { code, display, flag, weight, given[], family[] }
 * Pick countryCode FIRST (weighted), then draw given/family from that country's
 * pool → name & country consistent by construction.
 *
 * `weight` is the research doc's suggested v1 share (Section E). The "long tail"
 * (~0.05 combined: BR/PA/CO/NI…) is intentionally omitted for v1 and is a
 * decision point on the ticket — it can fold into a generic `es`/`en` pool later.
 *
 * Pools are deliberately MODEST (~30 each) for the rough first cut. Repetition at
 * league scale (~200 players) is the thing to react to — if it's jarring, pools
 * grow (no schema cost). See README → "Open decisions".
 *
 * Given names are male-leaning because baseball rosters are male; gender handling
 * is itself an open decision (#142 flagged it).
 */

export interface CountryPool {
  code: string; // ISO 3166-1 alpha-2
  display: string;
  flag: string;
  weight: number;
  given: string[];
  family: string[];
}

const US: CountryPool = {
  code: 'US',
  display: 'United States',
  flag: '🇺🇸',
  weight: 0.55,
  given: ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles', 'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kenneth', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan', 'Jacob', 'Gary', 'Nicholas', 'Eric', 'Jonathan', 'Stephen', 'Justin', 'Brandon', 'Benjamin', 'Samuel', 'Gregory'],
  family: ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'],
};

const DO: CountryPool = {
  code: 'DO',
  display: 'Dominican Republic',
  flag: '🇩🇴',
  weight: 0.10,
  given: ['Juan', 'Jose', 'Pedro', 'Rafael', 'Carlos', 'Luis', 'Miguel', 'Angel', 'Robinson', 'Starling', 'Vladimir', 'Franchy', 'Eloy', 'Wander', 'Fernando', 'Sandy', 'Jorge', 'Edwin', 'Manny', 'Albert', 'Adrian', 'Nelson', 'Hanley', 'Bartolo', 'Yordan', 'Ronald', 'Julio', 'Oneil', 'Jeimer', 'Gregory', 'Marcell', 'Ketel', 'Ariel', 'Yoenis', 'Wily', 'Esteban', 'Raul', 'Felipe', 'Aramis', 'Placido'],
  family: ['Reyes', 'Martinez', 'Fernandez', 'Rodriguez', 'Perez', 'Sanchez', 'Ramirez', 'Gonzalez', 'Pena', 'Castillo', 'Mejia', 'Tejada', 'Bautista', 'Pujols', 'Ortiz', 'Beltre', 'Cano', 'Soto', 'Guerrero', 'Alcantara', 'Nunez', 'Rosario', 'Encarnacion', 'Soriano', 'Polanco', 'Cabrera', 'Valdez', 'Franco', 'Adames', 'Munoz', 'Santana', 'Abreu', 'Feliz', 'Liriano', 'Nova', 'Familia', 'Ozuna', 'Marichal', 'Cueto', 'Bonifacio'],
};

const VE: CountryPool = {
  code: 'VE',
  display: 'Venezuela',
  flag: '🇻🇪',
  weight: 0.06,
  given: ['Jose', 'Carlos', 'Luis', 'Miguel', 'Eduardo', 'Pablo', 'Felix', 'Salvador', 'Martin', 'Asdrubal', 'Elvis', 'Omar', 'Victor', 'Ronald', 'Maiker', 'Gleyber', 'Eugenio', 'Rougned', 'Andres', 'Alcides', 'Wilson', 'Ramond', 'Marco', 'Yonder', 'Ezequiel', 'Hernan', 'Jose Altuve', 'Magneuris', 'Raimel', 'Touki', 'Giovanny', 'Erik', 'Yoervis', 'Alberto', 'Cesar', 'Ender', 'Rangel', 'Jesus', 'Yeltsin', 'Thairo'],
  family: ['Gonzalez', 'Rodriguez', 'Garcia', 'Perez', 'Martinez', 'Hernandez', 'Lopez', 'Sanchez', 'Ramirez', 'Torres', 'Jimenez', 'Moreno', 'Blanco', 'Alvarez', 'Romero', 'Diaz', 'Aguilar', 'Cabrera', 'Gallegos', 'Machado', 'Sucre', 'Maldonado', 'Velazquez', 'Colmenares', 'Rondon', 'Gomez', 'Rivero', 'Altuve', 'Galarraga', 'Vizquel', 'Guillen', 'Castro', 'Perez', 'Iribarren', 'Flores', 'Berti', 'Prado', 'Inciarte', 'Sandoval', 'Pirela'],
};

const CU: CountryPool = {
  code: 'CU',
  display: 'Cuba',
  flag: '🇨🇺',
  weight: 0.04,
  given: ['Jose', 'Luis', 'Carlos', 'Miguel', 'Jorge', 'Yoenis', 'Yulieski', 'Lourdes', 'Yoan', 'Adolis', 'Aroldis', 'Yadiel', 'Yoanner', 'Alfredo', 'Yasmany', 'Erisbel', 'Odrisamer', 'Raidel', 'Yasiel', 'Alexei', 'Leonys', 'Kendrys', 'Henry', 'Yandy', 'Andy', 'Rusney', 'Osvaldo', 'Defrancisco', 'Liván', 'José Dariel', 'Yoelkis', 'Roenis', 'Omar', 'Yuniesky', 'Frederich', 'Pedro', 'Ichiro', 'Mayki', 'Eriel', 'Robert'],
  family: ['Rodriguez', 'Gonzalez', 'Perez', 'Martinez', 'Garcia', 'Hernandez', 'Lopez', 'Sanchez', 'Ramirez', 'Torres', 'Diaz', 'Gomez', 'Castro', 'Ruiz', 'Romero', 'Alvarez', 'Navarro', 'Iglesias', 'Abreu', 'Cespedes', 'Chapman', 'Gurriel', 'Robert', 'Arraez', 'Moncada', 'Gallardo', 'Despaigne', 'Leyva', 'Mesa', 'Urrutia', 'Gourriel', 'Boric', 'Espinosa', 'Hechevarria', 'Cepeda', 'Mayeta', 'Vargas', 'Lazo', 'Pacheco', 'Díaz'],
};

const PR: CountryPool = {
  code: 'PR',
  display: 'Puerto Rico',
  flag: '🇵🇷',
  weight: 0.04,
  given: ['Francisco', 'Carlos', 'Javier', 'Jorge', 'Jose', 'Luis', 'Miguel', 'Angel', 'Eddie', 'Roberto', 'Ivan', 'Bernie', 'Juan', 'Yadier', 'Enrique', 'Edwin', 'Kike', 'Javy', 'Michael', 'Emmanuel', 'Vimael', 'Yadi', 'Marcus', 'Kelvin', 'Jeremy', 'Roberto', 'Jose', 'Edgardo', 'Carlos', 'Reymond', 'Mario', 'Hector', 'Yoshitada', 'Jovani', 'Ricardo', 'Jacob', 'Nelson', 'Henry', 'Juan', 'Orlando'],
  family: ['Rivera', 'Torres', 'Rodriguez', 'Gonzalez', 'Perez', 'Martinez', 'Lopez', 'Hernandez', 'Sanchez', 'Ramirez', 'Ortiz', 'Colon', 'Baez', 'Correa', 'Lindor', 'Vazquez', 'Molina', 'Beltran', 'Posada', 'Alomar', 'Delgado', 'Cordero', 'Rosario', 'Vega', 'Cruz', 'Figueroa', 'Negron', 'Rios', 'Padilla', 'Pagan', 'Rondon', 'Berrios', 'Clemente', 'Candelario', 'Hernandez', 'Votto', 'Devers', 'Kike', 'Vazquez', 'Voth'],
};

const MX: CountryPool = {
  code: 'MX',
  display: 'Mexico',
  flag: '🇲🇽',
  weight: 0.05,
  given: ['Juan', 'Jose', 'Luis', 'Carlos', 'Miguel', 'Jorge', 'Pedro', 'Jesus', 'Antonio', 'Manuel', 'Francisco', 'Rafael', 'Eduardo', 'Fernando', 'Roberto', 'Alejandro', 'Daniel', 'Ricardo', 'Arturo', 'Sergio', 'Andres', 'Mario', 'Hector', 'Raul', 'Pablo', 'Marco', 'Vicente', 'Esteban', 'Ignacio', 'Oscar', 'Julio', 'Cesar', 'Gerardo', 'Domingo', 'Emilio', 'Ramon', 'Gustavo', 'Alberto', 'Adrian', 'Tomas'],
  family: ['Hernandez', 'Garcia', 'Lopez', 'Gonzalez', 'Perez', 'Rodriguez', 'Martinez', 'Sanchez', 'Ramirez', 'Cruz', 'Flores', 'Gomez', 'Morales', 'Ortiz', 'Ruiz', 'Reyes', 'Moreno', 'Jimenez', 'Alvarez', 'Castillo', 'Vargas', 'Castro', 'Rivera', 'Mendez', 'Guerrero', 'Mendoza', 'Rios', 'Valdez', 'Urias', 'Montoya', 'Galindo', 'Robles', 'Cervantes', 'Espinoza', 'Aguilar', 'Delgado', 'Galvan', 'Solis', 'Terrazas', 'Cano'],
};

const CA: CountryPool = {
  code: 'CA',
  display: 'Canada',
  flag: '🇨🇦',
  weight: 0.03,
  given: ['James', 'John', 'Michael', 'William', 'David', 'Robert', 'Thomas', 'Christopher', 'Daniel', 'Matthew', 'Ryan', 'Jacob', 'Nicholas', 'Ethan', 'Logan', 'Liam', 'Lucas', 'Benjamin', 'Noah', 'Jack', 'Oliver', 'Owen', 'Nathan', 'Connor', 'Justin', 'Tyler', 'Mathieu', 'Jean-Francois', 'Pierre', 'Marc', 'Etienne', 'Olivier', 'Francois', 'Antoine', 'Philippe', 'Gabriel', 'Simon', 'Julien', 'Maxime', 'Alexandre'],
  family: ['Smith', 'Brown', 'Tremblay', 'Gagnon', 'Roy', 'Cote', 'Bouchard', 'Gauthier', 'Morin', 'Lavoie', 'Fortin', 'Gagne', 'Belanger', 'Lefebvre', 'Bergeron', 'Leblanc', 'MacDonald', 'Campbell', 'Martin', 'Taylor', 'Wilson', 'Johnson', 'Thomson', 'Anderson', 'Murphy', "O'Brien", 'Walsh', 'Pelletier', 'Beliveau', 'Carter', 'Stewart', 'Reid', 'Mitchell', 'Beaulieu', 'Savard', 'Carrier', 'Bouchard', 'Dube', 'Landry', 'Hamel'],
};

const JP: CountryPool = {
  code: 'JP',
  display: 'Japan',
  flag: '🇯🇵',
  weight: 0.04,
  given: ['Haruto', 'Ren', 'Hinata', 'Yuto', 'Sota', 'Yuki', 'Hiroto', 'Minato', 'Sora', 'Kaito', 'Riku', 'Yamato', 'Daiki', 'Ryusei', 'Sho', 'Tatsuki', 'Tsubasa', 'Issa', 'Eita', 'Koki', 'Tomohiro', 'Aoi', 'Itsuki', 'Kazuki', 'Naoki', 'Takumi', 'Yusuke', 'Daisuke', 'Ichiro', 'Hideki', 'Shohei', 'Masahiro', 'Yu', 'Kenta', 'Roki', 'Munetaka', 'Yoshio', 'Taisei', 'Hotaka', 'Kazuma'],
  family: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Saito', 'Shimizu', 'Yamazaki', 'Mori', 'Abe', 'Ikeda', 'Hashimoto', 'Ishikawa', 'Ogawa', 'Endo', 'Fujita', 'Maeda', 'Murakami', 'Nishimura', 'Nakagawa', 'Kaneko', 'Ohtani', 'Ueahara', 'Darvish', 'Kuroda', 'Matsui', 'Iguchi'],
};

const KR: CountryPool = {
  code: 'KR',
  display: 'Korea',
  flag: '🇰🇷',
  weight: 0.03,
  given: ['Min-jun', 'Seo-jun', 'Do-yoon', 'Joo-won', 'Ha-jun', 'Eun-woo', 'Si-woo', 'Joon-woo', 'Ji-ho', 'Ye-jun', 'Ha-neul', 'Tae-yang', 'Jae-hyun', 'Hyun-woo', 'Ji-hun', 'Sung-ho', 'Jung-ho', 'Hyun-jin', 'Ha-seong', 'Ji-man', 'Byung-ho', 'Kwang-hyun', 'Shin-soo', 'Seung-hwan', 'Dae-ho', 'Jung-hoo', 'Bo-mi', 'Tae-kyun', 'Won-jun', 'Jae-young', 'Su-bin', 'Min-jae', 'Young-bin', 'Kyu-min', 'Jae-won', 'Hyun-soo', 'Jin-man', 'Ho-jin', 'Sang-mu', 'Tae-in'],
  family: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Jang', 'Lim', 'Han', 'Oh', 'Seo', 'Shin', 'Kwon', 'Hwang', 'Ahn', 'Song', 'Yoo', 'Hong', 'Jeon', 'Moon', 'Bae', 'Back', 'Heo', 'Sim', 'Sohn', 'Ryu', 'Baek', 'Nam', 'Yang', 'Joo', 'Ko', 'Yuk', 'Go', 'Sohn', 'Jang', 'Lim', 'Rhee', 'Huh'],
};

const TW: CountryPool = {
  code: 'TW',
  display: 'Taiwan',
  flag: '🇹🇼',
  weight: 0.01,
  given: ['Wei', 'Jia', 'Ming', 'Jun', 'Hao', 'Yu', 'Chen', 'Hsin', 'Lun', 'Che', 'Te', 'Hung', 'Yu-Chen', 'Chun-Hsien', 'Chih-Wei', 'Po-Jung', 'Wei-Chen', 'Hung-Chih', 'Chien-Ming', 'Wei-Yin', 'Yu-Chang', 'Cheng', 'Liang', 'Chia', 'Hsuan', 'Ting', 'An', 'Chun', 'Kai', 'Yung', 'Sheng', 'Chao', 'Pang', 'Teng', 'Hsu', 'Kuo', 'Tsai', 'Liu', 'Lin', 'Wang'],
  family: ['Chen', 'Lin', 'Huang', 'Chang', 'Li', 'Wang', 'Wu', 'Liu', 'Tsai', 'Yang', 'Hsu', 'Cheng', 'Tseng', 'Kuo', 'Chiu', 'Chien', 'Yu', 'Sung', 'Ma', 'Fan', 'Chao', 'Hou', 'Tang', 'Shen', 'Chu', 'Chung', 'Cheng', 'Fang', 'Tien', 'Lo', 'Tong', 'Hsiao', 'Kang', 'Pan', 'Lai', 'Yen', 'Sun', 'Chin', 'Liang', 'Pan'],
};

export const COUNTRIES: CountryPool[] = [US, DO, VE, CU, PR, MX, CA, JP, KR, TW];
