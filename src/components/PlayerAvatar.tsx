const nbaPlayerIds: Record<string, string> = {
  "stephen curry": "201939",
  "victor wembanyama": "1641705",
  "shai gilgeous-alexander": "1628983",
  "anthony edwards": "1630162",
  "luka doncic": "1629029",
  "nikola jokic": "203999",
  "jayson tatum": "1628369",
  "paul george": "202331",
  "cade cunningham": "1630595",
  "josh hart": "1628404",
  "lebron james": "2544",
  "kevin durant": "201142",
  "giannis antetokounmpo": "203507",
  "jalen brunson": "1628973",
  "trae young": "1629027",
  "joel embiid": "203954",
  "devin booker": "1626164",
  "kawhi leonard": "202695",
  "donovan mitchell": "1628378",
  "lamelo ball": "1630163",
  "tyrese haliburton": "1630169",
  "paolo banchero": "1631094",
  "scottie barnes": "1630567",
  "ja morant": "1629630",
  "zion williamson": "1629627",
  "kyrie irving": "202681",
  "james harden": "201935",
  "karl-anthony towns": "1626157",
  "bam adebayo": "1628389",
  "demar derozan": "201942",
  "tyrese maxey": "1630178",
  "jaylen brown": "1627759",
  "anfernee simons": "1629014",
  "jamal murray": "1627750",
  "jaden mcdaniels": "1630183",
  "darius garland": "1629636",
  "jarrett allen": "1628386",
  "mikal bridges": "1628969",
  "damian lillard": "203081",
  "chet holmgren": "1631096",
  "jalen williams": "1631114",
  "jalen green": "1630224",
  "alperen sengun": "1630578",
  "franz wagner": "1630532",
  "brandon ingram": "1627742",
  "derrick white": "1628401",
  "jrue holiday": "201950",
  "julius randle": "203944",
  "rj barrett": "1629629",
  "desmond bane": "1630217",
  "evan mobley": "1630596",
  "jaren jackson jr": "1628991",
  "fred vanvleet": "1627832",
  "naz reid": "1629675",
  "daniss jenkins": "1642450",
  "luguentz dort": "1629652",
  "jamal shead": "1642347",
  "kelel ware": "1642276",
  "darryn peterson": "1643408",
  "ausar thompson": "1641709",
  "dylan harper": "1642844",
  "keldon johnson": "1629640",
  "payton pritchard": "1630202",
  "ajay mitchell": "1642349",
  "og anunoby": "1628384",
  "jalen duren": "1631105",
  "jaime jaquez": "1631170",
  "nickeil alexander-walker": "1629638",
  "domantas sabonis": "1627734",
  "amen thompson": "1641708",
  "alex sarr": "1642259",
  "anthony davis": "203076",
  "draymond green": "203110",
  "duncan robinson": "1629130",
  "grayson allen": "1628960",
  "jabari smith jr": "1631095",
  "jaime jaquez jr": "1631170",
  "jalen johnson": "1630552",
  "kasparas jakucionis": "1642857",
  "lauri markkanen": "1628374",
  "pascal siakam": "1627783",
  "rui hachimura": "1629060",
  "zach lavine": "203897",
  "caleb wilson": "1643410",
  "vj edgecombe": "1642845",
  "dean wade": "1629731",
  "kentavious caldwell-pope": "203484",
  "paul reed": "1630194",
  "john collins": "1628381",
  "kevin huerter": "1628989",
  "dyson daniels": "1630700",
  "onyeka okongwu": "1630168",
  "cj mccollum": "203468",
  "aaron wiggins": "1630598",
  "kingston flemings": "espn:5149077",
  "neemias queta": "espn:4397424",
  "chaney johnson": "espn:5174655",
  "dayron sharpe": "espn:4432194",
  "egor demin": "espn:5175643",
  "keon ellis": "espn:4702177",
  "michael porter jr": "espn:4278104",
  "mikel brown jr": "espn:5101761",
  "noah clowney": "espn:4712896",
  "nolan traore": "espn:5279130",
  "brandon miller": "espn:4433287",
  "dennis schroder": "espn:3032979",
  "moussa diabate": "espn:4433249",
  "sion james": "espn:4602025",
  "jalen smith": "espn:4397189",
  "josh giddey": "espn:4871145",
  "matas buzelis": "espn:4711294",
  "norman powell": "espn:2595516",
  "jaylon tyson": "espn:4683747",
  "meleek thomas": "espn:5041951",
  "peyton watson": "espn:4576087",
  "sam merrill": "espn:4066757",
  "cooper flagg": "espn:5041939",
  "daniel gafford": "espn:4278049",
  "max christie": "espn:4432582",
  "naji marshall": "espn:4278594",
  "pj washington": "espn:4278078",
  "zaccharie risacher": "espn:5211175",
  "aaron gordon": "espn:3064290",
  "cameron johnson": "espn:3138196",
  "christian braun": "espn:4431767",
  "trevon brazile": "espn:4698719",
  "brandin podziemski": "espn:4709138",
  "deanthony melton": "espn:4066436",
  "gui santos": "espn:4997536",
  "yaxel lendeborg": "espn:5175737",
  "marcus smart": "espn:2990992",
  "reed sheppard": "espn:4711272",
  "tari eason": "espn:4433192",
  "aaron nesmith": "espn:4396909",
  "andrew nembhard": "espn:4395712",
  "ivica zubac": "espn:4017837",
  "jarace walker": "espn:5106060",
  "jay huff": "espn:4065731",
  "kelly oubre jr": "espn:3133603",
  "obi toppin": "espn:4278355",
  "quenton jackson": "espn:4592829",
  "brook lopez": "espn:3448",
  "derrick jones jr": "espn:3936099",
  "isaiah jackson": "espn:4432170",
  "keaton wagler": "espn:5254165",
  "kobe sanders": "espn:4702352",
  "kris dunn": "espn:2991139",
  "max strus": "espn:4065778",
  "austin reaves": "espn:4066457",
  "jake laravia": "espn:4592691",
  "matisse thybulle": "espn:3907498",
  "quentin grimes": "espn:4397014",
  "sandro mamukelashvili": "espn:4278580",
  "walker kessler": "espn:4433136",
  "ziaire williams": "espn:4433137",
  "cameron boozer": "espn:5041935",
  "cedric coward": "espn:4903027",
  "jaylen wells": "espn:5112087",
  "jerami grant": "espn:2991070",
  "ty jerome": "espn:4065733",
  "andrew wiggins": "espn:3059319",
  "bobby portis": "espn:3064482",
  "davion mitchell": "espn:4278053",
  "klay thompson": "espn:6475",
  "pelle larsson": "espn:4601025",
  "kyle kuzma": "espn:3134907",
  "myles turner": "espn:3133628",
  "ryan rollins": "espn:4591725",
  "tyler herro": "espn:4395725",
  "ayo dosunmu": "espn:4397002",
  "jonathan kuminga": "espn:4433247",
  "rudy gobert": "espn:3032976",
  "terrence shannon jr": "espn:4432847",
  "dejounte murray": "espn:3907497",
  "derik queen": "espn:4869780",
  "herbert jones": "espn:4277813",
  "jeremiah fears": "espn:5144091",
  "saddiq bey": "espn:4397136",
  "trey murphy iii": "espn:4397688",
  "landry shamet": "espn:3914044",
  "isaiah hartenstein": "espn:4222252",
  "jared mccain": "espn:4683778",
  "anthony black": "espn:4712849",
  "jalen suggs": "espn:4432165",
  "jase richardson": "espn:5239561",
  "tristan da silva": "espn:4702382",
  "wendell carter jr": "espn:4277847",
  "collin gillespie": "espn:4278585",
  "dillon brooks": "espn:3155526",
  "khaman maluach": "espn:5203685",
  "miles bridges": "espn:4066383",
  "deni avdija": "espn:4683021",
  "donovan clingan": "espn:5105565",
  "scoot henderson": "espn:4683678",
  "sidy cissoko": "espn:5081727",
  "toumani camara": "espn:4431736",
  "darius acuff jr": "espn:5142620",
  "deandre hunter": "espn:4065732",
  "keegan murray": "espn:4594327",
  "precious achiuwa": "espn:4431679",
  "deaaron fox": "espn:4066259",
  "devin vassell": "espn:4395630",
  "julian champagnie": "espn:4592479",
  "stephon castle": "espn:4845367",
  "collin murray-boyles": "espn:5093267",
  "immanuel quickley": "espn:4395724",
  "jakobe walter": "espn:4684272",
  "jakob poeltl": "espn:3134908",
  "ace bailey": "espn:4873138",
  "jaxson hayes": "espn:4397077",
  "keyonte george": "espn:4433627",
  "aj dybantsa": "espn:5142718",
  "bilal coulibaly": "espn:5104155",
  "kyshawn george": "espn:5174563",
  "tre johnson": "espn:5238230",
};

function normalizePlayerName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function PlayerAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const playerId = nbaPlayerIds[normalizePlayerName(name)];
  const headshotUrl = playerId?.startsWith("espn:")
    ? `https://a.espncdn.com/i/headshots/nba/players/full/${playerId.slice(5)}.png`
    : playerId
      ? `https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`
      : undefined;
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  const sizeClass =
    size === "lg" ? "h-14 w-14" : size === "sm" ? "h-8 w-8" : "h-10 w-10";

  return (
    <span
      aria-hidden="true"
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-court-border bg-[#163875] font-semibold text-white ${sizeClass}`}
    >
      {headshotUrl && (
        <img
          src={headshotUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover object-top"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}
