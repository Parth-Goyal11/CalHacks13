"""Plain-language notes for the named stars and planets.

Distances are the figures astronomers usually quote. Nearby stars agree with
the Hipparcos parallax. Far supergiants are too distant for that parallax to
be trusted, so those notes use the accepted estimate instead.
"""

from __future__ import annotations

_STORIES = {
    "32349": {
        "constellation": "Canis Major",
        "distance": "8.6 light-years",
        "about": "Sirius is the brightest star in the night sky. It is the nose of Canis Major, the greater dog, and it is close enough that its light takes 8.6 years to reach us.",
        "facts": [
            "A faint white dwarf, Sirius B, orbits the bright star about once every 50 years.",
            "Its name comes from the Greek for scorching. In ancient Egypt its dawn rising marked the flooding of the Nile.",
        ],
    },
    "30438": {
        "constellation": "Carina",
        "distance": "about 310 light-years",
        "about": "Canopus is the second-brightest star in the night sky, a pale supergiant in Carina, the keel of the ship Argo. It never rises for most of the United States.",
        "facts": [
            "It is far more luminous than Sirius, and only looks slightly fainter because it is much farther away.",
            "Spacecraft use Canopus as a steady guide star.",
        ],
    },
    "71683": {
        "constellation": "Centaurus",
        "distance": "4.4 light-years",
        "about": "Rigil Kentaurus is Alpha Centauri, the closest star system to the Sun. To the eye it is one bright star in the Centaur, low in the far southern sky.",
        "facts": [
            "A telescope splits it into two Sun-like stars. A third member, Proxima Centauri, is the closest star of all and has planets.",
            "The name means the foot of the centaur.",
        ],
    },
    "69673": {
        "constellation": "Boötes",
        "distance": "37 light-years",
        "about": "Arcturus is an orange giant in Boötes, the herdsman, and the brightest star of the northern spring sky. Follow the curve of the Big Dipper’s handle and you land on it.",
        "facts": [
            "It has swollen and cooled as it ages. The Sun will go through a giant stage like this billions of years from now.",
            "It is moving through space faster than most of the bright stars around it.",
        ],
    },
    "91262": {
        "constellation": "Lyra",
        "distance": "25 light-years",
        "about": "Vega is the brightest star in Lyra, the harp. With Altair and Deneb it makes the Summer Triangle, high overhead on summer nights.",
        "facts": [
            "It was the north star about 12,000 years ago, and it will be again in about 12,000 years, as Earth’s axis slowly wobbles.",
            "Vega spins so fast that it is flattened, and it is wrapped in a disk of dust.",
        ],
    },
    "24608": {
        "constellation": "Auriga",
        "distance": "43 light-years",
        "about": "Capella is the bright yellow star in Auriga, the charioteer. It looks like a single star, but it is two giant stars orbiting so tightly that only special instruments can split them.",
        "facts": [
            "A second, much fainter pair of small red stars belongs to the same system, so Capella is four stars.",
            "It is circumpolar from much of the northern United States, so it never quite sets.",
        ],
    },
    "24436": {
        "constellation": "Orion",
        "distance": "about 860 light-years",
        "about": "Rigel is the blue-white star at Orion’s foot, usually the brightest star in the hunter. It is a supergiant, tens of thousands of times more luminous than the Sun.",
        "facts": [
            "Its light is so bright that it shines across most of the Orion nebula’s neighborhood.",
            "A small companion star sits close beside it.",
        ],
    },
    "37279": {
        "constellation": "Canis Minor",
        "distance": "11.5 light-years",
        "about": "Procyon is the bright star of Canis Minor, the lesser dog, and one of our nearer neighbors. Its name means before the dog, because it rises just ahead of Sirius.",
        "facts": [
            "A white dwarf orbits Procyon, the leftover core of a star that has already burned out.",
            "With Sirius and Betelgeuse it forms the Winter Triangle.",
        ],
    },
    "27989": {
        "constellation": "Orion",
        "distance": "about 550 light-years",
        "about": "Betelgeuse is the red star on Orion’s shoulder. It is a supergiant so large that, if it replaced the Sun, its edge would reach past the orbit of Mars.",
        "facts": [
            "It slowly swells and shrinks, so its brightness changes over months.",
            "It will end as a supernova. That is late in its life, not a prediction for our lifetime.",
        ],
    },
    "7588": {
        "constellation": "Eridanus",
        "distance": "about 140 light-years",
        "about": "Achernar is the end of Eridanus, the river, and one of the brightest stars of the far southern sky. It spins so fast that it is one of the flattest stars known.",
        "facts": [
            "From San Francisco it barely clears the southern horizon, and only at the right time of year.",
            "The name means the river’s end.",
        ],
    },
    "97649": {
        "constellation": "Aquila",
        "distance": "17 light-years",
        "about": "Altair is the bright star in Aquila, the eagle, and the southern corner of the Summer Triangle. It is a close, hot star that spins once in about ten hours.",
        "facts": [
            "That spin flattens Altair, just as it flattens Vega.",
            "It is one of the nearest stars you can see from a city.",
        ],
    },
    "21421": {
        "constellation": "Taurus",
        "distance": "65 light-years",
        "about": "Aldebaran is the orange eye of Taurus, the bull. It sits in front of the Hyades star cluster, which is farther away, so the cluster is a backdrop rather than Aldebaran’s home.",
        "facts": [
            "It is a giant star, cooler and much larger than the Sun.",
            "The name means the follower, because it follows the Pleiades across the sky.",
        ],
    },
    "65474": {
        "constellation": "Virgo",
        "distance": "about 250 light-years",
        "about": "Spica is the brightest star in Virgo, a blue-white pair so close together that they orbit every four days and cannot be split with an ordinary telescope.",
        "facts": [
            "Follow the arc of the Big Dipper’s handle through Arcturus and you come to Spica.",
            "The two stars pull each other into egg shapes.",
        ],
    },
    "80763": {
        "constellation": "Scorpius",
        "distance": "about 550 light-years",
        "about": "Antares is the red heart of Scorpius. The name means rival of Mars, because the two can look alike: both are bright and reddish.",
        "facts": [
            "It is a supergiant, among the largest stars you can see, with a much hotter companion star.",
            "The scorpion’s body curves south of Antares and ends in the stinger near Shaula.",
        ],
    },
    "37826": {
        "constellation": "Gemini",
        "distance": "34 light-years",
        "about": "Pollux is the brighter of the Gemini twins, an orange giant. Castor, the other twin, sits just above it.",
        "facts": [
            "A planet a little more than twice Jupiter’s mass orbits Pollux.",
            "Pollux is closer to us than Castor, so the twins are not a real pair in space.",
        ],
    },
    "113368": {
        "constellation": "Piscis Austrinus",
        "distance": "25 light-years",
        "about": "Fomalhaut is a solitary bright star low in the southern sky in autumn, the mouth of the southern fish. A wide disk of dust and rubble surrounds it.",
        "facts": [
            "The disk is a sign of a planetary system still being built.",
            "The name means the mouth of the fish.",
        ],
    },
    "102098": {
        "constellation": "Cygnus",
        "distance": "about 2,600 light-years",
        "about": "Deneb is the tail of Cygnus, the swan, and the faintest corner of the Summer Triangle only because it is enormously far away. It is one of the most luminous stars in the neighborhood of the Sun.",
        "facts": [
            "If Deneb were as close as Vega, it would cast shadows.",
            "It marks the top of the Northern Cross.",
        ],
    },
    "49669": {
        "constellation": "Leo",
        "distance": "79 light-years",
        "about": "Regulus is the heart of Leo, the star at the base of the sickle that looks like a backwards question mark. It spins so quickly that it is close to flying apart.",
        "facts": [
            "It is a multiple star: the bright one you see has faint companions.",
            "The Moon and the planets often pass near Regulus, because it lies close to the ecliptic.",
        ],
    },
    "36850": {
        "constellation": "Gemini",
        "distance": "51 light-years",
        "about": "Castor is the slightly fainter Gemini twin, just above Pollux. What looks like one star is six: three close pairs orbiting one another.",
        "facts": [
            "A small telescope splits the brightest pair.",
            "Castor and Pollux are similar in brightness but unrelated in space.",
        ],
    },
    "25336": {
        "constellation": "Orion",
        "distance": "about 250 light-years",
        "about": "Bellatrix is the blue star at Orion’s other shoulder, west of red Betelgeuse. The name means the female warrior.",
        "facts": [
            "It is much closer than the belt stars, so it only looks like part of the same figure.",
            "It is a hot giant, not a red supergiant like Betelgeuse.",
        ],
    },
    "26311": {
        "constellation": "Orion",
        "distance": "about 2,000 light-years",
        "about": "Alnilam is the middle star of Orion’s belt. It is a blue supergiant, far more distant than the hunter’s shoulders.",
        "facts": [
            "The three belt stars are not a cluster. They happen to line up as seen from Earth.",
            "Alnilam is the brightest of the three.",
        ],
    },
    "26727": {
        "constellation": "Orion",
        "distance": "about 1,260 light-years",
        "about": "Alnitak is the eastern star of Orion’s belt, the one nearest Betelgeuse. It is a tight triple star, and the dark Horsehead Nebula hangs just south of it.",
        "facts": [
            "The Horsehead is a cloud of dust silhouetted against glowing gas. It needs a dark sky.",
            "Alnitak’s light is blue-white.",
        ],
    },
    "25930": {
        "constellation": "Orion",
        "distance": "about 1,200 light-years",
        "about": "Mintaka is the western star of Orion’s belt. It sits almost on the celestial equator, so it rises due east and sets due west from everywhere on Earth.",
        "facts": [
            "It is a multiple star, with a wide companion that a small telescope can show.",
            "Because it is on the equator of the sky, it is a handy check of due east.",
        ],
    },
    "27366": {
        "constellation": "Orion",
        "distance": "about 650 light-years",
        "about": "Saiph is the blue-white star at Orion’s other foot, opposite Rigel. It looks fainter than Rigel but is the same kind of hot supergiant.",
        "facts": [
            "The name means sword, even though Saiph marks a knee in the usual figure.",
            "With Rigel, Betelgeuse, and Bellatrix it frames the hunter’s body.",
        ],
    },
    "11767": {
        "constellation": "Ursa Minor",
        "distance": "about 430 light-years",
        "about": "Polaris is the north star, the end of the handle of the Little Dipper. It stays almost still while the rest of the northern sky turns around it, and its height above the horizon is your latitude.",
        "facts": [
            "It is a Cepheid variable: a supergiant that brightens and fades by a small amount in a steady rhythm.",
            "It is not the brightest star in the sky. Sirius is much brighter. Polaris matters because of where it sits.",
            "A telescope shows a faint companion star.",
        ],
    },
    "54061": {
        "constellation": "Ursa Major",
        "distance": "123 light-years",
        "about": "Dubhe is the northern pointer of the Big Dipper, the lip of the bowl farthest from the handle. A line from Merak through Dubhe leads to Polaris.",
        "facts": [
            "It is an orange giant with a close companion.",
            "Unlike most of the Dipper, Dubhe is not moving through space with the rest of the group.",
        ],
    },
    "53910": {
        "constellation": "Ursa Major",
        "distance": "80 light-years",
        "about": "Merak is the other pointer of the Big Dipper, paired with Dubhe. The two make the side of the bowl away from the handle.",
        "facts": [
            "Extend the line from Merak through Dubhe about five times and you arrive at Polaris.",
            "Merak is a white star, hotter than the Sun.",
        ],
    },
    "58001": {
        "constellation": "Ursa Major",
        "distance": "83 light-years",
        "about": "Phecda is the bottom corner of the Big Dipper’s bowl where the handle begins. It is one of the stars of the Ursa Major moving group, a family that travels together.",
        "facts": [
            "Most of the Dipper shares that motion. Dubhe and Alkaid do not.",
            "Phecda is a white star a little under 100 light-years away.",
        ],
    },
    "59774": {
        "constellation": "Ursa Major",
        "distance": "81 light-years",
        "about": "Megrez is the faintest of the seven Big Dipper stars, where the handle meets the bowl. On a hazy night it is the one that disappears first.",
        "facts": [
            "It still belongs to the same moving group as Merak, Phecda, Alioth, and Mizar.",
            "The name means the base of the tail.",
        ],
    },
    "62956": {
        "constellation": "Ursa Major",
        "distance": "83 light-years",
        "about": "Alioth is the brightest star of the Big Dipper, the first one in the handle after the bowl. It is a white star with a peculiar, patchy atmosphere.",
        "facts": [
            "It is part of the Ursa Major moving group.",
            "Nothing else in the Dipper outshines it, though the figure is famous for its shape rather than for one dominant star.",
        ],
    },
    "65378": {
        "constellation": "Ursa Major",
        "distance": "83 light-years",
        "about": "Mizar is the second star of the Big Dipper’s handle and the most famous double in the sky. Just beside it, sharp eyes can see a fainter star, Alcor.",
        "facts": [
            "A telescope splits Mizar itself into two stars, and each of those is a pair. It is a crowd, not a single sun.",
            "Alcor is a true companion of the group, not a chance alignment.",
        ],
    },
    "67301": {
        "constellation": "Ursa Major",
        "distance": "104 light-years",
        "about": "Alkaid is the star at the end of the Big Dipper’s handle. It is the farthest of the seven from the bowl and is not part of the moving group that includes the middle of the Dipper.",
        "facts": [
            "The name means the leader of the mourning maidens.",
            "It is a hot blue-white star, younger than the Sun.",
        ],
    },
    "moon": {
        "constellation": "Earth’s satellite",
        "distance": None,
        "about": "The Moon is Earth’s companion, a rocky world a little more than a quarter of Earth’s width. It keeps the same face toward us because its spin and its orbit take the same time.",
        "facts": [
            "Its gravity raises the tides.",
            "The dark patches are old lava plains. The bright highlands are older and more cratered.",
        ],
    },
    "mercury": {
        "constellation": "planet",
        "distance": None,
        "about": "Mercury is the innermost planet, a small airless world that never strays far from the Sun in our sky. Look for it low in twilight, not at midnight.",
        "facts": [
            "From one sunrise to the next takes 176 Earth days, twice as long as Mercury’s year.",
            "It has almost no atmosphere, so the Sun-facing side is scorching and the night side is frozen.",
        ],
    },
    "venus": {
        "constellation": "planet",
        "distance": None,
        "about": "Venus is the brightest planet and the third-brightest object in the sky after the Sun and the Moon. It is either the evening star after sunset or the morning star before sunrise.",
        "facts": [
            "A thick blanket of carbon dioxide hides the surface and makes Venus hotter than Mercury.",
            "Through a telescope it shows phases, like a tiny Moon.",
        ],
    },
    "mars": {
        "constellation": "planet",
        "distance": None,
        "about": "Mars is the red planet, a cold desert world about half Earth’s size. Its color comes from iron oxide in the dust.",
        "facts": [
            "Every couple of years it passes close to Earth and becomes much brighter than usual.",
            "Two small moons, Phobos and Deimos, orbit it. They are too faint to see without a large telescope.",
        ],
    },
    "jupiter": {
        "constellation": "planet",
        "distance": None,
        "about": "Jupiter is the largest planet, a giant of hydrogen and helium. It is usually the brightest starlike point that does not twinkle, cream-white rather than red like Mars.",
        "facts": [
            "The four moons Galileo found — Io, Europa, Ganymede, and Callisto — look like a line of sparks in binoculars.",
            "The Great Red Spot is a storm wider than Earth.",
        ],
    },
    "saturn": {
        "constellation": "planet",
        "distance": None,
        "about": "Saturn is the ringed giant, a ball of hydrogen and helium farther out than Jupiter. To the eye it is a steady yellowish point.",
        "facts": [
            "The rings are ice and rock in a sheet only tens of meters thick, and a small telescope shows them.",
            "Titan, its largest moon, has a thick atmosphere and lakes of liquid methane.",
        ],
    },
}


def story_for(catalog_id: str, object_type: str, name: str | None) -> dict | None:
    """Notes for one catalog object, or a short satellite note."""
    found = _STORIES.get(str(catalog_id))
    if found:
        return found
    if object_type != "satellite":
        return None
    label = name or "This satellite"
    if name and "ISS" in name.upper():
        return {
            "constellation": "Earth orbit",
            "distance": "about 400 km up",
            "about": "The International Space Station is a crewed laboratory in low Earth orbit. It circles Earth about every 90 minutes and can outshine every star when it passes overhead.",
            "facts": [
                "It looks like a bright, steady light that crosses the sky in a few minutes. It does not twinkle, and it does not have flashing wing lights.",
                f"The public catalog number is NORAD {catalog_id}.",
            ],
        }
    return {
        "constellation": "Earth orbit",
        "distance": "low Earth orbit",
        "about": f"{label} is a satellite. Its place in the sky is predicted from public orbital elements, not from a star catalog.",
        "facts": [
            "Satellites move. A star holds still relative to the others. If the point is drifting, it is not a star.",
            f"The public catalog number is NORAD {catalog_id}.",
        ],
    }
