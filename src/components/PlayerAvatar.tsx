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
      {playerId && (
        <img
          src={`https://cdn.nba.com/headshots/nba/latest/260x190/${playerId}.png`}
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
